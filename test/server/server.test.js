import { assert, expect } from "chai";
import {
    serverIntTestSuite, randomAllowedPostPath, allowedPostPaths,
    testClock, testRequests, failNextNPostsFetches, addPosts,
    assertAnalyticsEventsSavedAndStatsViewCalculated,
    assertAnalyticsEventsSaved,
    assertStatsViewsCalculated,
    subscriberRepository
} from "../server-int-test-suite.js";
import { assertConflictResponseCode, assertCreatedResponseCode, assertJsonResponse, assertOkResponseCode, assertResponseCode, assertUnauthenticatedResponseCode, assertUnprocessableContentResponseCode } from "../web-tests.js";
import { randomNumber, randomString } from "../test-utils.js";
import { MAX_PATH_LENGTH, MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY, DAY_SECONDS, ALL_TIME_STATS_VIEW, Stats } from "../../src/server/analytics.js";
import { TestObjects, VIEW_EVENT_TYPE, SCROLL_EVENT_TYPE, PING_EVENT_TYPE } from "../test-objects.js";
import { StatsTestFixture } from "../stats-test-fixture.js";
import { hashedIp } from "../../src/server/web.js";
import crypto from 'crypto';
import * as ButtondownApiStub from '../buttondown-api-stub.js';
import { ApiSubscriberType, Subscriber, SubscriberState } from "../../src/server/newsletter.js";
import { MAX_EMAIL_LENGTH } from "../../src/server/newsletter.js";

