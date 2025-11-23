import {reactive} from "vue";

// global state
const globalState = reactive({
    connection: null,
    isDatabaseReady: false,
    selfInfo: null,
    batteryPercentage: null,
    batteryPercentageInterval: null,
    contacts: [],
    channels: [],
    ackBot: {
        enabled: false,
        trigger: "tyqre ackbot",
        response: "AckBot: @{sender} tyqre ackbot received",
        whitelist: [],
    },
});

export default globalState;
