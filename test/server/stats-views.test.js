import { initSchema, SqliteDb } from "../../src/server/db.js";

import { assert } from "chai";

import fs from "fs";
import crypto from 'crypto';
import path from 'path';
import {
    SqliteAnalyticsRepository, Stats, StatsView, StatsViews,
    LAST_DAY_STATS_VIEW, LAST_7_DAYS_STATS_VIEW, LAST_30_DAYS_STATS_VIEW,
    LAST_90_DAYS_STATS_VIEW, LAST_180_DAYS_STATS_VIEW, LAST_365_DAYS_STATS_VIEW, ALL_TIME_STATS_VIEW
} from "../../src/server/analytics.js";
import { TestClock, randomNumber } from "../test-utils.js";
import { TestObjects, VIEW_EVENT_TYPE, SCROLL_EVENT_TYPE, PING_EVENT_TYPE } from "../test-objects.js";
import { StatsTestFixture } from "../stats-test-fixture.js";
import { SqliteSubscriberRepository } from '../../src/server/newsletter.js';
import { SubscribersStats, subscribersStatsSupplierFactory } from "../../src/server/shared.js";

const DAY_SECONDS = 24 * 60 * 60;
const SEVEN_DAYS_SECONDS = DAY_SECONDS * 7;
const THIRTY_DAYS_SECONDS = DAY_SECONDS * 30;
const NINENTY_DAYS_SECONDS = DAY_SECONDS * 90;
const ONE_HUNDRED_EIGHTY_DAYS_SECONDS = DAY_SECONDS * 180;
const THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS = DAY_SECONDS * 365;
const ALL_TIME_STATS_DAYS_SECONDS = THREE_HUNDRED_SIXTY_FIVE_DAYS_SECONDS * 5;
const DB_PATH = path.join("/tmp", `${crypto.randomUUID()}.db`);

const db = new SqliteDb(DB_PATH);

const analyticsRepository = new SqliteAnalyticsRepository(db);
const subscriberRepository = new SqliteSubscriberRepository(db);
const clock = new TestClock();

const statsViews = new StatsViews(analyticsRepository, subscribersStatsSupplierFactory(subscriberRepository), db, clock);

