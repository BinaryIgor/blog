import { parentPort, workerData } from "node:worker_threads";
import { SqliteAnalyticsRepository, StatsViews } from "./analytics.js";
import { SqliteDb } from "./db.js";

const db = await SqliteDb.initInstance(workerData.dbPath);
const analyticsRepository = new SqliteAnalyticsRepository(db);
let jobQueue = Promise.resolve();

parentPort.on("message", message => {
    jobQueue = jobQueue
        .then(() => execute(message))
        .catch(error => parentPort.postMessage({ id: message.id, error: error.message }));
});

async function execute({ id, command, nowTimestamp }) {
    if (command === "close") {
        await db.close();
        parentPort.postMessage({ id });
        return;
    }

    const clock = { nowTimestamp: () => nowTimestamp };
    const statsViews = new StatsViews(analyticsRepository, db, clock);
    if (command === "calculateShorterPeriods") {
        await statsViews.saveViewsForShorterPeriods();
    } else if (command === "calculateLongerPeriods") {
        await statsViews.saveViewsForLongerPeriods();
    } else if (command === "calculateAllTime") {
        await statsViews.saveAllTimeView();
    } else {
        throw new Error(`Unsupported stats worker command: ${command}`);
    }
    parentPort.postMessage({ id });
}
