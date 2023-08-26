// Navigation/dark mode
const navigation = document.getElementById("navigation");

document.getElementById("navigation-toggle").onclick = () => {
    navigation.classList.toggle("hidden");
};

function setupMode() {
    const KEY = "MODE";

    const LIGHT_MODE = 'light';
    const DARK_MODE = 'dark';
    const DARK_MODE_ICON = "0";
    const LIGHT_MODE_ICON = "1";

    const themeToggle = document.getElementById("theme-toggle");

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
    };

    const setLightMode = () => {
        document.documentElement.classList.remove(DARK_MODE);
        localStorage.setItem(KEY, LIGHT_MODE)
        themeToggle.textContent = LIGHT_MODE_ICON;
    };

    if (currentMode() == LIGHT_MODE) {
        setLightMode();
    } else {
        setDarkMode();
    }

    themeToggle.onclick = e => {
        if (currentMode() == LIGHT_MODE) {
            setDarkMode();
        } else {
            setLightMode();
        }
    };
}

setupMode();

// Analytics
const SENT_VIEW_KEY = "SENT_VIEW";
const VISITOR_ID_KEY = "VISITOR_ID";

const MIN_SEND_VIEW_INTERVAL = 1000 * 60 * 5;
const MIN_POST_VIEW_TIME = 1000 * 10;

const VIEW_URL = "/api/analytics/view";
const POST_VIEW_URL = "/api/analytics/post-view";

function lastSentViewExpired() {
    const viewSent = localStorage.getItem(SENT_VIEW_KEY);
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

function sendView(sourceUrl, visitorId) {
    postRequest(VIEW_URL, { sourceUrl: sourceUrl, visitorId: visitorId })
        .then(r => localStorage.setItem(SENT_VIEW_KEY, Date.now()));
}

function tryToSendView(sourceUrl, visitorId) {
    if (lastSentViewExpired()) {
        sendView(sourceUrl, visitorId);
    }
}

function tryToSendPostView(visitorId) {
    const postSlug = document.body.getAttribute("data-post-slug");
    if (!postSlug) {
        return;
    }
    setTimeout(() => {
        postRequest(POST_VIEW_URL, { visitorId: visitorId });

    }, MIN_POST_VIEW_TIME);
}

const sourceUrl = document.referrer ? document.referrer : document.location.origin;
const visitorId = getOrGenerateVisitorId();
console.log("Source url", sourceUrl);
console.log("visitor id", visitorId);

tryToSendView(sourceUrl, visitorId);
tryToSendPostView(visitorId);