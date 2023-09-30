import { Scheduler } from "../../src/server/scheduler.js";
import { delay } from "../../src/shared/promises.js";
import { TestObjects } from "../test-objects.js";
import { DeferredEventsSaver } from "../../src/server/analytics.js";
import { expect } from "chai";

const WRITE_DELAY = 1;
const WRITE_DELAY_AWAIT = 5;

const scheduler = new Scheduler();

let repository;
let saver;

describe("DeferredEventsSaver tests", () => {
    beforeEach(() => {
        repository = new FakeAnalyticsRepository();
        saver = new DeferredEventsSaver(repository, scheduler, WRITE_DELAY);
    });

    it('should retry failed events save', async () => {
        repository.error = new Error("Fail to save events");

        saver.addEvent(TestObjects.randomEvent());
        saver.addEvent(TestObjects.randomEvent());

        await nextWriteDelay();

        expect(repository.savedEvents).to.have.length(0);

        repository.error = null;

        saver.addEvent(TestObjects.randomEvent());

        await nextWriteDelay();

        expect(repository.savedEvents).to.have.length(3);
    });

    afterEach(() => {
        scheduler.close();
    });
})

function nextWriteDelay() {
    return delay(WRITE_DELAY_AWAIT);
}

export class FakeAnalyticsRepository {

    savedEvents = [];

    saveEvents(events) {
        if (this.error) {
            return Promise.reject(this.error);
        }
        this.savedEvents.push(...events);
        return Promise.resolve();
    }
}