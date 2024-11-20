import { assert, expect } from "chai";
import {
    serverIntTestSuite, randomAllowedPostPath,
    testClock, testRequests, failNextNPostsFetches, addPosts,
    assertAnalyticsEventsSavedStatsViewCalculated
} from "../server-int-test-suite.js";
import { assertJsonResponse, assertOkResponseCode, assertResponseCode } from "../web-tests.js";
import { Stats, ViewsBySource, PageStats, ALL_TIME_STATS_VIEW } from "../../src/server/analytics.js";
import { randomNumber, randomString } from "../test-utils.js";
import { MAX_PATH_LENGTH, MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY, DAY_SECONDS } from "../../src/server/analytics.js";
import { TestObjects, VIEW_EVENT_TYPE, READ_EVENT_TYPE, SCROLL_EVENT_TYPE } from "../test-objects.js";
import { hashedIp } from "../../src/server/web.js";
import crypto from 'crypto';

serverIntTestSuite("Server integration tests", () => {
    invalidEvents().forEach(v => {
        it('ignores invalid event and returns 200', async () => {
            const addEventResponse = await testRequests.addEventRequest(v);

            await assertAnalyticsEventsSavedStatsViewCalculated();

            assertOkResponseCode(addEventResponse);

            const statsResponse = await testRequests.getStats();

            assertEmptyStatsResponse(statsResponse);
        });
    })

    it('ignores not allowed path events and return 200', async () => {
        const view = TestObjects.randomEvent({ path: "/not-allowed.html", type: VIEW_EVENT_TYPE });
        const read = TestObjects.randomEvent({ path: "/not-allowed.html", type: READ_EVENT_TYPE });

        const addViewResponse = await testRequests.addEventRequest(view);
        const addReadResponse = await testRequests.addEventRequest(read);

        assertOkResponseCode(addViewResponse);
        assertOkResponseCode(addReadResponse);

        await assertAnalyticsEventsSavedStatsViewCalculated();

        const statsResponse = await testRequests.getStats();

        assertEmptyStatsResponse(statsResponse);
    });

    it('rejects too many visitor ids per ip hash in a day', async () => {
        const ip = randomString();
        const anotherIp = randomString();
        const anotherIpViews = 3;
        const overLimitViews = 5;

        await addViewsFromIp(ip, MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY);

        await assertAnalyticsEventsSavedStatsViewCalculated();

        await assertStatsHaveViewsUniqueVisitorsAndIpHashes(
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY,
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY,
            1);

        await addViewsFromIp(anotherIp, anotherIpViews);
        await addViewsFromIp(ip, overLimitViews);

        await assertAnalyticsEventsSavedStatsViewCalculated();

        await assertStatsHaveViewsUniqueVisitorsAndIpHashes(
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews,
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews,
            2);

        testClock.moveTimeBy(DAY_SECONDS + 1);

        const limitExpiredViews = randomNumber(1, 10);

        await addViewsFromIp(ip, limitExpiredViews);

        await assertAnalyticsEventsSavedStatsViewCalculated();

        await assertStatsHaveViewsUniqueVisitorsAndIpHashes(
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews + limitExpiredViews,
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews + limitExpiredViews,
            2);
    });

    // for more detailed, time-based test-cases, check out stats-views.test
    it('adds various events', async () => {
        const ip1 = hashedIp(randomString());
        const ip2 = hashedIp(randomString());
        const ip3 = hashedIp(randomString());
        const visitor1Id = crypto.randomUUID();
        const visitor2Id = crypto.randomUUID();
        const visitor3Id = crypto.randomUUID();

        const source1Url = "https://google.com?search=sth";
        const source2Url = "https://binaryigor.com";
        const source1 = "google.com";
        const source2 = "binaryigor.com";

        const allowedPostPath = randomAllowedPostPath();

        const ip1View1 = TestObjects.randomEvent({
            ipHash: ip1,
            visitorId: visitor1Id,
            path: "/index.html",
            source: source1Url,
            type: VIEW_EVENT_TYPE
        });
        const ip1View2 = TestObjects.randomEvent({
            ipHash: ip1,
            path: allowedPostPath,
            visitorId: visitor1Id,
            source: source2Url,
            type: VIEW_EVENT_TYPE
        });
        const ip1Read1 = TestObjects.randomEvent({
            ipHash: ip1,
            path: allowedPostPath,
            visitorId: visitor1Id,
            source: source2Url,
            type: READ_EVENT_TYPE
        });

        const ip2View1 = TestObjects.randomEvent({
            ipHash: ip2,
            path: "/index.html",
            visitorId: visitor1Id,
            source: source1Url,
            type: VIEW_EVENT_TYPE
        });
        const ip2View2 = TestObjects.randomEvent({
            ipHash: ip2,
            path: "/index.html",
            visitorId: visitor2Id,
            source: source2Url,
            type: VIEW_EVENT_TYPE
        });
        const ip2Read1 = TestObjects.randomEvent({
            ipHash: ip2,
            path: allowedPostPath,
            visitorId: visitor2Id,
            source: source2Url,
            type: READ_EVENT_TYPE
        });
        const ip2Scroll1 = { ...ip2Read1 };
        ip2Scroll1.type = SCROLL_EVENT_TYPE;

        const ip3View1 = TestObjects.randomEvent({
            ipHash: ip3,
            visitorId: visitor3Id,
            path: "/index.html",
            source: source1Url,
            type: VIEW_EVENT_TYPE
        });

        await addEventFromIp(ip1, ip1View1);
        await addEventFromIp(ip1, ip1View2);
        await addEventFromIp(ip1, ip1Read1);
        await addEventFromIp(ip2, ip2View1);
        await addEventFromIp(ip2, ip2View2);
        await addEventFromIp(ip2, ip2Read1);
        await addEventFromIp(ip2, ip2Scroll1);
        await addEventFromIp(ip3, ip3View1);

        await assertAnalyticsEventsSavedStatsViewCalculated();

        const statsResponse = await testRequests.getStats();

        const expectedAllTimeStats = new Stats(5, 3, 3, 2, 2, 1, 1,
            [
                new ViewsBySource(source1, 3),
                new ViewsBySource(source2, 2),
            ],
            [
                new PageStats("/index.html", 4, 0, 0, 3, 0, 0),
                new PageStats(allowedPostPath, 1, 2, 1, 1, 2, 1)
            ]);

        assertJsonResponse(statsResponse, actualStats => {
            const actualAllTimeStats = allTimeStatsView(actualStats).stats;
            assert.deepEqual(actualAllTimeStats, expectedAllTimeStats);
        });
    });

    it(`allows to trigger post reload, retrying if necessary`, async function () {
        // 3 retries in test config. Next reload tests eventually successful reload
        failNextNPostsFetches(5);

        const failedReload = await testRequests.reloadPosts();

        assertResponseCode(failedReload, 500);

        const additionalPosts = ["a", "b"];

        addPosts(additionalPosts);

        const successfulReload = await testRequests.reloadPosts();

        assertJsonResponse(successfulReload, actualResponse => {
            expect(actualResponse.knownPosts).to.include("/a.html", "/b.html");
        });
    });
});

