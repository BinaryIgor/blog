import { expect, assert } from "chai";
import { serverIntTestSuite, SERVER_URL, nextScheduledTasksRunDelay, randomAllowedPostPath } from "../server-int-test-suite.js";
import { TestRequests, assertJsonResponse, assertOkResponseCode, assertResponseCode } from "../web-tests.js";
import { Stats, GeneralStats, ViewsBySource, PageStats } from "../../src/server/analytics.js";
import { randomString } from "../test-utils.js";
import { MAX_PATH_LENGTH, MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY } from "../../src/server/analytics.js";
import { TestObjects } from "../test-objects.js";
import { hashedIp } from "../../src/server/web.js";
import crypto from 'crypto';

const testRequests = new TestRequests(SERVER_URL);

serverIntTestSuite("Server integration tests", () => {
    invalidViews().forEach(v => {
        it('should ignore invalid view and return 200', async () => {
            const addViewResponse = await testRequests.addViewRequest(v);

            assertOkResponseCode(addViewResponse);

            await nextScheduledTasksRunDelay();

            const statsResponse = await testRequests.getStats();

            assertEmptyStatsResponse(statsResponse);
        });
    })

    it('should ignore not allowed path view and return 200', async () => {
        const view = TestObjects.randomView({ path: "/not-allowed.html" });
        const addViewResponse = await testRequests.addViewRequest(view);

        assertOkResponseCode(addViewResponse);

        await nextScheduledTasksRunDelay();

        const statsResponse = await testRequests.getStats();

        assertEmptyStatsResponse(statsResponse);
    });

    it('should add views', async () => {
        const ip1 = hashedIp(randomString());
        const ip2 = hashedIp(randomString());
        const visitor1Id = crypto.randomUUID();
        const visitor2Id = crypto.randomUUID();

        const source1Url = "https://google.com?search=sth";
        const source2Url = "https://binaryigor.com";
        const source1 = "google.com";
        const source2 = "binaryigor.com";

        const allowedPostPath = randomAllowedPostPath();

        const ip1View1 = TestObjects.randomView({
            ipHash: ip1,
            visitorId: visitor1Id,
            path: "/index.html",
            source: source1Url
        });
        const ip1View2 = TestObjects.randomView({
            ipHash: ip1,
            path: allowedPostPath,
            visitorId: visitor1Id,
            source: source2Url
        });

        const ip2View1 = TestObjects.randomView({
            ipHash: ip2,
            path: "/index.html",
            visitorId: visitor1Id,
            source: source1Url
        });

        const ip2View2 = TestObjects.randomView({
            ipHash: ip2,
            path: "/index.html",
            visitorId: visitor2Id,
            source: source2Url
        });

        const addIp1View1Response = await testRequests.addViewRequest(ip1View1);
        const addIp1View2Response = await testRequests.addViewRequest(ip1View2);
        const addIp2View1Response = await testRequests.addViewRequest(ip2View1);
        const addIp2View2Response = await testRequests.addViewRequest(ip2View2);

        assertOkResponseCode(addIp1View1Response);
        assertOkResponseCode(addIp1View2Response);
        assertOkResponseCode(addIp2View1Response);
        assertOkResponseCode(addIp2View2Response);

        await nextScheduledTasksRunDelay();

        const statsResponse = await testRequests.getStats();

        const expectedStats = new Stats(
            new GeneralStats(4, 2, 
                [
                    new ViewsBySource(source1, 50),
                    new ViewsBySource(source2, 50),
                ]),
            [
                new PageStats("/index.html", 3, 2),
                new PageStats(allowedPostPath, 1, 1)
            ]
        );

        assertJsonResponse(statsResponse, actualStats => {
            assert.deepEqual(actualStats, expectedStats);
        });
    });
});

function invalidViews() {
    return [
        {

        },
        TestObjects.randomView({ source: "invalid-url" }),
        TestObjects.randomView({ visitorId: "" }),
        TestObjects.randomView({ visitorId: randomString() }),
        TestObjects.randomView({ path: "" }),
        TestObjects.randomView({ path: MAX_PATH_LENGTH + 1 })
    ]
}

function assertEmptyStatsResponse(response) {
    assertJsonResponse(response, actualStats => {
        const emptyStats = new Stats(new GeneralStats(0, 0, []), []);
        assert.deepEqual(actualStats, emptyStats);
    });
}