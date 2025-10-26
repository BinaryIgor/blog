import { assert } from "chai";
import {
    serverIntTestSuite, randomAllowedPostPath, allowedPostPaths,
    testClock, testRequests, failNextNPostsFetches, addPosts,
    assertAnalyticsEventsSavedAndStatsViewCalculated,
    assertAnalyticsEventsSaved,
    assertStatsViewsCalculated,
    subscriberRepository, newsletterWebhookHandler
} from "../server-int-test-suite.js";
import { TestObjects } from "../test-objects.js";
import { ApiSubscriberType, NewsletterWebhookEventType, Subscriber, SubscriberState } from "../../src/server/newsletter.js";
import * as Dates from "../../src/shared/dates.js";
import * as ButtonDownApiStub from '../button-down-api-stub.js';

serverIntTestSuite('NewsletterWebhookHandler integration tests', () => {
    it(`handles ${NewsletterWebhookEventType.SUBSCRIBER_CREATED} event when subscriber exists`, async () => {
        const existingSubscriber = await saveSubscriberInDb(TestObjects.randomSubscriber());
        await assertSubscriberSavedInDb(existingSubscriber);

        const externalId = crypto.randomUUID();
        ButtonDownApiStub.nextGetSubscriberResponse({
            status: 200,
            emailOrId: externalId,
            body: TestObjects.randomApiSubscriber({ id: externalId, email_address: existingSubscriber.email })
        });

        const event = subscriberEvent(NewsletterWebhookEventType.SUBSCRIBER_CREATED, externalId);
        await newsletterWebhookHandler.handle(event);

        await assertSubscriberSavedInDb(existingSubscriber);
    });

    it(`handles ${NewsletterWebhookEventType.SUBSCRIBER_CREATED} event when subscriber does not exist`, async () => {
        const subscriberId = crypto.randomUUID();
        const apiSubscriber = TestObjects.randomApiSubscriber({ id: subscriberId });
        ButtonDownApiStub.nextGetSubscriberResponse({
            status: 200,
            emailOrId: subscriberId,
            body: apiSubscriber
        });

        const event = subscriberEvent(NewsletterWebhookEventType.SUBSCRIBER_CREATED, subscriberId);
        await newsletterWebhookHandler.handle(event);

        const expectedSubscriber = Subscriber.newOne(apiSubscriber.email_address, testClock.nowTimestamp(), null, {
            externalId: subscriberId,
            externalSource: apiSubscriber.source,
            externalType: apiSubscriber.type
        });
        await assertSubscriberSavedInDb(expectedSubscriber);
    });

    it(`handles ${NewsletterWebhookEventType.SUBSCRIBER_CONFIRMED} event`, async () => {
        const subscriber = await saveSubscriberInDb(TestObjects.randomSubscriber({ state: SubscriberState.CREATED }));

        const externalId = crypto.randomUUID();
        const apiSubscriber = TestObjects.randomApiSubscriber({ id: externalId, email_address: subscriber.email });
        ButtonDownApiStub.nextGetSubscriberResponse({
            status: 200,
            emailOrId: externalId,
            body: apiSubscriber
        });

        const event = subscriberEvent(NewsletterWebhookEventType.SUBSCRIBER_CONFIRMED, externalId);
        await newsletterWebhookHandler.handle(event);

        const expectedSubscriber = {
            ...subscriber,
            externalId: apiSubscriber.id,
            externalSource: apiSubscriber.source,
            externalType: apiSubscriber.type,
            confirmedAt: testClock.nowTimestamp(),
            state: SubscriberState.CONFIRMED
        };
        await assertSubscriberSavedInDb(expectedSubscriber);
    });

    it(`handles ${NewsletterWebhookEventType.SUBSCRIBER_UNSUBSCRIBED} event`, async () => {
        const externalId = crypto.randomUUID();
        const subscriber = await saveSubscriberInDb(TestObjects.randomSubscriber({ externalId, state: SubscriberState.CONFIRMED }));

        const apiSubscriber = TestObjects.randomApiSubscriber({ id: externalId, email_address: subscriber.email, type: ApiSubscriberType.Unsubscribed });
        ButtonDownApiStub.nextGetSubscriberResponse({
            status: 200,
            emailOrId: externalId,
            body: apiSubscriber
        });

        const event = subscriberEvent(NewsletterWebhookEventType.SUBSCRIBER_UNSUBSCRIBED, externalId);
        await newsletterWebhookHandler.handle(event);

        const expectedSubscriber = {
            ...subscriber,
            unsubscribedAt: Dates.timestampFromIsoDateTime(apiSubscriber.unsubscription_date),
            unsubscribedReason: apiSubscriber.unsubscription_reason,
            state: SubscriberState.UNSUBSCRIBED
        };
        await assertSubscriberSavedInDb(expectedSubscriber);
    });

    it(`handles ${NewsletterWebhookEventType.SUBSCRIBER_DELETED} event`, async () => {
        const externalId = crypto.randomUUID();
        const subscriber = await saveSubscriberInDb(TestObjects.randomSubscriber({ externalId }));
        await assertSubscriberSavedInDb(subscriber);

        const event = subscriberEvent(NewsletterWebhookEventType.SUBSCRIBER_DELETED, externalId);
        await newsletterWebhookHandler.handle(event);

        await assertSubscriberDoesNotExistInDb(subscriber.email);
    });

    it(`handles ${NewsletterWebhookEventType.SUBSCRIBER_CLICKED} event`, async () => {
        const externalId = crypto.randomUUID();
        const subscriber = await saveSubscriberInDb(TestObjects.randomSubscriber({ externalId }));

        const apiSubscriber = TestObjects.randomApiSubscriber({
            id: externalId, email_address: subscriber.email,
            last_click_date: "2025-10-27T22:00:00+00:00"
        });
        ButtonDownApiStub.nextGetSubscriberResponse({
            status: 200,
            emailOrId: externalId,
            body: apiSubscriber
        });

        const event = subscriberEvent(NewsletterWebhookEventType.SUBSCRIBER_CLICKED, externalId);
        await newsletterWebhookHandler.handle(event);

        const expectedSubscriber = {
            ...subscriber,
            lastClickedAt: Dates.timestampFromIsoDateTime(apiSubscriber.last_click_date),
        };
        await assertSubscriberSavedInDb(expectedSubscriber);
    });

    it(`handles ${NewsletterWebhookEventType.SUBSCRIBER_OPENED} event`, async () => {
        const externalId = crypto.randomUUID();
        const subscriber = await saveSubscriberInDb(TestObjects.randomSubscriber({ externalId }));

        const apiSubscriber = TestObjects.randomApiSubscriber({
            id: externalId, email_address: subscriber.email,
            last_open_date: "2025-10-28T22:11:00+00:00"
        });
        ButtonDownApiStub.nextGetSubscriberResponse({
            status: 200,
            emailOrId: externalId,
            body: apiSubscriber
        });

        const event = subscriberEvent(NewsletterWebhookEventType.SUBSCRIBER_OPENED, externalId);
        await newsletterWebhookHandler.handle(event);

        const expectedSubscriber = {
            ...subscriber,
            lastOpenedAt: Dates.timestampFromIsoDateTime(apiSubscriber.last_open_date),
        };
        await assertSubscriberSavedInDb(expectedSubscriber);
    });
});

async function saveSubscriberInDb(subscriber) {
    return await subscriberRepository.createReturningExisting(subscriber);
}

async function assertSubscriberSavedInDb(expectedSubscriber) {
    const dbSubscriber = await subscriberRepository.ofEmail(expectedSubscriber.email);
    assert.deepEqual(dbSubscriber, expectedSubscriber);
}

async function assertSubscriberDoesNotExistInDb(email) {
    assert.isNull(await subscriberRepository.ofEmail(email));
}

function subscriberEvent(type, subscriberId) {
    return { type, data: { subscriber: subscriberId } };
}