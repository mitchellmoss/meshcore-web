import path from "path";
import fs from "fs";
import vue from '@vitejs/plugin-vue';

export default {

    // vite app is loaded from /src
    root: path.join(__dirname, "src"),

    // build to /dist instead of /src/dist
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },

    server: {
        host: '0.0.0.0',
        port: 5173,
        https: {
            key: fs.readFileSync('./cert.key'),
            cert: fs.readFileSync('./cert.crt'),
        },
    },

    // add plugins
    plugins: [
        vue(),
    ],

}
