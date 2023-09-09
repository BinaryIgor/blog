import { Scheduler } from "../../src/server/scheduler.js";
import { delay } from "../../src/shared/promises.js";
import { TestObjects } from "../test-objects.js";
import { DeferredViewsSaver } from "../../src/server/analytics.js";
import { expect } from "chai";

const WRITE_DELAY = 1;
const WRITE_DELAY_AWAIT = 5;

const scheduler = new Scheduler();

let repository;
let saver;

describe("DeferredViewsSaver tests", () => {
    beforeEach(() => {
        repository = new FakeAnalyticsRepository();
        saver = new DeferredViewsSaver(repository, scheduler, WRITE_DELAY);
    });

    it('should retry failed views save', async () => {
        repository.error = new Error("Fail to save views");

        saver.addView(TestObjects.randomView());
        saver.addView(TestObjects.randomView());

        await nextWriteDelay();

        expect(repository.savedViews).to.have.length(0);

        repository.error = null;

        saver.addView(TestObjects.randomView());

        await nextWriteDelay();

        expect(repository.savedViews).to.have.length(3);
    });

    afterEach(() => {
        scheduler.close();
    });
})

function nextWriteDelay() {
    return delay(WRITE_DELAY_AWAIT);
}

export class FakeAnalyticsRepository {

    savedViews = [];

    saveViews(views) {
        if (this.error) {
            return Promise.reject(this.error);
        }
        this.savedViews.push(...views);
        return Promise.resolve();
    }
}