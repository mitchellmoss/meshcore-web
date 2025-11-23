import { Connection } from "@liamcottle/meshcore.js";

class WebSocketBridgeConnection extends Connection {

    constructor(url) {
        super();
        this.url = url;
        this.socket = null;
    }

    // Establish the WebSocket transport but do NOT call onConnected here.
    // The app-level Connection.connect() will call onConnected after
    // it has attached "connected" listeners, to avoid race conditions.
    static async open(url) {
        console.log("[ws-bridge] opening", url);
        const connection = new WebSocketBridgeConnection(url);
        await connection._initSocket();
        return connection;
    }

    async _initSocket() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.url);
            } catch (error) {
                console.error("[ws-bridge] failed to create WebSocket", error);
                reject(error);
                return;
            }

            this.socket.binaryType = "arraybuffer";

            const handleOpen = () => {
                console.log("[ws-bridge] socket open", this.url);
                cleanup();
                resolve(this);
            };

            const handleError = (event) => {
                console.error("[ws-bridge] socket error", event);
                cleanup();
                reject(new Error(`Failed to connect to remote radio at ${this.url}`));
            };

            const cleanup = () => {
                if (!this.socket) {
                    return;
                }
                this.socket.removeEventListener("open", handleOpen);
                this.socket.removeEventListener("error", handleError);
            };

            this.socket.addEventListener("open", handleOpen);
            this.socket.addEventListener("error", handleError);
            this.socket.addEventListener("close", (event) => {
                console.log("[ws-bridge] socket close", event.code, event.reason);
                this.onDisconnected();
            });
            this.socket.addEventListener("message", async (event) => {
                try {
                    const bytes = await WebSocketBridgeConnection.toUint8Array(event.data);
                    if (bytes) {
                        console.log("[ws-bridge] rx", bytes.length, "bytes");
                        this.onFrameReceived(bytes);
                    }
                } catch (e) {
                    console.error("[ws-bridge] message handler error", e);
                }
            });
        });
    }

    static async toUint8Array(data) {
        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }
        if (typeof Blob !== "undefined" && data instanceof Blob) {
            const buffer = await data.arrayBuffer();
            return new Uint8Array(buffer);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        if (typeof data === "string") {
            console.warn("[ws-bridge] ignoring text frame from remote radio:", data);
            return null;
        }
        try {
            return new Uint8Array(data);
        } catch (error) {
            console.error("[ws-bridge] Unable to convert WebSocket frame to Uint8Array", error);
            return null;
        }
    }

    async close() {
        try {
            console.log("[ws-bridge] closing socket");
            this.socket?.close();
        } catch (error) {
            console.error("[ws-bridge] Failed to close remote WebSocket", error);
        }
    }

    async sendToRadioFrame(data) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new Error("Remote WebSocket is not connected.");
        }
        console.log("[ws-bridge] tx", data.length, "bytes");
        this.emit("tx", data);
        this.socket.send(data);
    }

}

export default WebSocketBridgeConnection;
