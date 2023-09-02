export class Scheduler {
    
    constructor() {
        this._scheduled = [];
    }

    schedule(func, delay) {
        const intervalId = setInterval(func, delay);
        this._scheduled.push(intervalId);
    }

    close() {
        this._scheduled.forEach(s => clearInterval(s));
    }
}