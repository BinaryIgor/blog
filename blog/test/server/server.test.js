import { expect, assert } from "chai";
import { serverIntTestSuite } from "../server-int-test-suite.js";

serverIntTestSuite("Server integration tests", () => {
    it('Should run tests', () => {
        assert.equal(1, 2);
    });
})