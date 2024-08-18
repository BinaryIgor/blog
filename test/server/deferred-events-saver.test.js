import { Scheduler } from "../../src/server/scheduler.js";
import { delay } from "../../src/shared/promises.js";
import { TestObjects } from "../test-objects.js";
import { DeferredEventsSaver } from "../../src/server/analytics.js";
import { assert } from "chai";
import { TestClock } from "../test-utils.js";

const WRITE_INTERVAl = 1;
const WRITE_INTERVAL_AWAIT = 5;
const MAX_EVENTS_IN_MEMORY = 3;

const scheduler = new Scheduler();

const clock = new TestClock();

let repository;
let saver;

describe("DeferredEventsSaver tests", () => {
    beforeEach(() => {
        repository = new FakeAnalyticsRepository();
        saver = new DeferredEventsSaver(repository, MAX_EVENTS_IN_MEMORY, clock);
    });

    afterEach(() => {
        scheduler.close();
    });

    it('retries failed events save', async () => {
        saver.schedule(scheduler, WRITE_INTERVAl);

        repository.error = new Error("Fail to save events");

        saver.addEvent(TestObjects.randomEvent());
        saver.addEvent(TestObjects.randomEvent());

        await nextWriteInterval();

        assert.lengthOf(repository.savedEvents, 0);
        assertSaveTimestampEqual(null);

        repository.error = null;

        saver.addEvent(TestObjects.randomEvent());

        await nextWriteInterval();

        assert.lengthOf(repository.savedEvents, 3);
        assertSaveTimestampEqual(clock.nowTimestamp());
    });

    it('saves events immediately after reaching configured in-memory limits', async () => {
        await saver.addEvent(TestObjects.randomEvent());
        await saver.addEvent(TestObjects.randomEvent());

        assert.lengthOf(repository.savedEvents, 0);
        assertSaveTimestampEqual(null);

        await saver.addEvent(TestObjects.randomEvent());

        assert.lengthOf(repository.savedEvents, 3);
        assertSaveTimestampEqual(clock.nowTimestamp());
    });
})

function nextWriteInterval() {
    return delay(WRITE_INTERVAL_AWAIT);
}

function assertSaveTimestampEqual(expectedTimestamp) {
    assert.equal(saver.lastSaveTimestamp, expectedTimestamp);
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