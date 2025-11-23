import GlobalState from "./GlobalState.js";
import {WebBleConnection, WebSerialConnection, Constants} from "@liamcottle/meshcore.js";
import Database from "./Database.js";
import Utils from "./Utils.js";
import NotificationUtils from "./NotificationUtils.js";
import {isSenderAllowed} from "./AckBotUtils.js";
import WebSocketBridgeConnection from "./WebSocketBridgeConnection.js";

class Connection {

    // enable to log raw tx/rx bytes to console
    static log = false;

    static async connectViaBluetooth() {
        try {
            // Use browser-specific BLE connection wrapper
            await this.connect(await WebBleConnection.open());
            return true;
        } catch(e) {

            console.log(e);

            // ignore device not selected error
            if(e.name === "NotFoundError"){
                return false;
            }

            // show error message
            alert("failed to connect to ble device!");

            return false;

        }
    }

    static async connectViaSerial() {
        try {
            // Ensure browser supports Web Serial API
            if(!('serial' in navigator)){
                alert("Web Serial API is not available in this browser. Please use a Chromium-based browser (Chrome, Edge, Brave, etc.).");
                return false;
            }

            // Use browser-specific Web Serial connection wrapper
            await this.connect(await WebSerialConnection.open());
            return true;
        } catch(e) {

            console.log(e);

            // ignore device not selected error
            if(e.name === "NotFoundError"){
                return false;
            }

            // show error message
            alert(`Failed to connect to serial device: ${e.message ?? e}`);

            return false;

        }
    }

    static async connectToRemoteRadio(remoteUrl) {
        try {

            const trimmedUrl = remoteUrl?.trim();
            if(!trimmedUrl){
                alert("Please provide the WebSocket URL of the remote radio bridge.");
                return false;
            }

            if(!/^wss?:\/\//i.test(trimmedUrl)){
                alert("Remote radio URL must start with ws:// or wss://");
                return false;
            }

            await this.connect(await WebSocketBridgeConnection.open(trimmedUrl));
            return true;

        } catch(e) {

            console.log(e);

            alert(`Failed to connect to remote radio: ${e.message ?? e}`);

            return false;

        }
    }

    static async connect(connection) {

        // do nothing if connection not provided
        if(!connection){
            return;
        }

        // clear previous connection state
        GlobalState.selfInfo = null;
        GlobalState.contacts = [];
        GlobalState.channels = [];
        GlobalState.batteryPercentage = null;
        GlobalState.isDatabaseReady = false;

        // update connection and listen for events
        GlobalState.connection = connection;
        GlobalState.connection.on("connected", () => this.onConnected());
        GlobalState.connection.on("disconnected", () => this.onDisconnected());

        // for WebSocket bridge connections, explicitly start the MeshCore
        // handshake (deviceQuery + "connected" event) *after* listeners
        // are attached, to avoid race conditions.
        if (connection instanceof WebSocketBridgeConnection) {
            try {
                console.log("[app-connection] starting remote handshake via WebSocket bridge");
                await connection.onConnected();
            } catch (e) {
                console.error("[app-connection] remote handshake failed", e);
                throw e;
            }
        }

    }

    static async disconnect() {

        // disconnect
        GlobalState.connection?.close();

        // update ui
        GlobalState.connection = null;

        // clear previous connection timers
        clearInterval(GlobalState.batteryPercentageInterval);
        GlobalState.batteryPercentageInterval = null;

    }

