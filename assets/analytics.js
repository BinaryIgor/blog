// Global domain to api
function apiDomain() {
    const prodDomain = "https://api.binaryigor.com";

    let domain;
    try {
        if (document.location.host.includes("localhost")) {
            domain = "https://localhost";
        } else {
            domain = prodDomain;
        }
    } catch (e) {
        domain = prodDomain;
    }

    return domain;
}

// Analytics
const POST_ATTRIBUTE = "data-post-slug";
const SENT_VIEW_KEY_PREFIX = "SENT_VIEW";
const VISITOR_ID_KEY = "VISITOR_ID";

const MIN_SEND_VIEW_INTERVAL = 1000 * 60 * 5;
const MIN_POST_VIEW_TIME = 1000 * 5;
const MIN_POST_READ_SEEN_PERCENTAGE = 50;
const MIN_POST_READ_TIME = 1000 * 60 * 3;

const MAX_SEND_RETRY_DELAY = 15_000;

const VIEW_EVENT_TYPE = "VIEW";
const READ_EVENT_TYPE = "READ";
const SCROLL_EVENT_TYPE = "SCROLL";

const eventsUrl = `${apiDomain()}/analytics/events`;

const postPage = document.body.getAttribute(POST_ATTRIBUTE);
const pageToSendEvents = !(postPage && postPage.includes("draft"));

const currentPath = location.pathname;
const sentViewKey = `${SENT_VIEW_KEY_PREFIX}_${currentPath.replace(/\./g, "-")}`;

let minimumPostViewTimePassed = false;
let postScrolled = false;

function lastSentViewExpired() {
    const viewSent = localStorage.getItem(sentViewKey);
    return !viewSent || (parseInt(viewSent) + MIN_SEND_VIEW_INTERVAL < Date.now());
}

function getOrGenerateVisitorId() {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    if (visitorId) {
        return visitorId;
    }

    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);

    return visitorId;
}

function postRequest(url, body) {
    return fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
}

function sendEvent(sourceUrl, visitorId, type) {
    function scheduleRetry() {
        const nextSendEventDelay = Math.random() * MAX_SEND_RETRY_DELAY;
        setTimeout(() => sendEvent(sourceUrl, visitorId, type), nextSendEventDelay);
    }

    postRequest(eventsUrl, { source: sourceUrl, visitorId: visitorId, path: currentPath, type: type })
        .then(r => {
            if (!r.ok) {
                scheduleRetry();
            } else if (!postPage) {
                localStorage.setItem(sentViewKey, Date.now());
            }
        })
        .catch(scheduleRetry);
}

function tryToSendViewEvent(sourceUrl, visitorId) {
    if (postPage) {
        setTimeout(() => {
            sendEvent(sourceUrl, visitorId, VIEW_EVENT_TYPE);
            if (postScrolled) {
                sendEvent(sourceUrl, visitorId, SCROLL_EVENT_TYPE);
            }
            minimumPostViewTimePassed = true;
        }, MIN_POST_VIEW_TIME);
    } else if (lastSentViewExpired()) {
        sendEvent(sourceUrl, visitorId, VIEW_EVENT_TYPE);
    }
}

const sourceUrl = document.referrer ? document.referrer : document.location.href;
const visitorId = getOrGenerateVisitorId();

if (pageToSendEvents) {
    tryToSendViewEvent(sourceUrl, visitorId);
}

if (pageToSendEvents && postPage) {
    let minimumPostPercentageSeen = false;
    let minimumPostReadTimePassed = false;

    function sendReadEventAfterDelayIfSeen(sourceUrl, visitorId) {
        setTimeout(() => {
            if (minimumPostPercentageSeen) {
                sendReadEvent(sourceUrl, visitorId);
            } else {
                minimumPostReadTimePassed = true;
            }
        }, MIN_POST_READ_TIME);
    }

    function sendReadEvent(sourceUrl, visitorId) {
        sendEvent(sourceUrl, visitorId, READ_EVENT_TYPE);
    }

    sendReadEventAfterDelayIfSeen(sourceUrl, visitorId);

    window.addEventListener("post-seen-percentage-change", e => {
        if (!minimumPostPercentageSeen) {
            minimumPostPercentageSeen = e.detail.percentage >= MIN_POST_READ_SEEN_PERCENTAGE;
            if (minimumPostPercentageSeen && minimumPostReadTimePassed) {
                sendReadEvent(sourceUrl, visitorId);
            }
        }
        if (!postScrolled) {
            postScrolled = e.detail.percentage >= 100;
            if (postScrolled && minimumPostViewTimePassed) {
                sendEvent(sourceUrl, visitorId, SCROLL_EVENT_TYPE);
            }
        }
    });
}