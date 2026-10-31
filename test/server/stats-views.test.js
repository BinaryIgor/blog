import { initSchema, SqliteDb } from "../../src/server/db.js";
import { StatsWorker } from "../../src/server/stats-worker.js";

import { assert } from "chai";

import fs from "fs";
import crypto from 'crypto';
import path from 'path';
import {
    SqliteAnalyticsRepository, Stats, StatsView, StatsViews,
    LAST_DAY_STATS_VIEW, LAST_7_DAYS_STATS_VIEW, LAST_30_DAYS_STATS_VIEW,
    LAST_90_DAYS_STATS_VIEW, LAST_365_DAYS_STATS_VIEW, ALL_TIME_STATS_VIEW
} from "../../src/server/analytics.js";
import { TestClock, randomNumber } from "../test-utils.js";
import { TestObjects, VIEW_EVENT_TYPE, SCROLL_EVENT_TYPE, PING_EVENT_TYPE } from "../test-objects.js";
import { StatsTestFixture } from "../stats-test-fixture.js";

const DAY_SECONDS = 24 * 60 * 60;
const SEVEN_DAYS_SECONDS = DAY_SECONDS * 7;
const THIRTY_DAYS_SECONDS = DAY_SECONDS * 30;
const NINENTY_DAYS_SECONDS = DAY_SECONDS * 90;
const THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS = DAY_SECONDS * 365;
const ALL_TIME_STATS_DAYS_SECONDS = THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS * 5;
const DB_PATH = path.join("/tmp", `${crypto.randomUUID()}.db`);

const db = SqliteDb.initInstance(DB_PATH);

const analyticsRepository = new SqliteAnalyticsRepository(db);
const clock = new TestClock();

const statsWorker = new StatsWorker(DB_PATH);
const statsViews = new StatsViews(db, statsWorker, clock);

describe("StatsViews tests", function () {
    this.slow(250);

    before(function () {
        initSchema(db);
    });

    afterEach(function () {
        deleteEvents();
    });

    after(async () => {
        await statsWorker.close();
        await db.close();
        fs.rmSync(DB_PATH);
    });

    statsViewTestCases().forEach(testCase =>
        it(`saves views of ${testCase.viewPeriod} period`, async () => {
            const toTimestamp = clock.nowTimestamp();
            const fromTimestamp = timestampMovedBySeconds(toTimestamp, -testCase.beforeNowOffset);
            const expectedStats1 = prepareEventsReturningExpectedStats(fromTimestamp, toTimestamp);

            await triggerLastPeriodsViewsSave();

            assertStatsViewEqual(testCase.viewPeriod, expectedStats1);

            deleteEvents();

            const secondsToMoveTime = randomNumber(1, 100_000);
            clock.moveTimeBy(secondsToMoveTime);

            const expectedStats2 = prepareEventsReturningExpectedStats(
                timestampMovedBySeconds(fromTimestamp, secondsToMoveTime),
                timestampMovedBySeconds(toTimestamp, secondsToMoveTime));

            await triggerLastPeriodsViewsSave();

            assertStatsViewEqual(testCase.viewPeriod, expectedStats2);
        }));

    it(`saves allTime period view`, async () => {
        const toTimestamp = clock.nowTimestamp();
        const fromTimestamp = timestampMovedBySeconds(toTimestamp, -ALL_TIME_STATS_DAYS_SECONDS);
        const expectedStats = prepareEventsReturningExpectedStats(fromTimestamp, toTimestamp, true);

        await statsViews.saveAllTimeView();

        assertStatsViewEqual(ALL_TIME_STATS_VIEW, expectedStats);
    });

    it(`prepares and returns empty stats`, async () => {
        deleteEvents();

        await statsViews.saveAllTimeView();

        assertStatsViewEqual(ALL_TIME_STATS_VIEW, Stats.empty());
    });

    it(`serializes overlapping stats calculations`, async () => {
        await Promise.all([
            statsViews.saveViewsForShorterPeriods(),
            statsViews.saveViewsForLongerPeriods(),
            statsViews.saveAllTimeView()
        ]);

        const views = statsViews.views();
        assert.sameMembers(views.map(view => view.period), [
            LAST_DAY_STATS_VIEW,
            LAST_7_DAYS_STATS_VIEW,
            LAST_30_DAYS_STATS_VIEW,
            LAST_90_DAYS_STATS_VIEW,
            LAST_365_DAYS_STATS_VIEW,
            ALL_TIME_STATS_VIEW
        ]);
    });

    it(`propagates worker calculation errors`, async () => {
        const uninitializedDbPath = path.join("/tmp", `${crypto.randomUUID()}.db`);
        const uninitializedWorker = new StatsWorker(uninitializedDbPath);

        try {
            await uninitializedWorker.calculateShorterPeriods(clock.nowTimestamp());
            assert.fail("Expected a worker calculation error");
        } catch (error) {
            assert.match(error.message, /no such table:/);
        } finally {
            await uninitializedWorker.close();
            fs.rmSync(uninitializedDbPath, { force: true });
        }
    });

    it(`shuts down workers cleanly`, async () => {
        const shutdownWorker = new StatsWorker(DB_PATH);
        await shutdownWorker.close();

        try {
            await shutdownWorker.calculateAllTime(clock.nowTimestamp());
            assert.fail("Expected a closed worker error");
        } catch (error) {
            assert.equal(error.message, "Stats worker is closed");
        }
    });
});

