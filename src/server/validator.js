export const MAX_ID_LENGTH = 36;
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const MAX_SOURCE_LENGTH = 100;
export const MAX_MEDIUM_LENGTH = 100;
export const MAX_CAMPAIGN_LENGTH = 100;
// could be longer - domain + path; see pages/init-script.html implementation
export const MAX_REF_LENGTH = 300;
export const MAX_PATH_LENGTH = 100;

/**
 * @typedef EventContext
 * @property {string} visitorId 
 * @property {string} sessionId 
 * @property {string} source 
 * @property {string} medium 
 * @property {string} campaign 
 * @property {string} ref 
 * @property {string} path
 */

/**
 * @param {EventContext} context
 */
export function validateEventContext(context) {
    const { visitorId, sessionId, source, medium, campaign, ref, path } = context;

    validateId(visitorId, "VisitorId");
    validateId(sessionId, "SessionId");

    if (!source || source.length > MAX_SOURCE_LENGTH) {
        throw new Error(`Source should not be empty and have max ${MAX_SOURCE_LENGTH} characters`);
    }

    if (medium && medium.length > MAX_MEDIUM_LENGTH) {
        throw new Error(`Medium can have up to ${MAX_MEDIUM_LENGTH} characters`);
    }

    if (campaign && campaign.length > MAX_CAMPAIGN_LENGTH) {
        throw new Error(`Campaign can have up to ${MAX_CAMPAIGN_LENGTH} characters`);
    }

    if (ref && ref.length > MAX_REF_LENGTH) {
        throw new Error(`Ref can have up to ${MAX_REF_LENGTH} characters`);
    }

    if (!path || path.length > MAX_PATH_LENGTH) {
        throw new Error(`Path should not be empty and have max ${MAX_PATH_LENGTH} characters`);
    }
}

function validateId(id, idName) {
    if (!id || id.length > MAX_ID_LENGTH) {
        throw new Error(`${idName} should not be empty and have max ${MAX_ID_LENGTH} characters`)
    }

    const match = id.match(UUID_REGEX);
    if (match === null) {
        throw new Error(`${idName} should be valid UUID but was: ${id}`);
    }
}