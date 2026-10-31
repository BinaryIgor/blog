import { Worker } from "node:worker_threads";

export class StatsWorker {

    #worker;
    #nextRequestId = 0;
    #pendingRequests = new Map();
    #closed = false;

    constructor(dbPath) {
        this.#worker = new Worker(new URL("./stats-worker-thread.js", import.meta.url), {
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
