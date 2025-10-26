import express from "express";

let server;

export function start({
    port = 8080,
    routes = []
} = {}) {
    const app = express();

    app.use(express.json());

    routes.forEach(r => {
        app[r.method.toLowerCase()](r.path, async (req, res) => {
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