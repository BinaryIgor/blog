import * as Server from "../src/server/server.js";

let serverPort;

export const serverIntTestSuite = (testsDescription, testsCallback) => {
    describe(testsDescription, () => {
        before(async function () {
            serverPort = 10_000 + Math.ceil(Math.random() * 10_000);

            await Server.start();
        });

        afterEach(async () => {
            console.log("After each...");
        });

        testsCallback();
    })
};