import { Connection } from "@liamcottle/meshcore.js";

class WebSocketBridgeConnection extends Connection {

    constructor(url) {
        super();
        this.url = url;
        this.socket = null;
    }

    static async open(url) {
        const connection = new WebSocketBridgeConnection(url);
        await connection.connect();
        return connection;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.url);
            } catch (error) {
                reject(error);
                return;
            }

            this.socket.binaryType = "arraybuffer";

            const handleOpen = async () => {
                try {
                    await this.onConnected();
                    cleanup();
                    resolve(this);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            const handleError = (event) => {
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
            this.socket.addEventListener("close", () => {
                this.onDisconnected();
            });
            this.socket.addEventListener("message", async (event) => {
                const bytes = await WebSocketBridgeConnection.toUint8Array(event.data);
                if (bytes) {
                    this.onFrameReceived(bytes);
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
            console.warn("Ignoring text frame from remote radio:", data);
            return null;
        }
        try {
            return new Uint8Array(data);
        } catch (error) {
            console.error("Unable to convert WebSocket frame to Uint8Array", error);
            return null;
        }
    }

    async close() {
        try {
            this.socket?.close();
        } catch (error) {
            console.error("Failed to close remote WebSocket", error);
        }
    }

    async sendToRadioFrame(data) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new Error("Remote WebSocket is not connected.");
        }
        this.emit("tx", data);
        this.socket.send(data);
    }

}

export default WebSocketBridgeConnection;
