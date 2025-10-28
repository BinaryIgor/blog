import { assert } from "chai";
import {
    serverIntTestSuite, newsletterWebhookSynchronizer, appConfig
} from "../server-int-test-suite.js";
import { TestObjects } from "../test-objects.js";
import { NewsletterWebhookEventTypes }
    from "../../src/server/newsletter.js";
import * as ButtondownApiStub from '../buttondown-api-stub.js';

serverIntTestSuite('NewsletterWebhookSynchronizer integration tests', () => {
    it(`creates new webhook when there are none`, async () => {
        ButtondownApiStub.nextGetWebhooksResponse({
            status: 200,
            body: {
                results: []
            }
        });
        ButtondownApiStub.nextCreateWebhookResponse({
            status: 201,
            assertReceivedExpectedBody: (received) => assert.deepEqual(received, expectedWebhook())
        });

        await newsletterWebhookSynchronizer.synchronize();
    });

    it(`creates new webhook when there are different ones`, async () => {
        ButtondownApiStub.nextGetWebhooksResponse({
            status: 200,
            body: {
                results: [
                    TestObjects.randomWebhook(),
                    TestObjects.randomWebhook()
                ]
            }
        });
        ButtondownApiStub.nextCreateWebhookResponse({
            status: 201,
            assertReceivedExpectedBody: (received) => assert.deepEqual(received, expectedWebhook())
        });

        await newsletterWebhookSynchronizer.synchronize();
    });

    it(`updates webhook when there is a different one`, async () => {
        const existingWebhookId = crypto.randomUUID();
        const existingWebhook = { ...expectedWebhook(), signing_key: "diff key", id: existingWebhookId };
        ButtondownApiStub.nextGetWebhooksResponse({
            status: 200,
            body: {
                results: [
                    TestObjects.randomWebhook(),
                    TestObjects.randomWebhook(),
                    existingWebhook
                ]
            }
        });
        ButtondownApiStub.nextUpdateWebhookResponse({
            status: 200,
            expectedId: existingWebhookId,
            assertReceivedExpectedBody: (received) => assert.deepEqual(received, expectedWebhook())
        });

        await newsletterWebhookSynchronizer.synchronize();
    });

    it(`throws exception when there is more than one webhook to update`, async () => {
        ButtondownApiStub.nextGetWebhooksResponse({
            status: 200,
            body: {
                results: [
                    TestObjects.randomWebhook(),
                    { ...expectedWebhook(), id: crypto.randomUUID() },
                    { ...expectedWebhook(), id: crypto.randomUUID() }
                ]
            }
        });
        let error;
        try {
            await newsletterWebhookSynchronizer.synchronize();
            error = null;
        } catch (e) {
            error = e.message;
        }
        assert.equal(
            error,
            "Expected to get no webhooks to update or just one, but got: 2. Delete them first and rerun the process");
    });
});

function expectedWebhook() {
    return {
        status: "enabled",
        event_types: NewsletterWebhookEventTypes,
        url: appConfig.buttondownWebhookUrl,
        description: appConfig.buttondownWebhookDescription,
        signing_key: appConfig.buttondownWebhookSigningKey
    };
}