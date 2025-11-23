import http from "http";
import process from "process";
import { WebSocketServer, WebSocket } from "ws";
import { NodeJSSerialConnection } from "@liamcottle/meshcore.js";

const SERIAL_PORT_PATH = process.env.MESHCORE_SERIAL_PORT || "/dev/ttyUSB0";
const WS_PORT = Number(process.env.MESHCORE_BRIDGE_PORT || "8787");
const WS_HOST = process.env.MESHCORE_BRIDGE_HOST || "0.0.0.0";

const clients = new Set();
let serialConnection = null;
let serialReady = false;
let serialConnectInProgress = false;
let reconnectTimeout = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectSerialWithRetry() {
    if (serialConnectInProgress) {
        return;
    }

    serialConnectInProgress = true;

    while (true) {
        try {
            console.log(`[serial] opening ${SERIAL_PORT_PATH}`);
            const connection = new NodeJSSerialConnection(SERIAL_PORT_PATH);

            connection.on("connected", () => {
                serialReady = true;
                console.log(`[serial] connected to ${SERIAL_PORT_PATH}`);
            });

            connection.on("disconnected", () => {
                serialReady = false;
                console.warn("[serial] disconnected, closing clients and retrying...");
                closeAllClients(1011, "Serial device disconnected");
                scheduleReconnect();
            });

            connection.on("rx", (frame) => broadcastFrame(frame));

            connection.on("tx", (frame) => {
                // Uncomment for verbose logging of outbound frames
                // console.log("[serial] tx", Buffer.from(frame).toString("hex"));
            });

            serialConnection = connection;
            await connection.connect();
            console.log("[serial] awaiting device handshake...");
            break;
        } catch (error) {
            console.error(`[serial] failed to open ${SERIAL_PORT_PATH}:`, error?.message || error);
            await wait(3000);
        }
    }

    serialConnectInProgress = false;
}

function scheduleReconnect() {
    if (reconnectTimeout) {
        return;
    }

    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connectSerialWithRetry().catch((error) => {
            console.error("[serial] reconnect failed:", error);
            scheduleReconnect();
        });
    }, 2000);
}

function closeAllClients(code, reason) {
    for (const client of clients) {
        try {
            client.close(code, reason);
        } catch (error) {
            console.error("[ws] failed to close client:", error?.message || error);
        }
    }
    clients.clear();
}

function broadcastFrame(frame) {
    if (!frame || clients.size === 0) {
        return;
    }

    const payload = Buffer.from(frame);
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

connectSerialWithRetry().catch((error) => {
    console.error("[serial] failed to establish connection:", error);
});

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
    if (!serialReady || !serialConnection) {
        ws.close(1013, "Serial port not ready");
        return;
    }

    clients.add(ws);
    console.log(`[ws] client connected from ${req.socket.remoteAddress || "unknown"}`);

    ws.on("message", async (message, isBinary) => {
        if (!serialReady || !serialConnection) {
            ws.close(1011, "Serial port not ready");
            return;
        }

        const payload = isBinary || Buffer.isBuffer(message) ? message : Buffer.from(message);
        try {
            await serialConnection.sendToRadioFrame(new Uint8Array(payload));
        } catch (error) {
            console.error("[serial] failed to forward frame:", error?.message || error);
            ws.close(1011, "Failed to forward frame");
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        console.log("[ws] client disconnected");
    });

    ws.on("error", (error) => {
        console.error("[ws] client error:", error?.message || error);
    });
});

server.listen(WS_PORT, WS_HOST, () => {
    console.log(`[bridge] listening on ws://${WS_HOST}:${WS_PORT}`);
    console.log(`[bridge] forwarding serial device at ${SERIAL_PORT_PATH}`);
});

const shutdown = async () => {
    console.log("Shutting down serial bridge...");
    server.close();
    wss.close();
    closeAllClients(1001, "Server shutting down");
    try {
        await serialConnection?.close();
    } catch (error) {
        console.error("[serial] failed to close:", error?.message || error);
    } finally {
        process.exit(0);
    }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
