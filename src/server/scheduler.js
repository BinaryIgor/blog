export class Scheduler {
    
    constructor() {
        this._scheduled = [];
    }

    schedule(func, interval) {
        const intervalId = setInterval(func, interval);
        this._scheduled.push(intervalId);
    }

    close() {
        this._scheduled.forEach(s => clearInterval(s));
    }
}