    static async onConnected() {

        // weird way to allow us to lock all other callbacks from doing anything, until the database is ready...
        // maybe we should use some sort of lock or mutex etc.
        // basically, we need to wait for SelfInfo to be fetched before we can init the database.
        // we use this to create a new database instance that is unique based on the devices public key.
        // initDatabase is async, which means all the other callbacks could fire before the database is ready
        // this means when we try to access the database when it isn't ready yet, we get fun errors...
        // so we need to force the callbacks to wait until the database is ready
        // we will just resolve this promise when the database is ready, and all the callbacks should be set to await it
        var onDatabaseReady = null;
        const databaseToBeReady = new Promise((resolve) => {
            onDatabaseReady = resolve;
        });

        // log raw tx bytes if enabled
        GlobalState.connection.on("tx", async (data) => {
            if(this.log){
                console.log("tx", data);
            }
        });

        // log raw rx bytes if enabled
        GlobalState.connection.on("rx", async (data) => {
            if(this.log){
                console.log("rx", data);
            }
        });

        // listen for self info, and then init database
        GlobalState.connection.once(Constants.ResponseCodes.SelfInfo, async (selfInfo) => {
            try {
                await Database.initDatabase(Utils.bytesToHex(selfInfo.publicKey));
                GlobalState.isDatabaseReady = true;
                console.log("Database initialised for device", Utils.bytesToHex(selfInfo.publicKey));
            } catch (e) {
                console.error("Failed to init database", e);
                // fall back to in-memory mode so UI can still function
                GlobalState.isDatabaseReady = false;
            } finally {
                onDatabaseReady();
            }
        });

        // listen for adverts
        GlobalState.connection.on(Constants.PushCodes.Advert, async () => {
            console.log("Advert");
            await databaseToBeReady;
            await this.loadContacts();
        });

        // listen for path updates
        GlobalState.connection.on(Constants.PushCodes.PathUpdated, async (event) => {
            console.log("PathUpdated", event);
            await databaseToBeReady;
            await this.loadContacts();
        });

        // listen for new message available event
        GlobalState.connection.on(Constants.PushCodes.MsgWaiting, async () => {
            console.log("MsgWaiting");
            await databaseToBeReady;
            await this.syncMessages();
        });

        // listen for message send confirmed events
        GlobalState.connection.on(Constants.PushCodes.SendConfirmed, async (event) => {
            console.log("SendConfirmed", event);
            await databaseToBeReady;
            try {
                await Database.Message.setMessageDeliveredByAckCode(event.ackCode, event.roundTrip);
            } catch (e) {
                console.error("Failed to mark message delivered", e);
            }
        });

        // initial setup without needing database
        this.loadAckBotSettings();
        try {
            await this.loadSelfInfo();
            console.log("SelfInfo loaded", GlobalState.selfInfo);
        } catch (e) {
            console.error("Failed to load self info", e);
        }

        try {
            await this.syncDeviceTime();
        } catch (e) {
            console.error("Failed to sync device time", e);
        }

        // wait for database to be ready
        await databaseToBeReady;

        // fetch data after database is ready
        await this.loadContacts();
        await this.loadChannels();
        await this.syncMessages();
        await this.updateBatteryPercentage();

        // auto update battery percentage once per minute
        GlobalState.batteryPercentageInterval = setInterval(async () => {
            await this.updateBatteryPercentage();
        }, 60000);

    }

    static async onDisconnected() {
        await this.disconnect();
    }

    static async loadSelfInfo() {
        GlobalState.selfInfo = await GlobalState.connection.getSelfInfo();
    }

    static async loadContacts() {
        GlobalState.contacts = await GlobalState.connection.getContacts();
    }

    static async loadChannels() {
        // todo fetch from device when implemented in firmware
        GlobalState.channels = [
            {
                idx: 0,
                name: "Public Channel",
                description: "This is the default public channel.",
            },
        ];
    }

    static async updateBatteryPercentage() {
        if(GlobalState.connection){
            try {
                const response = await GlobalState.connection.getBatteryVoltage();
                GlobalState.batteryPercentage = Utils.getBatteryPercentage(response.batteryMilliVolts);
            } catch(e) {
                // ignore error
            }
        }
    }

    static async deviceQuery(appTargetVer = 1) {
        return await GlobalState.connection.deviceQuery(appTargetVer);
    }

    static async setAdvertName(name) {
        await GlobalState.connection.setAdvertName(name);
    }

    static async setAdvertLatLong(latitude, longitude) {
        await GlobalState.connection.setAdvertLatLong(latitude, longitude);
    }

    static async setTxPower(txPower) {
        await GlobalState.connection.setTxPower(txPower);
    }

    static async setRadioParams(radioFreq, radioBw, radioSf, radioCr) {
        await GlobalState.connection.setRadioParams(radioFreq, radioBw, radioSf, radioCr);
    }

    static async syncDeviceTime() {
        const timestamp = Math.floor(Date.now() / 1000);
        await GlobalState.connection.sendCommandSetDeviceTime(timestamp);
    }

    static async resetContactPath(publicKey) {
        await GlobalState.connection.sendCommandResetPath(publicKey);
    }

    static async removeContact(publicKey) {
        await GlobalState.connection.sendCommandRemoveContact(publicKey);
    }

    static async shareContact(publicKey) {
        await GlobalState.connection.shareContact(publicKey);
    }

    static async exportContact(publicKey) {
        return await GlobalState.connection.exportContact(publicKey);
    }

    static async sendMessage(publicKey, text) {

        // send message
        const message = await GlobalState.connection.sendTextMessage(publicKey, text);

        // save to database
        const databaseMessage = await Database.Message.insert({
            status: "sending",
            to: publicKey,
            from: GlobalState.selfInfo.publicKey,
            path_len: null,
            txt_type: Constants.TxtTypes.Plain,
            sender_timestamp: Date.now(),
            text: text,
            timestamp: Date.now(),
            expected_ack_crc: message.expectedAckCrc,
            send_type: message.result,
            error: null,
        });

        // mark message as failed after estimated timeout
        setTimeout(async () => {
            await Database.Message.setMessageFailedById(databaseMessage.id, "timeout");
        }, message.estTimeout);

    }

