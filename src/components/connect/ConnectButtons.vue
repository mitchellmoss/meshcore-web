<template>
    <div class="space-y-2">

        <!-- info -->
        <div class="flex flex-col mx-auto my-auto text-gray-700 text-center">
            <div class="mb-2 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class="w-10">
                    <rect width="256" height="256" fill="none"/>
                    <circle cx="136" cy="64" r="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <line x1="8" y1="128" x2="200" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <polygon points="200 96 200 160 248 128 200 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <rect x="112" y="168" width="48" height="48" rx="8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <path d="M112,64H72a8,8,0,0,0-8,8V184a8,8,0,0,0,8,8h40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                </svg>
            </div>
            <div class="font-semibold">Not Connected</div>
            <div>Connect a MeshCore device to continue</div>
            <div class="text-sm text-gray-500 mt-1">Connect over Bluetooth, USB Serial, or via a remote radio bridge.</div>
            <div class="text-xs text-gray-500 mt-1">For direct serial, use a Chromium-based browser (Web Serial API required).</div>
        </div>

        <!-- bluetooth -->
        <button @click="connectViaBluetooth" type="button" class="w-full flex cursor-pointer bg-white rounded shadow px-3 py-2 text-black space-x-2 font-semibold hover:bg-gray-100">
            <span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class="w-6">
                    <rect width="256" height="256" fill="none"/>
                    <polygon points="128 32 192 80 128 128 128 32" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <polygon points="128 128 192 176 128 224 128 128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <line x1="64" y1="80" x2="128" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <line x1="64" y1="176" x2="128" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                </svg>
            </span>
            <span>Connect via Bluetooth</span>
        </button>

        <!-- serial -->
        <button @click="connectViaSerial" type="button" class="w-full flex cursor-pointer bg-white rounded shadow px-3 py-2 text-black space-x-2 font-semibold hover:bg-gray-100">
            <span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class="w-6">
                    <rect width="256" height="256" fill="none"/>
                    <circle cx="136" cy="64" r="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <line x1="8" y1="128" x2="200" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <polygon points="200 96 200 160 248 128 200 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <rect x="112" y="168" width="48" height="48" rx="8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <path d="M112,64H72a8,8,0,0,0-8,8V184a8,8,0,0,0,8,8h40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                </svg>
            </span>
            <span>Connect via Serial</span>
        </button>

        <!-- remote bridge -->
        <div class="bg-white rounded shadow px-3 py-3 space-y-2 text-left">
            <label class="text-sm font-semibold text-gray-700" for="remoteRadioUrl">Remote radio bridge URL</label>
            <input id="remoteRadioUrl" v-model="remoteUrl" type="text" placeholder="wss://192.168.86.216:8787" class="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button @click="connectToRemoteRadio" type="button" :disabled="connectingRemote" class="w-full flex justify-center items-center cursor-pointer bg-indigo-600 rounded px-3 py-2 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class="w-6">
                        <rect width="256" height="256" fill="none"/>
                        <path d="M96,56H40A8,8,0,0,0,32,64v48a8,8,0,0,0,8,8H96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                        <path d="M160,144h56a8,8,0,0,0,8-8V88a8,8,0,0,0-8-8H160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                        <line x1="96" y1="104" x2="160" y2="152" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                        <line x1="96" y1="152" x2="160" y2="104" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    </svg>
                </span>
                <span class="ml-2">{{ connectingRemote ? 'Connecting…' : 'Connect to Remote Radio' }}</span>
            </button>
            <p class="text-xs text-gray-500">Requires the serial bridge server running on your Debian host (see README).</p>
        </div>

    </div>
</template>

<script>
import Connection from "../../js/Connection.js";

export default {
    name: 'ConnectButtons',
    data() {
        return {
            remoteUrl: localStorage.getItem("meshcore.remoteUrl") || "ws://192.168.86.216:8787",
            connectingRemote: false,
        };
    },
    watch: {
        remoteUrl(value) {
            localStorage.setItem("meshcore.remoteUrl", value);
        },
    },
    methods: {
        async connectViaBluetooth() {
            if(await Connection.connectViaBluetooth()){
                this.$router.push({
                    name: "main",
                });
            }
        },
        async connectViaSerial() {
            if(await Connection.connectViaSerial()){
                this.$router.push({
                    name: "main",
                });
            }
        },
        async connectToRemoteRadio() {
            const url = this.remoteUrl?.trim();
            if(!url){
                alert("Please enter the WebSocket URL exposed by the serial bridge server.");
                return;
            }

            this.connectingRemote = true;
            try {
                if(await Connection.connectToRemoteRadio(url)){
                    this.$router.push({
                        name: "main",
                    });
                }
            } finally {
                this.connectingRemote = false;
            }
        }
    },
}
</script>
