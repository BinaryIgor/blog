import { expect, assert } from "chai";
import { serverIntTestSuite, SERVER_URL, awaitForNextScheduledTasksRun } from "../server-int-test-suite.js";
import { TestRequests, assertJsonResponse, assertResponseCode } from "../web-tests.js";
import { Stats, GeneralStats, ViewsBySource, PageStats } from "../../src/server/analytics.js";
import { randomString } from "../test-utils.js";
import { MAX_VISITOR_ID_LENGTH, MAX_PATH_LENGTH, MAX_IP_HASH_VISITOR_IDS_IN_LAST_DAY } from "../../src/server/analytics.js";
import { TestObjects } from "../test-objects.js";

const testRequests = new TestRequests(SERVER_URL);

serverIntTestSuite("Server integration tests", () => {
    invalidViews().forEach(v => {
        it('Should return 200 and ignore invalid view', async () => {
            const addViewResponse = await testRequests.addViewRequest(v);

            assertResponseCode(addViewResponse, 200);

            awaitForNextScheduledTasksRun();

            const statsResponse = await testRequests.getStats();

            assertJsonResponse(statsResponse, actualStats => {
                const emptyStats = new Stats(new GeneralStats(0, 0, []), []);
                assert.deepEqual(actualStats, emptyStats);
            });
        });
    })
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