function statsViewTestCases() {
    return [
        {
            beforeNowOffset: DAY_SECONDS,
            viewPeriod: LAST_DAY_STATS_VIEW
        },
        {

            beforeNowOffset: SEVEN_DAYS_SECONDS,
            viewPeriod: LAST_7_DAYS_STATS_VIEW
        },
        {

            beforeNowOffset: THIRTY_DAYS_SECONDS,
            viewPeriod: LAST_30_DAYS_STATS_VIEW
        },
        {

            beforeNowOffset: NINENTY_DAYS_SECONDS,
            viewPeriod: LAST_90_DAYS_STATS_VIEW
        },
        {

            beforeNowOffset: THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS,
            viewPeriod: LAST_365_DAYS_STATS_VIEW
        }
    ];
}

async function triggerLastPeriodsViewsSave() {
    await statsViews.saveViewsForShorterPeriods();
    await statsViews.saveViewsForLongerPeriods();
}

function prepareEventsReturningExpectedStats(fromTimestamp, toTimestamp, allTimeStats = false) {
    const visitorIds = [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID()
    ];
    const sessionIds = [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID()
    ];
    const ipHashes = [
        "ip-hash-1",
        "ip-hash-2"
    ];
    const sources = [
        "binaryigor.com",
        "google.com"
    ];
    const mediums = [
        "organic",
        "email",
        "social"
    ];
    const campaigns = ["some-initiative"];
    const refs = ["some-website/awesome-links/", "binaryigor.com/posts.html"];
    const paths = [
        "index.html",
        "/post-1.html",
        "/post-2.html"
    ];

    const views = StatsTestFixture.prepareRandomEvents({
        fromTimestamp, toTimestamp, visitorIds, sessionIds, ipHashes,
        sources, mediums, campaigns, refs, paths,
        eventType: VIEW_EVENT_TYPE, count: 20
    });
    const scrolls = StatsTestFixture.prepareRandomEvents({
        fromTimestamp, toTimestamp, visitorIds, sessionIds, ipHashes,
        sources, mediums, campaigns, refs, paths,
        eventType: SCROLL_EVENT_TYPE, count: 10
    });
    const pings = StatsTestFixture.prepareRandomEvents({
        fromTimestamp, toTimestamp, visitorIds, sessionIds, ipHashes,
        sources, mediums, campaigns, refs, paths,
        eventType: PING_EVENT_TYPE, count: 50
    });

    const allEvents = [...views, ...scrolls, ...pings];
    analyticsRepository.saveEvents(allEvents);

    if (!allTimeStats) {
        const events = outsideTimePeriodRandomEvents(fromTimestamp, toTimestamp);
        analyticsRepository.saveEvents(events);
    }

    return StatsTestFixture.eventsToExpectedStats({ views, scrolls, pings });
}

function timestampMovedBySeconds(timestamp, seconds) {
    return timestamp + (seconds * 1000);
}

function outsideTimePeriodRandomEvents(fromTimestamp, toTimestamp) {
    const randomBeforeFromTimestamp = randomNumber(timestampMovedBySeconds(fromTimestamp, -DAY_SECONDS), fromTimestamp);
    const randomAfterToTimestamp = randomNumber(toTimestamp, timestampMovedBySeconds(toTimestamp, DAY_SECONDS));

    const rightBeforeFromTimestamp = timestampMovedBySeconds(fromTimestamp, -1);
    const rightAfterToTimestamp = timestampMovedBySeconds(toTimestamp, 1);

    return [
        TestObjects.randomEvent({ timestamp: randomBeforeFromTimestamp }),
        TestObjects.randomEvent({ timestamp: rightBeforeFromTimestamp }),
        TestObjects.randomEvent({ timestamp: rightAfterToTimestamp }),
        TestObjects.randomEvent({ timestamp: randomAfterToTimestamp })
    ];
}

function assertStatsViewEqual(viewPeriod, expectedStats) {
    const actualStatsView = assertStatsViewOfPeriodExists(viewPeriod);
    const expectedStatsView = new StatsView(viewPeriod, expectedStats, clock.nowTimestamp());
    assert.deepEqual(actualStatsView, expectedStatsView);
}

function assertStatsViewOfPeriodExists(period) {
    const views = statsViews.views();

    const actualStatsView = views.filter(v => v.period == period);
    assert.lengthOf(actualStatsView, 1);

    return actualStatsView[0];
}

function deleteEvents() {
    return db.execute("DELETE FROM event");
}