serverIntTestSuite("Server integration tests", () => {
    invalidEvents().forEach(e => {
        it(`ignores invalid ${JSON.stringify(e)} event and returns 200`, async () => {
            const eventResponse = await testRequests.postEvent(e);

            await assertAnalyticsEventsSavedAndStatsViewCalculated();

            assertOkResponseCode(eventResponse);

            const statsResponse = await testRequests.getStats();

            await assertEmptyStatsResponse(statsResponse);
        });
    })

    it('ignores not allowed path events and return 200', async () => {
        const view = TestObjects.randomEvent({ path: "/not-allowed.html", type: VIEW_EVENT_TYPE });
        const ping = TestObjects.randomEvent({ path: "/not-allowed.html", type: PING_EVENT_TYPE });

        const addViewResponse = await testRequests.postEvent(view);
        const addPingResponse = await testRequests.postEvent(ping);

        assertOkResponseCode(addViewResponse);
        assertOkResponseCode(addPingResponse);

        await assertAnalyticsEventsSavedAndStatsViewCalculated();

        const statsResponse = await testRequests.getStats();

        await assertEmptyStatsResponse(statsResponse);
    });

    it('rejects too many visitor ids per ip hash in a day', async () => {
        const ip = randomString();
        const anotherIp = randomString();
        const anotherIpViews = 3;
        const overLimitViews = 5;

        await addViewsFromIp(ip, MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY);

        await assertAnalyticsEventsSavedAndStatsViewCalculated();

        await assertStatsHaveViewsVisitorsAndIpHashes(
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY,
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY,
            1);

        await addViewsFromIp(anotherIp, anotherIpViews);
        await addViewsFromIp(ip, overLimitViews);

        await assertAnalyticsEventsSavedAndStatsViewCalculated();

        await assertStatsHaveViewsVisitorsAndIpHashes(
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews,
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews,
            2);

        testClock.moveTimeBy(DAY_SECONDS + 1);

        const limitExpiredViews = randomNumber(1, 10);

        await addViewsFromIp(ip, limitExpiredViews);

        await assertAnalyticsEventsSavedAndStatsViewCalculated();

        await assertStatsHaveViewsVisitorsAndIpHashes(
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews + limitExpiredViews,
            MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY + anotherIpViews + limitExpiredViews,
            2);
    });

    it('rejects too frequent pings per visitor id, path', async () => {
        const visitor1Id = crypto.randomUUID();
        const visitor2Id = crypto.randomUUID();
        const [path1, path2] = allowedPostPaths();

        await assertPingEventAdded(visitor1Id, path1);
        await assertPingEventAdded(visitor1Id, path2);
        await assertPingEventAdded(visitor2Id, path2);

        await assertStatsHavePingsAndPingers(3, 2);

        // max 1 ping per 20 seconds is allowed, so only two of the visitor1 pings will be added (different paths)
        testClock.moveTimeBy(20);
        for (let i = 0; i < 10; i++) {
            testClock.moveTimeBy(1);
            await assertPingEventAdded(visitor1Id, path1);
            await assertPingEventAdded(visitor1Id, path2);
        }
        await assertPingEventAdded(visitor2Id, path2);

        await assertStatsHavePingsAndPingers(6, 2);

        // pings are normally added every 30 seconds
        testClock.moveTimeBy(30);
        await assertPingEventAdded(visitor1Id, path1);
        await assertPingEventAdded(visitor1Id, path2);
        await assertPingEventAdded(visitor2Id, path2);
        testClock.moveTimeBy(30);
        await assertPingEventAdded(visitor1Id, path1);
        await assertPingEventAdded(visitor1Id, path2);
        await assertPingEventAdded(visitor2Id, path2);

        await assertStatsHavePingsAndPingers(12, 2);
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
        const ip1Ping1 = TestObjects.randomEvent({
            ipHash: ip1,
            path: allowedPostPath,
            visitorId: visitor1Id,
            source: source2Url,
            type: PING_EVENT_TYPE
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
        const ip2Ping1 = TestObjects.randomEvent({
            ipHash: ip2,
            path: allowedPostPath,
            visitorId: visitor2Id,
            source: source2Url,
            type: PING_EVENT_TYPE
        });
        const ip2Scroll1 = { ...ip2Ping1 };
        ip2Scroll1.type = SCROLL_EVENT_TYPE;
        ip2Scroll1.data = 50;

        const ip3View1 = TestObjects.randomEvent({
            ipHash: ip3,
            visitorId: visitor3Id,
            path: "/index.html",
            source: source1Url,
            type: VIEW_EVENT_TYPE
        });
        const ip3Ping1 = { ...ip3View1 };
        ip3Ping1.type = PING_EVENT_TYPE;
        ip3Ping1.data = 11;

        await addEventFromIp(ip1, ip1View1);
        await addEventFromIp(ip1, ip1View2);
        await addEventFromIp(ip1, ip1Ping1);
        await addEventFromIp(ip2, ip2View1);
        await addEventFromIp(ip2, ip2View2);
        await addEventFromIp(ip2, ip2Ping1);
        await addEventFromIp(ip2, ip2Scroll1);
        await addEventFromIp(ip3, ip3View1);
        await addEventFromIp(ip3, ip3Ping1);

        await assertAnalyticsEventsSavedAndStatsViewCalculated();

        const statsResponse = await testRequests.getStats();

        const expectedAllTimeStats = StatsTestFixture.eventsToExpectedStats({
            views: [ip1View1, ip1View2, ip2View1, ip2View2, ip3View1],
            scrolls: [ip2Scroll1],
            pings: [ip1Ping1, ip2Ping1, ip3Ping1]
        });

        await assertJsonResponse(statsResponse, actualStats => {
            const actualAllTimeStats = allTimeStatsView(actualStats);
            assert.deepEqual(actualAllTimeStats, expectedAllTimeStats);
        });
    });

    it(`allows to trigger post reload, retrying if necessary`, async () => {
        // 3 retries in test config. Next reload tests eventually successful reload
        failNextNPostsFetches(5);

        const failedReload = await testRequests.reloadPosts();

        assertResponseCode(failedReload, 500);

        const additionalPosts = ["a", "b"];

        addPosts(additionalPosts);

        const successfulReload = await testRequests.reloadPosts();

        await assertJsonResponse(successfulReload, actualResponse => {
            expect(actualResponse.knownPosts).to.include("/a.html", "/b.html");
        });
    });

    it('creates new subscriber idempotently', async () => {
        const subscriberEmail = TestObjects.randomEmail();
        const subscriberSignUpContext = TestObjects.randomSubscriberSignUpContext();
        const createResponseBody = { id: crypto.randomUUID(), source: "Some source", type: "Some type" };

        ButtondownApiStub.nextCreateSubscriberResponse({
            status: 201,
            expectedEmailAddress: subscriberEmail,
            body: createResponseBody
        });

        const createSubscriberResponse = await testRequests.postNewsletterSubscriber({
            email: subscriberEmail, ...subscriberSignUpContext
        });
        assertCreatedResponseCode(createSubscriberResponse);

        const expectedSubscriber = Subscriber.newOne(subscriberEmail, testClock.nowTimestamp(), subscriberSignUpContext,
            {
                externalId: createResponseBody.id,
                externalSource: createResponseBody.source,
                externalType: createResponseBody.type
            });
        assertSubscriberSavedInDb(expectedSubscriber);


        //and when trying to create existing subscriber, return 409
        const createExistingSubscriberResponse = await testRequests.postNewsletterSubscriber({
            email: subscriberEmail, ...subscriberSignUpContext
        });
        assertConflictResponseCode(createExistingSubscriberResponse);
    });

    [SubscriberState.CREATED, SubscriberState.CONFIRMED].forEach(state =>
        it('creates new subscriber returning 409 if it exists in the API', async () => {
            const subscriber = TestObjects.randomSubscriber({ state });
            await saveSubscriberInDb(subscriber);

            ButtondownApiStub.nextCreateSubscriberResponse({ status: 409, expectedEmailAddress: subscriber.email });

            const createExistingSubscriberResponse = await testRequests.postNewsletterSubscriber({
                email: subscriber.email, ...subscriber.signUpContext
            });
            assertConflictResponseCode(createExistingSubscriberResponse);
        }));

    invalidSubscribers().forEach(s => {
        it(`returns 422 when trying to create subscriber with invalid data ${JSON.stringify(s)}`, async () => {
            const createSubscriberResponse = await testRequests.postNewsletterSubscriber(s);
            assertUnprocessableContentResponseCode(createSubscriberResponse);
            assertSubscriberNotSavedInDb(s.email);
        })
    });

    it('resubscribes previous subscriber', async () => {
        const unsubscribedSubscriber = TestObjects.randomSubscriber({ state: SubscriberState.UNSUBSCRIBED, externalType: ApiSubscriberType.Unsubscribed });
        await saveSubscriberInDb(unsubscribedSubscriber);
        // to have different signedUpAt than createdAt
        testClock.moveTimeByReasonableAmount();

        ButtondownApiStub.nextGetSubscriberResponse({
            status: 200,
            expectedEmailOrId: unsubscribedSubscriber.email,
            body: TestObjects.randomApiSubscriber({
                id: unsubscribedSubscriber.externalId,
                email_address: unsubscribedSubscriber.email,
                type: unsubscribedSubscriber.externalType
            })
        });
        ButtondownApiStub.nextUpdateSubscriberResponse({
            status: 200,
            expectedEmailOrId: unsubscribedSubscriber.email,
            expectedType: ApiSubscriberType.Regular,
            body: {}
        });

        const createSubscriberResponse = await testRequests.postNewsletterSubscriber({
            email: unsubscribedSubscriber.email, ...TestObjects.randomSubscriberSignUpContext()
        });
        assertCreatedResponseCode(createSubscriberResponse);

        const expectedSubscriber = {
            ...unsubscribedSubscriber,
            externalType: ApiSubscriberType.Regular,
            signedUpAt: testClock.nowTimestamp()
        };
        assertSubscriberSavedInDb(expectedSubscriber);
    });

    it('accepts signed webhook newsletter event', async () => {
        const { event, signature } = someSignedWebhookEvent();
        const postEventResponse = await testRequests.postWebhookNewsletterEvent(event,
            { "X-Buttondown-Signature": signature });
        assertOkResponseCode(postEventResponse);
    });

    it('rejects unsigned webhook newsletter event', async () => {
        const { event } = someSignedWebhookEvent();
        const postEventResponse = await testRequests.postWebhookNewsletterEvent(event);
        assertUnauthenticatedResponseCode(postEventResponse);
    });

    it('rejects webhook newsletter event with invalid signature', async () => {
        const { event, signature } = someSignedWebhookEvent();
        const postEventResponse = await testRequests.postWebhookNewsletterEvent(event,
            { "X-Buttondown-Signature": signature + "0" }
        );
        assertUnauthenticatedResponseCode(postEventResponse);
    });

    it('rejects webhook newsletter event signed with a different key', async () => {
        const { event, signature } = ButtondownApiStub.signedWebhookEvent("dummy_type", { someData: "some data" },
            "some diferent key"
        );
        const postEventResponse = await testRequests.postWebhookNewsletterEvent(event,
            { "X-Buttondown-Signature": signature }
        );
        assertUnauthenticatedResponseCode(postEventResponse);
    });
});

function invalidEvents() {
    const scrollPingInvalidData = [
        null,
        " ",
        "should be an integer",
        -1,
        151
    ];

    // more detailed unit tests are in validator.test.js - minimal and/or lacking cases here!
    return [
        {

        },
        TestObjects.randomEvent({ source: "" }),
        TestObjects.randomEvent({ type: "NEITHER_VIEW_NOR_READ_NOR_SCROLL" }),
        TestObjects.randomEvent({ type: "" }),
        TestObjects.randomEvent({ visitorId: "" }),
        TestObjects.randomEvent({ visitorId: randomString() }),
        TestObjects.randomEvent({ path: null }),
        TestObjects.randomEvent({ path: "" }),
        TestObjects.randomEvent({ path: MAX_PATH_LENGTH + 1 }),
        ...scrollPingInvalidData.flatMap(data => [
            TestObjects.randomEvent({ type: SCROLL_EVENT_TYPE, data }),
            TestObjects.randomEvent({ type: PING_EVENT_TYPE, data })
        ]),
    ]
}

async function assertEmptyStatsResponse(response) {
    await assertJsonResponse(response, actualStats => {
        actualStats.forEach(as => {
            assert.deepEqual(as.stats, Stats.empty());
        });
    });
}

async function assertStatsHaveViewsVisitorsAndIpHashes(views, visitors, iphashes) {
    await assertJsonResponse(await testRequests.getStats(), actualStats => {
        const allTimeStats = allTimeStatsView(actualStats);
        assert.deepEqual(allTimeStats.views, views);
        assert.deepEqual(allTimeStats.visitors, visitors);
        assert.deepEqual(allTimeStats.ipHashes, iphashes);
    });
}

async function assertStatsHavePingsAndPingers(pings, pingers) {
    await assertStatsViewsCalculated();
    assertJsonResponse(await testRequests.getStats(), actualStats => {
        const allTimePingsStats = allTimeStatsView(actualStats).pings.all;
        assert.deepEqual(allTimePingsStats.events, pings);
        assert.deepEqual(allTimePingsStats.ids, pingers);
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
    const response = await testRequests.postEvent(event, { "X-Real-Ip": ip });
    assertOkResponseCode(response);
}

async function addEvent(event) {
    const response = await testRequests.postEvent(event);
    assertOkResponseCode(response);
}

async function assertPingEventAdded(visitorId, path) {
    await addEvent(TestObjects.randomEvent({ visitorId, path, type: PING_EVENT_TYPE }));
    await assertAnalyticsEventsSaved();
}

function statsViewOfPeriod(statsViews, period) {
    return statsViews.find(sv => sv.period == period);
}

function allTimeStatsView(statsView) {
    return statsViewOfPeriod(statsView, ALL_TIME_STATS_VIEW).stats;
}

async function assertSubscriberSavedInDb(expectedSubscriber) {
    const dbSubscriber = await subscriberRepository.ofEmail(expectedSubscriber.email);
    assert.deepEqual(dbSubscriber, expectedSubscriber);
}

async function assertSubscriberNotSavedInDb(email) {
    assert.isNull(await subscriberRepository.ofEmail(email));
}

async function saveSubscriberInDb(subscriber) {
    await subscriberRepository.createReturningExisting(subscriber);
}

function invalidSubscribers() {
    return [
        {
            email: null, ...TestObjects.randomSubscriberSignUpContext()
        },
        {
            email: '', ...TestObjects.randomSubscriberSignUpContext()
        },
        {
            email: '2355', ...TestObjects.randomSubscriberSignUpContext()
        },
        {
            email: '@com.c', ...TestObjects.randomSubscriberSignUpContext()
        },
        {
            email: 'ala@com', ...TestObjects.randomSubscriberSignUpContext()
        },
        {
            email: "a".repeat(MAX_EMAIL_LENGTH) + "@email.com", ...TestObjects.randomSubscriberSignUpContext()
        },
        {
            email: TestObjects.randomEmail(), ...TestObjects.randomSubscriberSignUpContext({ source: null })
        },
        {
            email: TestObjects.randomEmail(), ...TestObjects.randomSubscriberSignUpContext({ placement: null })
        },
        {
            email: TestObjects.randomEmail(), ...TestObjects.randomSubscriberSignUpContext({ placement: "not in allowed set" })
        }
    ];
}

function someSignedWebhookEvent() {
    return ButtondownApiStub.signedWebhookEvent("dummy_type", { someData: "some data" });
}