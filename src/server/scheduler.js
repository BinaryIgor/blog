export class Scheduler {

    #scheduledTimeouts;
    #scheduledIntervals;

    constructor() {
        this.#scheduledTimeouts = [];
        this.#scheduledIntervals = [];
    }

    schedule(func, interval, scheduleDelay = 0) {
        if (scheduleDelay > 0) {
            const timeoutId = setTimeout(() => {
                const intervalId = setInterval(func, interval);
                this.#scheduledIntervals.push(intervalId);
            }, scheduleDelay);
            this.#scheduledTimeouts.push(timeoutId);
        } else {
            const intervalId = setInterval(func, interval);
            this.#scheduledIntervals.push(intervalId);
        }
    }

    close() {
        this.#scheduledTimeouts.forEach(s => clearTimeout(s));
        this.#scheduledIntervals.forEach(s => clearInterval(s));
    }
}