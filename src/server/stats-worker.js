import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import {
    ALL_TIME_STATS_VIEW, DAY_SECONDS, LAST_30_DAYS_STATS_VIEW, LAST_365_DAYS_STATS_VIEW,
    LAST_7_DAYS_STATS_VIEW, LAST_90_DAYS_STATS_VIEW, LAST_DAY_STATS_VIEW,
    NINENTY_DAYS_SECONDS, SEVEN_DAYS_SECONDS, SqliteAnalyticsRepository,
    StatsView, THIRTY_DAYS_SECONDS, THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS
} from "./analytics.js";
import * as Dates from "../shared/dates.js";
import { SqliteDb } from "./db.js";

export class StatsWorker {

    #worker;
    #nextRequestId = 0;
    #pendingRequests = new Map();
    #closed = false;

    constructor(dbPath) {
        this.#worker = new Worker(new URL(import.meta.url), {
            workerData: { dbPath }
        });
        this.#worker.on("message", message => this.#handleMessage(message));
        this.#worker.on("error", error => this.#rejectPendingRequests(error));
        this.#worker.on("exit", code => {
            if (code !== 0 && !this.#closed) {
                this.#rejectPendingRequests(new Error(`Stats worker exited with code ${code}`));
            }
        });
    }

    calculateShorterPeriods(nowTimestamp) {
        return this.#request("calculateShorterPeriods", nowTimestamp);
    }

    calculateLongerPeriods(nowTimestamp) {
        return this.#request("calculateLongerPeriods", nowTimestamp);
    }

    calculateAllTime(nowTimestamp) {
        return this.#request("calculateAllTime", nowTimestamp);
    }

    async close() {
        if (this.#closed) {
            return;
        }
        this.#closed = true;
        await this.#request("close");
        await this.#worker.terminate();
    }

    #request(command, nowTimestamp) {
        if (this.#closed && command !== "close") {
            return Promise.reject(new Error("Stats worker is closed"));
        }
        const id = this.#nextRequestId++;
        return new Promise((resolve, reject) => {
            this.#pendingRequests.set(id, { resolve, reject });
            this.#worker.postMessage({ id, command, nowTimestamp });
        });
    }

    #handleMessage(message) {
        const pendingRequest = this.#pendingRequests.get(message.id);
        if (!pendingRequest) {
            return;
        }
        this.#pendingRequests.delete(message.id);
        if (message.error) {
            pendingRequest.reject(new Error(message.error));
        } else {
            pendingRequest.resolve();
        }
    }

    #rejectPendingRequests(error) {
        for (const { reject } of this.#pendingRequests.values()) {
            reject(error);
        }
        this.#pendingRequests.clear();
    }
}

if (!isMainThread) {
    startStatsWorker();
}

async function startStatsWorker() {
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

        const calculator = new StatsViewsCalculator(analyticsRepository, db, nowTimestamp);
        if (command === "calculateShorterPeriods") {
            await calculator.saveViewsForShorterPeriods();
        } else if (command === "calculateLongerPeriods") {
            await calculator.saveViewsForLongerPeriods();
        } else if (command === "calculateAllTime") {
            await calculator.saveAllTimeView();
        } else {
            throw new Error(`Unsupported stats worker command: ${command}`);
        }
        parentPort.postMessage({ id });
    }
}

class StatsViewsCalculator {
    constructor(analyticsRepository, db, nowTimestamp) {
        this.analyticsRepository = analyticsRepository;
        this.db = db;
        this.nowTimestamp = nowTimestamp;
    }

    async saveViewsForShorterPeriods() {
        const timestampDayAgo = Dates.timestampSecondsAgo(this.nowTimestamp, DAY_SECONDS);
        const lastDayStats = await this.analyticsRepository.stats(timestampDayAgo, this.nowTimestamp);
        const timestampSevenDaysAgo = Dates.timestampSecondsAgo(this.nowTimestamp, SEVEN_DAYS_SECONDS);
        const lastSevenDaysStats = await this.analyticsRepository.stats(timestampSevenDaysAgo, this.nowTimestamp);

        this.#saveView(new StatsView(LAST_DAY_STATS_VIEW, lastDayStats, this.nowTimestamp));
        this.#saveView(new StatsView(LAST_7_DAYS_STATS_VIEW, lastSevenDaysStats, this.nowTimestamp));
    }

    async saveViewsForLongerPeriods() {
        const timestampThirtyDaysAgo = Dates.timestampSecondsAgo(this.nowTimestamp, THIRTY_DAYS_SECONDS);
        const lastThirtyDaysStats = await this.analyticsRepository.stats(timestampThirtyDaysAgo, this.nowTimestamp);
        const timestampNinetyDaysAgo = Dates.timestampSecondsAgo(this.nowTimestamp, NINENTY_DAYS_SECONDS);
        const lastNinetyDaysStats = await this.analyticsRepository.stats(timestampNinetyDaysAgo, this.nowTimestamp);
        const timestampThreeHundredSixtyFiveDaysAgo = Dates.timestampSecondsAgo(this.nowTimestamp, THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS);
        const lastThreeHundredSixtyFiveDaysStats = await this.analyticsRepository.stats(timestampThreeHundredSixtyFiveDaysAgo, this.nowTimestamp);

        this.#saveView(new StatsView(LAST_30_DAYS_STATS_VIEW, lastThirtyDaysStats, this.nowTimestamp));
        this.#saveView(new StatsView(LAST_90_DAYS_STATS_VIEW, lastNinetyDaysStats, this.nowTimestamp));
        this.#saveView(new StatsView(LAST_365_DAYS_STATS_VIEW, lastThreeHundredSixtyFiveDaysStats, this.nowTimestamp));
    }

    async saveAllTimeView() {
        const allTimeStats = await this.analyticsRepository.stats(null, this.nowTimestamp);
        this.#saveView(new StatsView(ALL_TIME_STATS_VIEW, allTimeStats, this.nowTimestamp));
    }

    #saveView(statsView) {
        this.db.execute(`
            INSERT INTO stats_view (period, stats, calculated_at)
            VALUES (?, ?, json(?))
            ON CONFLICT (period)
            DO UPDATE SET
            stats = EXCLUDED.stats,
            calculated_at = EXCLUDED.calculated_at
            `, [statsView.period, JSON.stringify(statsView.stats), statsView.calculatedAt]);
    }
}
