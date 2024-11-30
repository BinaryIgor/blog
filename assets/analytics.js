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

const MIN_SEND_VIEW_INTERVAL = 1000 * 60;
const MIN_POST_VIEW_TIME = 1000 * 5;
const MIN_POST_READ_SEEN_PERCENTAGE = 50;
const MIN_POST_READ_TIME = 1000 * 60 * 3;
const POST_READ_RETRY_DELAY_IF_NOT_ACTIVE = 1000 * 5;
const SEND_PING_INTERVAL = 1000 * 15;
// a few minutes (4 pings per minute)
const MAX_PINGS_TO_SEND_WITHOUT_SCROLL_CHANGE = 4 * 5;

const MAX_SEND_RETRY_DELAY = 15_000;

const VIEW_EVENT_TYPE = "VIEW";
const READ_EVENT_TYPE = "READ";
const SCROLL_EVENT_TYPE = "SCROLL";
const PING_EVENT_TYPE = "PING";

const eventsUrl = `${apiDomain()}/analytics/events`;

const postPage = document.body.getAttribute(POST_ATTRIBUTE);
const pageToSendEvents = !(postPage && postPage.includes("draft"));

const currentPath = location.pathname;
const sentViewKey = `${SENT_VIEW_KEY_PREFIX}_${currentPath.replace(/\./g, "-")}`;

let minimumPostViewTimePassed = false;
let postScrolled25 = false;
let postScrolled50 = false;
let postScrolled75 = false;
let postScrolled100 = false;

let postScrolledPercentage = 0;

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

function sendEvent(sourceUrl, visitorId, type, data = null) {
    function scheduleRetry() {
        const nextSendEventDelay = Math.random() * MAX_SEND_RETRY_DELAY;
        setTimeout(() => sendEvent(sourceUrl, visitorId, type, data), nextSendEventDelay);
    }

    postRequest(eventsUrl, { source: sourceUrl, visitorId: visitorId, path: currentPath, type: type, data: data })
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
            if (postScrolled25) {
                sendScrollEvent(sourceUrl, visitorId, 25);
            }
            if (postScrolled50) {
                sendScrollEvent(sourceUrl, visitorId, 50);
            }
            if (postScrolled75) {
                sendScrollEvent(sourceUrl, visitorId, 75);
            }
            if (postScrolled100) {
                sendScrollEvent(sourceUrl, visitorId, 100);
            }
            minimumPostViewTimePassed = true;
        }, MIN_POST_VIEW_TIME);
    } else if (lastSentViewExpired()) {
        sendEvent(sourceUrl, visitorId, VIEW_EVENT_TYPE);
    }
}

function sendScrollEvent(sourceUrl, visitorId, data = postScrolledPercentage) {
    sendEvent(sourceUrl, visitorId, SCROLL_EVENT_TYPE, data);
}

const sourceUrl = document.referrer ? document.referrer : document.location.href;
const visitorId = getOrGenerateVisitorId();

if (pageToSendEvents) {
    tryToSendViewEvent(sourceUrl, visitorId);
}

if (pageToSendEvents && postPage) {
    let minimumPostPercentageSeen = false;
    let minimumPostReadTimePassed = false;

    function isPageActive() {
        return !(document.visibilityState == 'hidden' || document.hidden);
    }

    function sendReadEventAfterDelayIfSeen(sourceUrl, visitorId) {
        function sendReadEventIf() {
            if (!minimumPostPercentageSeen) {
                minimumPostReadTimePassed = true;
                return;
            }
            if (isPageActive()) {
                sendReadEvent(sourceUrl, visitorId);
            } else {
                setTimeout(sendReadEventIf, POST_READ_RETRY_DELAY_IF_NOT_ACTIVE);
            }
        }

        setTimeout(sendReadEventIf, MIN_POST_READ_TIME);
    }

    function sendReadEvent(sourceUrl, visitorId) {
        sendEvent(sourceUrl, visitorId, READ_EVENT_TYPE);
    }

    sendReadEventAfterDelayIfSeen(sourceUrl, visitorId);

    let lastPostScrollChangeTimestamp = -1;
    window.addEventListener("post-seen-percentage-change", e => {
        postScrolledPercentage = e.detail.percentage;
        lastPostScrollChangeTimestamp = Date.now();

        if (!minimumPostPercentageSeen) {
            minimumPostPercentageSeen = postScrolledPercentage >= MIN_POST_READ_SEEN_PERCENTAGE;
            if (minimumPostPercentageSeen && minimumPostReadTimePassed) {
                sendReadEvent(sourceUrl, visitorId);
            }
        }

        if (!postScrolled25) {
            postScrolled25 = postScrolledPercentage >= 25;
            if (postScrolled25 && minimumPostViewTimePassed) {
                sendScrollEvent(sourceUrl, visitorId);
            }
        }
        if (!postScrolled50) {
            postScrolled50 = postScrolledPercentage >= 50;
            if (postScrolled50 && minimumPostViewTimePassed) {
                sendScrollEvent(sourceUrl, visitorId);
            }
        }
        if (!postScrolled75) {
            postScrolled75 = postScrolledPercentage >= 75;
            if (postScrolled75 && minimumPostViewTimePassed) {
                sendScrollEvent(sourceUrl, visitorId);
            }
        }
        if (!postScrolled100) {
            postScrolled100 = postScrolledPercentage >= 100;
            if (postScrolled100 && minimumPostViewTimePassed) {
                sendScrollEvent(sourceUrl, visitorId);
            }
        }
    });

    let sameScrollPositionPings = 0;
    let lastPingSentTimestamp = -1;
    setInterval(() => {
        if (!isPageActive()) {
            return;
        }
        if (lastPingSentTimestamp > 0 && lastPingSentTimestamp > lastPostScrollChangeTimestamp) {
            sameScrollPositionPings++;
        } else {
            sameScrollPositionPings = 0;
        }
        if (sameScrollPositionPings < MAX_PINGS_TO_SEND_WITHOUT_SCROLL_CHANGE) {
            sendEvent(sourceUrl, visitorId, PING_EVENT_TYPE, postScrolledPercentage);
            lastPingSentTimestamp = Date.now();
        }
    }, SEND_PING_INTERVAL);
}