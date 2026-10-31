import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import {
    LAST_DAY_STATS_VIEW, LAST_7_DAYS_STATS_VIEW, LAST_30_DAYS_STATS_VIEW,
    LAST_90_DAYS_STATS_VIEW, LAST_365_DAYS_STATS_VIEW, ALL_TIME_STATS_VIEW,
    DAY_SECONDS, SEVEN_DAYS_SECONDS, THIRTY_DAYS_SECONDS, NINENTY_DAYS_SECONDS,
    THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS,
    SqliteAnalyticsRepository, StatsView, StatsViewSaver
} from "./analytics.js";
import * as Dates from "../shared/dates.js";
import { SqliteDb } from "./db.js";
import * as Logger from "../shared/logger.js";

const CALCULATE_SHORTER_PERIODS_STATS_COMMAND = "calculateShorterPeriods";
const CALCULATE_LONGER_PERIODS_STATS_COMMAND = "calculateLongerPeriods";
const CALCULATE_ALL_TIME_STATS_COMMAND = "calculateAllTime";
const CLOSE_COMMAND = "close";

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
        return this.#request(CALCULATE_SHORTER_PERIODS_STATS_COMMAND, nowTimestamp);
    }

    calculateLongerPeriods(nowTimestamp) {
        return this.#request(CALCULATE_LONGER_PERIODS_STATS_COMMAND, nowTimestamp);
    }

    calculateAllTime(nowTimestamp) {
        return this.#request(CALCULATE_ALL_TIME_STATS_COMMAND, nowTimestamp);
    }

    async close() {
        if (this.#closed) {
            return;
        }
        this.#closed = true;
        await this.#request(CLOSE_COMMAND);
        await this.#worker.terminate();
    }

    #request(command, nowTimestamp) {
        if (this.#closed && command !== CLOSE_COMMAND) {
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

class StatsViewsCalculator {

    #analyticsRepository;
    #viewSaver;

    constructor(analyticsRepository, viewSaver) {
        this.#analyticsRepository = analyticsRepository;
        this.#viewSaver = viewSaver;
    }

    saveViewsForShorterPeriods(nowTimestamp) {
        const timestampDayAgo = Dates.timestampSecondsAgo(nowTimestamp, DAY_SECONDS);
        const lastDayStats = this.#analyticsRepository.stats(timestampDayAgo, nowTimestamp);
        const timestampSevenDaysAgo = Dates.timestampSecondsAgo(nowTimestamp, SEVEN_DAYS_SECONDS);
        const lastSevenDaysStats = this.#analyticsRepository.stats(timestampSevenDaysAgo, nowTimestamp);

        this.#viewSaver.save(new StatsView(LAST_DAY_STATS_VIEW, lastDayStats, nowTimestamp));
        this.#viewSaver.save(new StatsView(LAST_7_DAYS_STATS_VIEW, lastSevenDaysStats, nowTimestamp));
    }

    saveViewsForLongerPeriods(nowTimestamp) {
        const timestampThirtyDaysAgo = Dates.timestampSecondsAgo(nowTimestamp, THIRTY_DAYS_SECONDS);
        const lastThirtyDaysStats = this.#analyticsRepository.stats(timestampThirtyDaysAgo, nowTimestamp);
        const timestampNinetyDaysAgo = Dates.timestampSecondsAgo(nowTimestamp, NINENTY_DAYS_SECONDS);
        const lastNinetyDaysStats = this.#analyticsRepository.stats(timestampNinetyDaysAgo, nowTimestamp);
        const timestampThreeHundredSixtyFiveDaysAgo = Dates.timestampSecondsAgo(nowTimestamp, THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS);
        const lastThreeHundredSixtyFiveDaysStats = this.#analyticsRepository.stats(timestampThreeHundredSixtyFiveDaysAgo, nowTimestamp);

        this.#viewSaver.save(new StatsView(LAST_30_DAYS_STATS_VIEW, lastThirtyDaysStats, nowTimestamp));
        this.#viewSaver.save(new StatsView(LAST_90_DAYS_STATS_VIEW, lastNinetyDaysStats, nowTimestamp));
        this.#viewSaver.save(new StatsView(LAST_365_DAYS_STATS_VIEW, lastThreeHundredSixtyFiveDaysStats, nowTimestamp));
    }

    saveAllTimeView(nowTimestamp) {
        const allTimeStats = this.#analyticsRepository.stats(null, nowTimestamp);
        this.#viewSaver.save(new StatsView(ALL_TIME_STATS_VIEW, allTimeStats, nowTimestamp));
    }
}

if (!isMainThread) {
    try {
        startStatsWorker();
    } catch (e) {
        Logger.logError("Problem while starting stats worker.", e);
    }
}

function startStatsWorker() {
    const db = SqliteDb.initInstance(workerData.dbPath);
    const analyticsRepository = new SqliteAnalyticsRepository(db);
    const statsViewSaver = new StatsViewSaver(db);
    const calculator = new StatsViewsCalculator(analyticsRepository, statsViewSaver);

    let jobQueue = Promise.resolve();
    parentPort.on("message", message => {
        jobQueue = jobQueue
            .then(() => execute(message))
            .catch(error => parentPort.postMessage({ id: message.id, error: error.message }));
    });

    async function execute({ id, command, nowTimestamp }) {
        if (command === CLOSE_COMMAND) {
            await db.close();
            parentPort.postMessage({ id });
            return;
        }

        if (command === CALCULATE_SHORTER_PERIODS_STATS_COMMAND) {
            calculator.saveViewsForShorterPeriods(nowTimestamp);
        } else if (command === CALCULATE_LONGER_PERIODS_STATS_COMMAND) {
            calculator.saveViewsForLongerPeriods(nowTimestamp);
        } else if (command === CALCULATE_ALL_TIME_STATS_COMMAND) {
            calculator.saveAllTimeView(nowTimestamp);
        } else {
            throw new Error(`Unsupported stats worker command: ${command}`);
        }

        parentPort.postMessage({ id });
    }
}