function invalidEvents() {
    return [
        {

        },
        TestObjects.randomEvent({ source: "invalid-url" }),
        TestObjects.randomEvent({ type: "NEITHER_VIEW_NOR_READ_NOR_SCROLL" }),
        TestObjects.randomEvent({ type: "" }),
        TestObjects.randomEvent({ visitorId: "" }),
        TestObjects.randomEvent({ visitorId: randomString() }),
        TestObjects.randomEvent({ path: "" }),
        TestObjects.randomEvent({ path: MAX_PATH_LENGTH + 1 })
    ]
}

function assertEmptyStatsResponse(response) {
    assertJsonResponse(response, actualStats => {
        const emptyStats = new Stats(0, 0, 0, 0, 0, 0, 0, [], []);
        actualStats.forEach(as => {
            assert.deepEqual(as.stats, emptyStats);
        });
    });
}

async function assertStatsHaveViewsUniqueVisitorsAndIpHashes(views, visitors, iphashes) {
    assertJsonResponse(await testRequests.getStats(), actualStats => {
        const allTimeStats = allTimeStatsView(actualStats).stats;
        assert.deepEqual(allTimeStats.views, views);
        assert.deepEqual(allTimeStats.uniqueVisitors, visitors);
        assert.deepEqual(allTimeStats.ipHashes, iphashes);
    });
}

async function addViewsFromIp(ip, events) {
    return addEventsFromIp(ip, events, VIEW_EVENT_TYPE);
}

async function addEventsFromIp(ip, events, type) {
    for (let i = 0; i < events; i++) {
        await addEventFromIp(ip, TestObjects.randomEvent({ type: type }));
    }
}

async function addEventFromIp(ip, event = null) {
    if (!event) {
        event = TestObjects.randomEvent({ ipHash: ip });
    }
    const response = await testRequests.addEventRequest(event, { "X-Real-Ip": ip });
    assertOkResponseCode(response);
}

function statsViewOfPeriod(statsViews, period) {
    return statsViews.find(sv => sv.period == period);
}

function allTimeStatsView(statsView) {
    return statsViewOfPeriod(statsView, ALL_TIME_STATS_VIEW);
}