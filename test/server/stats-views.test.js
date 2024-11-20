import { initSchema, SqliteDb } from "../../src/server/db.js";

import { assert } from "chai";

import fs from "fs";
import crypto from 'crypto';
import path from 'path';
import {
    SqliteAnalyticsRepository, StatsView, StatsViews, Stats, ViewsBySource, PageStats,
    LAST_DAY_STATS_VIEW, LAST_7_DAYS_STATS_VIEW, LAST_30_DAYS_STATS_VIEW, LAST_90_DAYS_STATS_VIEW, ALL_TIME_STATS_VIEW,
} from "../../src/server/analytics.js";
import { TestClock, randomNumber } from "../test-utils.js";
import { TestObjects, VIEW_EVENT_TYPE, READ_EVENT_TYPE, SCROLL_EVENT_TYPE } from "../test-objects.js";
import { Event } from "../../src/server/analytics.js";

const DB_PATH = path.join("/tmp", `${crypto.randomUUID()}.db`);

const db = new SqliteDb(DB_PATH);

const analyticsRepository = new SqliteAnalyticsRepository(db);

const clock = new TestClock();

const statsViews = new StatsViews(analyticsRepository, db, clock);

const DAY_SECONDS = 24 * 60 * 60;
const SEVEN_DAYS_SECONDS = DAY_SECONDS * 7;
const THIRTY_DAYS_SECONDS = DAY_SECONDS * 30;
const NINENTY_DAYS_SECONDS = DAY_SECONDS * 90;
const ALL_TIME_STATS_DAYS_SECONDS = DAY_SECONDS * 365;

