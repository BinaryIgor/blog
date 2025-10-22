// Analytics
const POST_ATTRIBUTE = "data-post-slug";
const SENT_VIEW_KEY_PREFIX = "SENT_VIEW";

const MIN_SEND_VIEW_INTERVAL = 1000 * 60;
const MIN_POST_VIEW_TIME = 1000 * 5;
const SEND_PING_INTERVAL = 1000 * 30;
// a few minutes (2 pings per minute)
const MAX_PINGS_TO_SEND_WITHOUT_SCROLL_CHANGE = 2 * 5;

const MIN_SEND_RETRY_DELAY = 500;
const MAX_SEND_RETRY_DELAY = 5000;
const MAX_MIN_SEND_RETRY_DELAY_DIFF = MAX_SEND_RETRY_DELAY - MIN_SEND_RETRY_DELAY;
// longest case: 5s * 30 = 150s ~ 2.5 minutes; ~ 1.25 minutes (125s) on average probably
const MAX_RETRIES = 30;
// pings are sent continuously
const MAX_PING_RETRIES = 2;

const VIEW_EVENT_TYPE = "VIEW";
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

function postRequest(url, body) {
    return fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
}

function sendEvent(type, data = null, maxRetries = MAX_RETRIES, retry = 0) {
    function scheduleRetry() {
        const nextRetry = retry + 1;
        if (nextRetry <= maxRetries) {
            const nextSendEventDelay = MIN_SEND_RETRY_DELAY + (Math.random() * MAX_MIN_SEND_RETRY_DELAY_DIFF);
            setTimeout(() => {
                sendEvent(type, data, maxRetries, nextRetry);
            }, nextSendEventDelay);
        }
    }

    postRequest(eventsUrl, {
        visitorId: getOrGenerateVisitorId(),
        sessionId: getOrGenerateSessionId(),
        source: sessionSource(),
        medium: sessionMedium(),
        campaign: sessionCampaign(),
        ref: pageRef(),
        path: currentPath,
        type, data
    }).then(r => {
        if (!r.ok) {
            scheduleRetry();
        } else if (!postPage) {
            localStorage.setItem(sentViewKey, Date.now());
        }
    }).catch(scheduleRetry);
}

function tryToSendViewEvent() {
    if (postPage) {
        setTimeout(() => {
            sendEvent(VIEW_EVENT_TYPE);
            if (postScrolled25) {
                sendScrollEvent(25);
            }
            if (postScrolled50) {
                sendScrollEvent(50);
            }
            if (postScrolled75) {
                sendScrollEvent(75);
            }
            if (postScrolled100) {
                sendScrollEvent(100);
            }
            minimumPostViewTimePassed = true;
        }, MIN_POST_VIEW_TIME);
    } else if (lastSentViewExpired()) {
        sendEvent(VIEW_EVENT_TYPE);
    }
}

function sendScrollEvent(data) {
    sendEvent(SCROLL_EVENT_TYPE, data);
}

if (pageToSendEvents) {
    tryToSendViewEvent();
}

if (pageToSendEvents && postPage) {

    function isPageActive() {
        return !(document.visibilityState == 'hidden' || document.hidden);
    }

    let lastPostScrollChangeTimestamp = -1;
    window.addEventListener("post-seen-percentage-change", e => {
        postScrolledPercentage = e.detail.percentage;
        lastPostScrollChangeTimestamp = Date.now();

        if (!postScrolled25) {
            postScrolled25 = postScrolledPercentage >= 25;
            if (postScrolled25 && minimumPostViewTimePassed) {
                sendScrollEvent(25);
            }
        }
        if (!postScrolled50) {
            postScrolled50 = postScrolledPercentage >= 50;
            if (postScrolled50 && minimumPostViewTimePassed) {
                sendScrollEvent(50);
            }
        }
        if (!postScrolled75) {
            postScrolled75 = postScrolledPercentage >= 75;
            if (postScrolled75 && minimumPostViewTimePassed) {
                sendScrollEvent(75);
            }
        }
        if (!postScrolled100) {
            postScrolled100 = postScrolledPercentage >= 100;
            if (postScrolled100 && minimumPostViewTimePassed) {
                sendScrollEvent(100);
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
            sendEvent(PING_EVENT_TYPE, postScrolledPercentage, MAX_PING_RETRIES);
            lastPingSentTimestamp = Date.now();
        }
    }, SEND_PING_INTERVAL);
}