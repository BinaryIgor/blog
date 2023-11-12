// Navigation/dark mode switch
const navigation = document.getElementById("navigation");

document.getElementById("navigation-toggle").onclick = () => {
    navigation.classList.toggle("hidden");
};

function setupMode() {
    const KEY = "MODE";

    const LIGHT_MODE = 'light';
    const DARK_MODE = 'dark';
    const LIGHT_MODE_ICON = "I";
    const DARK_MODE_ICON = "0";
    const LIGHT_FAVICON_LINK = '/assets/favicon-light.svg';
    const DARK_FAVICON_LINK = '/assets/favicon.svg';

    const themeToggle = document.getElementById("theme-toggle");
    const faviconLink = document.querySelector('link[rel="icon"]');

    const currentMode = () => {
        const mode = localStorage.getItem(KEY);
        if (mode) {
            return mode;
        }
        return DARK_MODE;
    }

    const setDarkMode = () => {
        document.documentElement.classList.add(DARK_MODE);
        localStorage.setItem(KEY, DARK_MODE)
        themeToggle.textContent = DARK_MODE_ICON;
        faviconLink.setAttribute('href', DARK_FAVICON_LINK);
    };

    const setLightMode = () => {
        document.documentElement.classList.remove(DARK_MODE);
        localStorage.setItem(KEY, LIGHT_MODE)
        themeToggle.textContent = LIGHT_MODE_ICON;
        faviconLink.setAttribute('href', LIGHT_FAVICON_LINK);
    };

    if (currentMode() == LIGHT_MODE) {
        setLightMode();
    } else {
        setDarkMode();
    }

    themeToggle.onclick = () => {
        if (currentMode() == LIGHT_MODE) {
            setDarkMode();
        } else {
            setLightMode();
        }
    };
}

setupMode();

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
const MIN_POST_VIEW_TIME = 1000 * 10;
const MIN_POST_READ_SEEN_PERCENTAGE = 0.5;
const MIN_POST_READ_TIME = 1000 * 60 * 3;

const MAX_SEND_RETRY_DELAY = 30_000;

const VIEW_EVENT_TYPE = "VIEW";
const READ_EVENT_TYPE = "READ";

const eventsUrl = `${apiDomain()}/analytics/events`;

const postPage = document.body.getAttribute(POST_ATTRIBUTE);
const pageToSendEvents = !(postPage && postPage.includes("draft"));

const currentPath = location.pathname;
const sentViewKey = `${SENT_VIEW_KEY_PREFIX}_${currentPath.replace(/\./g, "-")}`;

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
        setTimeout(() => sendEvent(sourceUrl, visitorId, VIEW_EVENT_TYPE), MIN_POST_VIEW_TIME);
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
    const postContainer = document.querySelector("article");
    
    let minimumPostPercentageSeen = false;
    let minimumPostReadTimePassed = false;

    function seenPostPercentage() {
        const seenDocument = document.documentElement.scrollTop + document.documentElement.clientHeight;
        return seenDocument / postContainer.scrollHeight;
    }

    function isMinimumPostPercentageVisible() {
        return seenPostPercentage() >= MIN_POST_READ_SEEN_PERCENTAGE;
    }

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

    minimumPostPercentageSeen = isMinimumPostPercentageVisible();

    sendReadEventAfterDelayIfSeen(sourceUrl, visitorId);

    if (!minimumPostPercentageSeen) {
        window.addEventListener("scroll", () => {
            if (!minimumPostPercentageSeen) {
                minimumPostPercentageSeen = isMinimumPostPercentageVisible();
                if (minimumPostPercentageSeen && minimumPostReadTimePassed) {
                    sendReadEvent(sourceUrl, visitorId);
                }
            }
        });
    }
}