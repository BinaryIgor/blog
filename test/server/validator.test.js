import { assert } from "chai";
import * as Validator from '../../src/server/validator.js';
import { randomString } from "../test-utils.js";

describe("Validator tests", () => {
    invalidEventContextsWithExpectedErrors().forEach(e => {
        it(`throws detailed exception given invalid ${JSON.stringify(e.ctx)} event context`, () => {
            assert.throws(() => Validator.validateEventContext(e.ctx), e.error);
        });
    })

    validEventContexts().forEach(ctx => {
        it(`does not throw exception given valid ${JSON.stringify(ctx)} event context`, () => {
            assert.doesNotThrow(() => Validator.validateEventContext(ctx));
        });
    })
});


function invalidEventContextsWithExpectedErrors() {
    const emptyOrTooLongVisitorIdError = `VisitorId should not be empty and have max ${Validator.MAX_ID_LENGTH} characters`;
    const emptyOrTooLongSessionIdError = `SessionId should not be empty and have max ${Validator.MAX_ID_LENGTH} characters`;
    const invalidSourceError = `Source should not be empty and have max ${Validator.MAX_SOURCE_LENGTH} characters`;
    const invalidMediumError = `Medium can have up to ${Validator.MAX_MEDIUM_LENGTH} characters`;
    const invalidCampaignError = `Campaign can have up to ${Validator.MAX_CAMPAIGN_LENGTH} characters`;
    const invalidRefError = `Ref can have up to ${Validator.MAX_REF_LENGTH} characters`;
    const invalidPathError = `Path should not be empty and have max ${Validator.MAX_PATH_LENGTH} characters`;

    return [
        {
            ctx: {},
            error: emptyOrTooLongVisitorIdError
        },
        {
            ctx: { ...validEventContext(), visitorId: null },
            error: emptyOrTooLongVisitorIdError
        },
        {
            ctx: { ...validEventContext(), visitorId: undefined },
            error: emptyOrTooLongVisitorIdError
        },
        {
            ctx: { ...validEventContext(), visitorId: "" },
            error: emptyOrTooLongVisitorIdError
        },
        {
            ctx: { ...validEventContext(), visitorId: randomString(Validator.MAX_ID_LENGTH + 1) },
            error: emptyOrTooLongVisitorIdError
        },
        {
            ctx: { ...validEventContext(), visitorId: "ae7a3f16-ea8f-3452" },
            error: "VisitorId should be valid UUID but was: ae7a3f16-ea8f-3452"
        },
        {
            ctx: { ...validEventContext(), sessionId: null },
            error: emptyOrTooLongSessionIdError
        },
        {
            ctx: { ...validEventContext(), sessionId: undefined },
            error: emptyOrTooLongSessionIdError
        },
        {
            ctx: { ...validEventContext(), sessionId: "" },
            error: emptyOrTooLongSessionIdError
        },
        {
            ctx: { ...validEventContext(), sessionId: randomString(Validator.MAX_ID_LENGTH + 1) },
            error: emptyOrTooLongSessionIdError
        },
        {
            ctx: { ...validEventContext(), sessionId: "ae7a3f16-ea8f-9934" },
            error: "SessionId should be valid UUID but was: ae7a3f16-ea8f-9934"
        },
        {
            ctx: { ...validEventContext(), source: null },
            error: invalidSourceError
        },
        {
            ctx: { ...validEventContext(), source: undefined },
            error: invalidSourceError
        },
        {
            ctx: { ...validEventContext(), source: "" },
            error: invalidSourceError
        },
        {
            ctx: { ...validEventContext(), source: randomString(Validator.MAX_SOURCE_LENGTH + 1) },
            error: invalidSourceError
        },
        {
            ctx: { ...validEventContext(), medium: randomString(Validator.MAX_MEDIUM_LENGTH + 1) },
            error: invalidMediumError
        },
        {
            ctx: { ...validEventContext(), campaign: randomString(Validator.MAX_CAMPAIGN_LENGTH + 1) },
            error: invalidCampaignError
        },
        {
            ctx: { ...validEventContext(), ref: randomString(Validator.MAX_REF_LENGTH + 1) },
            error: invalidRefError
        },
        {
            ctx: { ...validEventContext(), path: null },
            error: invalidPathError
        },
        {
            ctx: { ...validEventContext(), path: undefined },
            error: invalidPathError
        },
        {
            ctx: { ...validEventContext(), path: "" },
            error: invalidPathError
        },
        {
            ctx: { ...validEventContext(), path: randomString(Validator.MAX_PATH_LENGTH + 1) },
            error: invalidPathError
        },
    ]
}

function validEventContext() {
    return { visitorId: crypto.randomUUID(), sessionId: crypto.randomUUID(), source: "some source", path: "/" };
}

function validEventContexts() {
    return [
        validEventContext(),
        { ...validEventContext(), campaign: "some campaign " },
        { ...validEventContext(), medium: "some medium " },
        { ...validEventContext(), ref: "some ref " }
    ];
}