describe("StatsViews tests", function () {
    this.slow(250);

    before(async function () {
        await db.init();
        await initSchema(db);
    });

    afterEach(async function () {
        await deleteEvents();
        await deleteSubscribers();
    });

    after(() => {
        fs.rmSync(DB_PATH);
    });

    statsViewTestCases().forEach(testCase =>
        it(`saves views of ${testCase.viewPeriod} period`, async () => {
            const toTimestamp = clock.nowTimestamp();
            const fromTimestamp = timestampMovedBySeconds(toTimestamp, -testCase.beforeNowOffset);
            const expectedStats1 = await prepareEventsAndSubscribersReturningExpectedStats(fromTimestamp, toTimestamp);

            await triggerLastPeriodsViewsSave();

            await assertStatsViewEqual(testCase.viewPeriod, expectedStats1);

            await deleteEvents();
            await deleteSubscribers();

            const secondsToMoveTime = randomNumber(1, 100_000);
            clock.moveTimeBy(secondsToMoveTime);

            const expectedStats2 = await prepareEventsAndSubscribersReturningExpectedStats(
                timestampMovedBySeconds(fromTimestamp, secondsToMoveTime),
                timestampMovedBySeconds(toTimestamp, secondsToMoveTime));

            await triggerLastPeriodsViewsSave();

            assertStatsViewEqual(testCase.viewPeriod, expectedStats2);
        }));

    it(`saves allTime period view`, async () => {
        const toTimestamp = clock.nowTimestamp();
        const fromTimestamp = timestampMovedBySeconds(toTimestamp, -ALL_TIME_STATS_DAYS_SECONDS);
        const expectedStats = await prepareEventsAndSubscribersReturningExpectedStats(fromTimestamp, toTimestamp, true);

        await statsViews.saveAllTimeView();

        await assertStatsViewEqual(ALL_TIME_STATS_VIEW, expectedStats);
    });

    it(`prepares and returns empty stats`, async () => {
        await deleteEvents();
        await deleteSubscribers();

        await statsViews.saveAllTimeView();

        await assertStatsViewEqual(ALL_TIME_STATS_VIEW, { ...Stats.empty(), subscribers: SubscribersStats.empty() });
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

            beforeNowOffset: ONE_HUNDRED_EIGHTY_DAYS_SECONDS,
            viewPeriod: LAST_180_DAYS_STATS_VIEW
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

async function prepareEventsAndSubscribersReturningExpectedStats(fromTimestamp, toTimestamp, allTimeStats = false) {
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
    await analyticsRepository.saveEvents(allEvents);

    const subscribers = StatsTestFixture.prepareRandomSubscribers({
        fromTimestamp, toTimestamp, sources, paths,
        placements: ["POST_MID", "LANDING"],
        count: 20
    });
    await saveSubscribers(subscribers);

    if (!allTimeStats) {
        const { events, subscribers } = outsideTimePeriodRandomEventsAndSubscribers(fromTimestamp, toTimestamp);
        await analyticsRepository.saveEvents(events);
        await saveSubscribers(subscribers);
    }

    return StatsTestFixture.eventsToExpectedStats({ views, scrolls, pings, subscribers });
}

function timestampMovedBySeconds(timestamp, seconds) {
    return timestamp + (seconds * 1000);
}

function outsideTimePeriodRandomEventsAndSubscribers(fromTimestamp, toTimestamp) {
    const randomBeforeFromTimestamp = randomNumber(timestampMovedBySeconds(fromTimestamp, -DAY_SECONDS), fromTimestamp);
    const randomAfterToTimestamp = randomNumber(toTimestamp, timestampMovedBySeconds(toTimestamp, DAY_SECONDS));

    const rightBeforeFromTimestamp = timestampMovedBySeconds(fromTimestamp, -1);
    const rightAfterToTimestamp = timestampMovedBySeconds(toTimestamp, 1);

    const events = [
        TestObjects.randomEvent({ timestamp: randomBeforeFromTimestamp }),
        TestObjects.randomEvent({ timestamp: rightBeforeFromTimestamp }),
        TestObjects.randomEvent({ timestamp: rightAfterToTimestamp }),
        TestObjects.randomEvent({ timestamp: randomAfterToTimestamp })
    ]
    const subscribers = [
        TestObjects.randomSubscriber({ createdAt: randomBeforeFromTimestamp, confirmedAt: null, unsubscribedAt: null }),
        TestObjects.randomSubscriber({ createdAt: rightBeforeFromTimestamp, confirmedAt: rightBeforeFromTimestamp, unsubscribedAt: rightBeforeFromTimestamp }),
        TestObjects.randomSubscriber({ createdAt: rightAfterToTimestamp, confirmedAt: rightAfterToTimestamp, unsubscribedAt: rightAfterToTimestamp }),
        TestObjects.randomSubscriber({ createdAt: randomAfterToTimestamp, confirmedAt: null, unsubscribedAt: null })
    ];

    return { events, subscribers };
}

async function assertStatsViewEqual(viewPeriod, expectedStats) {
    const actualStatsView = await assertStatsViewOfPeriodExists(viewPeriod);
    const expectedStatsView = new StatsView(viewPeriod, expectedStats, clock.nowTimestamp());
    assert.deepEqual(actualStatsView, expectedStatsView);
}

async function assertStatsViewOfPeriodExists(period) {
    const views = await statsViews.views();

    const actualStatsView = views.filter(v => v.period == period);
    assert.lengthOf(actualStatsView, 1);

    return actualStatsView[0];
}

async function saveSubscribers(subscribers) {
    for (let s of subscribers) {
        await subscriberRepository.createReturningExisting(s);
    }
}

function deleteEvents() {
    return db.execute("DELETE FROM event");
}

function deleteSubscribers() {
    return db.execute("DELETE FROM subscriber");
}