describe("StatsViews tests", () => {
    before(async () => {
        await initSchema(db);
    });

    afterEach(async () => {
        await deleteEvents();
    });

    after(() => {
        fs.rmSync(DB_PATH);
    });

    statsViewTestCases().forEach(testCase =>
        it(`saves views of ${testCase.viewPeriod} period`, async () => {
            const toTimestamp = clock.nowTimestamp();
            const fromTimestamp = timestampMovedBySeconds(toTimestamp, -testCase.beforeNowOffset);
            const expectedStats1 = await prepareEventsReturningExpectedStats(fromTimestamp, toTimestamp);

            await triggerViewsSave();

            await assertStatsViewEqual(testCase.viewPeriod, expectedStats1);

            await deleteEvents();

            const secondsToMoveTime = randomNumber(1, 100_000);
            clock.moveTimeBy(secondsToMoveTime);

            const expectedStats2 = await prepareEventsReturningExpectedStats(
                timestampMovedBySeconds(fromTimestamp, secondsToMoveTime),
                timestampMovedBySeconds(toTimestamp, secondsToMoveTime));

            await triggerViewsSave();

            assertStatsViewEqual(testCase.viewPeriod, expectedStats2);
        }));

    it(`saves allTime period views`, async () => {
        const toTimestamp = clock.nowTimestamp();
        const fromTimestamp = timestampMovedBySeconds(toTimestamp, -ALL_TIME_STATS_DAYS_SECONDS);
        const expectedStats = await prepareEventsReturningExpectedStats(fromTimestamp, toTimestamp, true);

        await triggerViewsSave();

        await assertStatsViewEqual(ALL_TIME_STATS_VIEW, expectedStats);
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
        }
    ];
}

async function triggerViewsSave() {
    await statsViews.saveViewsForShorterPeriods();
    await statsViews.saveViewsForLongerPeriods();
}

async function prepareEventsReturningExpectedStats(fromTimestamp, toTimestamp, allTimeStats = false) {
    const visitor1Id = crypto.randomUUID();
    const visitor2Id = crypto.randomUUID();
    const visitor3Id = crypto.randomUUID();

    const ipHash1 = "ip-hash-1";
    const ipHash2 = "ip-hash-2";

    const source1 = "binaryigor.com";
    const source2 = "google.com";

    const path1 = "/index.html";
    const path2 = "/post-1.html";
    const path3 = "/post-2.html";

    const visitor1Ip1Source1Path1_view1 = new Event(randomNumber(fromTimestamp, toTimestamp),
        visitor1Id, ipHash1, source1, path1, VIEW_EVENT_TYPE);
    const visitor1Ip1Source1Path1_view2 = new Event(randomNumber(fromTimestamp, toTimestamp),
        visitor1Id, ipHash1, source1, path1, VIEW_EVENT_TYPE);
    const visitor1Ip2Source1Path2_view1 = new Event(randomNumber(fromTimestamp, toTimestamp),
        visitor1Id, ipHash2, source1, path2, VIEW_EVENT_TYPE);
    const visitor1Ip1Source1Path1_read1 = { ...visitor1Ip1Source1Path1_view1 };
    visitor1Ip1Source1Path1_read1.type = READ_EVENT_TYPE;
    const visitor1Ip1Source1Path1_read2 = { ...visitor1Ip1Source1Path1_view2 };
    visitor1Ip1Source1Path1_read2.type = READ_EVENT_TYPE;
    const visitor1Ip1Source1Path1_scroll1 = { ...visitor1Ip1Source1Path1_view1 };
    visitor1Ip1Source1Path1_scroll1.type = SCROLL_EVENT_TYPE;

    const visitor2Ip2Source1Path1_view = new Event(randomNumber(fromTimestamp, toTimestamp),
        visitor2Id, ipHash2, source1, path1, VIEW_EVENT_TYPE);
    const visitor2Ip2Source1Path1_read = { ...visitor2Ip2Source1Path1_view }
    visitor2Ip2Source1Path1_view.type = READ_EVENT_TYPE;
    const visitor2Ip2Source2Path2_view = new Event(randomNumber(fromTimestamp, toTimestamp),
        visitor2Id, ipHash2, source2, path2, VIEW_EVENT_TYPE);
    const visitor2Ip2Source2Path2_read = { ...visitor2Ip2Source2Path2_view };
    visitor2Ip2Source2Path2_read.type = READ_EVENT_TYPE;

    const visitor3Ip2Source2Path3_view = new Event(randomNumber(fromTimestamp, toTimestamp),
        visitor3Id, ipHash2, source2, path3, VIEW_EVENT_TYPE);
    const visitor3Ip2Source2Path3_scroll = { ...visitor3Ip2Source2Path3_view };
    visitor3Ip2Source2Path3_scroll.type = SCROLL_EVENT_TYPE

    await analyticsRepository.saveEvents([
        visitor1Ip1Source1Path1_view1,
        visitor1Ip1Source1Path1_view2,
        visitor1Ip2Source1Path2_view1,
        visitor1Ip1Source1Path1_read1,
        visitor1Ip1Source1Path1_read2,
        visitor1Ip1Source1Path1_scroll1,
        visitor2Ip2Source1Path1_view,
        visitor2Ip2Source1Path1_read,
        visitor2Ip2Source2Path2_view,
        visitor2Ip2Source2Path2_read,
        visitor3Ip2Source2Path3_view,
        visitor3Ip2Source2Path3_scroll
    ]);

    if (!allTimeStats) {
        await analyticsRepository.saveEvents(outsideTimePeriodRandomEvents(fromTimestamp, toTimestamp));
    }

    const views = 6;
    const uniqueVisitors = 3;
    const ipHashes = 2;
    const reads = 4;
    const uniqueReaders = 2;
    const scrolls = 2;
    const uniqueScrollers = 2;

    return new Stats(views, uniqueVisitors, ipHashes, reads, uniqueReaders, scrolls, uniqueScrollers,
        [
            new ViewsBySource(source1, 4),
            new ViewsBySource(source2, 2),
        ],
        [
            new PageStats(path1, 3, 3, 1, 2, 2, 1),
            new PageStats(path2, 2, 1, 0, 2, 1, 0),
            new PageStats(path3, 1, 0, 1, 1, 0, 1)
        ]);
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
    ]
}

async function assertStatsViewEqual(viewPeriod, expectedStats) {
    const views = await statsViews.views();

    const actualStatsView = views.filter(v => v.period == viewPeriod);
    assert.lengthOf(actualStatsView, 1);

    const expectedStatsView = new StatsView(viewPeriod, expectedStats, clock.nowTimestamp());

    assert.deepEqual(actualStatsView[0], expectedStatsView);
}

function deleteEvents() {
    return db.execute("DELETE FROM event");
}