import bodyParser from "body-parser";
import express from "express";

let server;

export function start({
    port = 8080,
    getRoutes = []
} = {}) {
    const app = express();

    app.use(bodyParser.json());

    getRoutes.forEach(r => {
        app.get(r.path, async (req, res) => {
            r.handler(req, res);
        });
    });

    server = app.listen(port, () => {
        console.log(`Mock server started on ${port}`);
    });
}

export function stop() {
    if (server) {
        server.close();
    }
}