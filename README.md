# MeshCore Web

A simple, mobile friendly, web based [MeshCore](https://github.com/ripplebiz/MeshCore) client for the [Companion Radio Firmware](https://github.com/ripplebiz/MeshCore/blob/main/examples/companion_radio/main.cpp).

**No longer updated**

Please note, this web client is no longer being updated, however it will remain open source as a reference for anyone looking to build their own MeshCore client.

This web client has been replaced by the new cross-platform Flutter app, which has a consistent experience across Android, iOS and Web.

- Android: https://play.google.com/store/apps/details?id=com.liamcottle.meshcore.android
- iOS: https://apps.apple.com/us/app/meshcore/id6742354151?platform=iphone
- Web: https://app.meshcore.nz

## Remote serial bridge

If you want to plug a Heltec/ESP32 radio into a Debian host and let other devices on the LAN talk to it, this repo now ships with a tiny WebSocket bridge.

1. On the Debian box, run the bridge and point it at your serial port:

```bash
MESHCORE_SERIAL_PORT=/dev/ttyUSB0 MESHCORE_BRIDGE_PORT=8787 npm run bridge
```

   Environment variables:
   - `MESHCORE_SERIAL_PORT` (default `/dev/ttyUSB0`) – serial device that the radio is attached to.
   - `MESHCORE_BRIDGE_PORT` (default `8787`) – TCP port for the WebSocket listener.
   - `MESHCORE_BRIDGE_HOST` (default `0.0.0.0`) – which interface to bind.

   The server speaks plain WebSocket (`ws://`). Put it behind a TLS-terminating proxy if you need `wss://`.

2. In the MeshCore web app, use the new “Connect to Remote Radio” panel on the connect screen and enter the WebSocket endpoint (e.g. `ws://192.168.86.216:8787`). The UI will reuse the same connection abstractions, so the rest of the app behaves as if you were using Web Serial locally.

## TODO

- add screenshots to readme

## License

MIT