    static async sendChannelMessage(channelIdx, text) {

        // send message
        await GlobalState.connection.sendChannelTextMessage(channelIdx, text);

        // save to database
        await Database.ChannelMessage.insert({
            channel_idx: channelIdx,
            from: GlobalState.selfInfo.publicKey,
            path_len: null,
            txt_type: Constants.TxtTypes.Plain,
            sender_timestamp: Date.now(),
            text: text,
        });

    }

    static async syncMessages() {
        while(true){

            // sync messages until no more returned
            const message = await GlobalState.connection.syncNextMessage();
            if(!message){
                break;
            }

            // handle received message
            if(message.contactMessage){
                await this.onContactMessageReceived(message.contactMessage);
            } else if(message.channelMessage) {
                await this.onChannelMessageReceived(message.channelMessage);
            }

        }
    }

    static async reboot() {
        await GlobalState.connection.reboot();
    }

    static async onContactMessageReceived(message) {

        console.log("onContactMessageReceived", message);

        // find first contact that matches this public key prefix
        // todo, maybe use the most recently updated contact in case of collision? ideally we should be given the full hash by firmware anyway...
        const contact = GlobalState.contacts.find((contact) => {
            const messagePublicKeyPrefix = message.pubKeyPrefix;
            const contactPublicKeyPrefix = contact.publicKey.slice(0, message.pubKeyPrefix.length);
            return Utils.isUint8ArrayEqual(messagePublicKeyPrefix, contactPublicKeyPrefix);
        });

        // ensure contact exists
        // shouldn't be possible to receive a message if firmware doesn't have the contact, since keys will be missing for decryption
        // however, it could be possible that the contact doesn't exist in javascript memory when the message is received
        if(!contact){
            console.log("couldn't find contact, received message has been dropped");
            return;
        }

        // save message to database
        await Database.Message.insert({
            status: "received",
            to: GlobalState.selfInfo.publicKey,
            from: contact.publicKey,
            path_len: message.pathLen,
            txt_type: message.txtType,
            sender_timestamp: message.senderTimestamp,
            text: message.text,
            expected_ack_crc: null,
            error: null,
        });

        // show notification
        await NotificationUtils.showNewMessageNotification(contact, message.text);

    }

    static async onChannelMessageReceived(message) {

        console.log("onChannelMessageReceived", message);

        // AckBot Logic
        try {
            // parse message text to get sender name and content
            const parts = message.text.split(":");
            let senderName = "Unknown";
            let content = message.text;

            if(parts.length > 1){
                senderName = parts.shift().trim();
                content = parts.join(":").trim();
            }

            // check for trigger (case insensitive)
            const lowerContent = content.toLowerCase();
            const trigger = (GlobalState.ackBot.trigger || "tyqre ackbot").toLowerCase();

            // check if enabled and triggered
            if(GlobalState.ackBot.enabled && lowerContent.includes(trigger)){

                // prevent replying to self or other bots
                const myName = GlobalState.selfInfo ? GlobalState.selfInfo.name : "";
                const whitelist = Array.isArray(GlobalState.ackBot.whitelist) ? GlobalState.ackBot.whitelist : [];
                const allowed = isSenderAllowed(senderName, whitelist);
                if(whitelist.length > 0 && !allowed){
                    console.log(`AckBot ignoring ${senderName} - sender not in whitelist`);
                }

                if(senderName !== myName && senderName !== "AckBot" && allowed){

                    console.log(`AckBot triggering for ${senderName}`);
                    
                    let responseText = GlobalState.ackBot.response || "AckBot: @{sender} tyqre ackbot received";
                    responseText = responseText.replace("@{sender}", `@${senderName}`);

                    // send response (delayed slightly to feel natural and ensure processing order)
                    setTimeout(async () => {
                        await this.sendChannelMessage(message.channelIdx, responseText);
                    }, 1000);

                }
            }
        } catch(e) {
            console.error("AckBot Error:", e);
        }

        // save message to database
        await Database.ChannelMessage.insert({
            channel_idx: message.channelIdx,
            from: null,
            path_len: message.pathLen,
            txt_type: message.txtType,
            sender_timestamp: message.senderTimestamp,
            text: message.text,
        });

    }

    static loadAckBotSettings() {
        const settings = localStorage.getItem("meshcore_ackbot_settings");
        if(settings){
            try {
                const parsed = JSON.parse(settings);
                GlobalState.ackBot.enabled = parsed.enabled ?? false;
                GlobalState.ackBot.trigger = parsed.trigger ?? "tyqre ackbot";
                GlobalState.ackBot.response = parsed.response ?? "AckBot: @{sender} tyqre ackbot received";
                GlobalState.ackBot.whitelist = Array.isArray(parsed.whitelist) ? parsed.whitelist : [];
            } catch(e) {
                console.error("Failed to load AckBot settings", e);
            }
        }
    }

    static saveAckBotSettings() {
        localStorage.setItem("meshcore_ackbot_settings", JSON.stringify(GlobalState.ackBot));
    }

}

export default Connection;
