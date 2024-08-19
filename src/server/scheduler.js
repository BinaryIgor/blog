export class Scheduler {

    constructor() {
        this._scheduled = [];
    }

    schedule(func, interval, scheduleDelay = 0) {
        if (scheduleDelay > 0) {
            setTimeout(() => {
                const intervalId = setInterval(func, interval);
                this._scheduled.push(intervalId);
            }, scheduleDelay);
        } else {
            const intervalId = setInterval(func, interval);
            this._scheduled.push(intervalId);
        }
    }

    close() {
        this._scheduled.forEach(s => clearInterval(s));
    }
}