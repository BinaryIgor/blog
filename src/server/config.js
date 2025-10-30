import { envVarOrDefault, envVarOrThrow } from "../shared/env.js";

const MINUTE_MILLIS = 60 * 1000;
// 15 minutes
const DEFAULT_STATS_VIEWS_CALCULATE_SHORTER_PERIODS_INTERVAL = 15 * MINUTE_MILLIS;
// 4 hours + slight initial schedule delay not to conflict with shorter period stats (1 minute)
const DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_SCHEDULE_DELAY = MINUTE_MILLIS;
const DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_INTERVAL = 4 * 60 * MINUTE_MILLIS;
// 8 hours + slight initial schedule delay not to conflict with longer period stats (5 minutes)
const DEFAULT_STATS_VIEWS_CALCULATE_ALL_TIME_SCHEDULE_DELAY = 5 * MINUTE_MILLIS;
const DEFAULT_STATS_VIEWS_CALCULATE_ALL_TIME_INTERVAL = 8 * 60 * MINUTE_MILLIS;
// 6 hours + slight initial schedule delay not to conflict with longer and all time period stats (15 minutes)
const DEFAULT_DB_BACKUP_SCHEDULE_DELAY = 15 * MINUTE_MILLIS;
const DEFAULT_DB_BACKUP_INTERVAL = 6 * 60 * MINUTE_MILLIS;

export async function read() {
    const postsHost = envVarOrDefault("POSTS_HOST", "https://localhost");
    if (postsHost.includes("localhost")) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    return {
        serverPort: envVarOrDefault("SERVER_PORT", 8080),
        corsAllowedOrigin: envVarOrDefault("CORS_ALLOWED_ORIGIN", "https://binaryigor.com"),
        corsMaxAgeSeconds: envVarOrDefault("CORS_MAX_AGE_SECONDS", 3600),
        dbPath: envVarOrDefault("DB_PATH", "/tmp/analytics.db"),
        dbBackupPath: envVarOrDefault("DB_BACKUP_PATH", "/tmp/analytics_backup.db"),
        dbBackupScheduleDelay: envVarOrDefault("DB_BACKUP_SCHEDULE_DELAY", DEFAULT_DB_BACKUP_SCHEDULE_DELAY),
        dbBackupInterval: envVarOrDefault("DB_BACKUP_INTERVAL", DEFAULT_DB_BACKUP_INTERVAL),
        analyticsAllowedPaths: analyticsAllowedPaths(),
        postsPath: `${postsHost}/posts.json`,
        postsReadInterval: envVarOrDefault("POSTS_READ_INTERVAL", 60 * MINUTE_MILLIS),
        eventsWriteInterval: envVarOrDefault("EVENTS_WRITE_INTERVAL", 1000),
        eventsMaxInMemory: envVarOrDefault("EVENTS_MAX_IN_MEMORY", 100),
        statsViewsCalculateShorterPeriodsInterval: envVarOrDefault("STATS_VIEWS_CALCULATE_SHORTER_PERIODS_INTERVAL",
            DEFAULT_STATS_VIEWS_CALCULATE_SHORTER_PERIODS_INTERVAL),
        statsViewsCalculateLongerPeriodsScheduleDelay: envVarOrDefault("STATS_VIEWS_CALCULATE_LONGER_PERIODS_SCHEDULE_DELAY",
            DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_SCHEDULE_DELAY),
        statsViewsCalculateLongerPeriodsInterval: envVarOrDefault("STATS_VIEWS_CALCULATE_LONGER_PERIODS_INTERVAL",
            DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_INTERVAL),
        statsViewsCalculateAllTimeScheduleDelay: envVarOrDefault("STATS_VIEWS_CALCULATE_ALL_TIME_SCHEDULE_DELAY",
            DEFAULT_STATS_VIEWS_CALCULATE_ALL_TIME_SCHEDULE_DELAY),
        statsViewsCalculateAllTimeInterval: envVarOrDefault("STATS_VIEWS_CALCULATE_ALL_TIME_INTERVAL",
            DEFAULT_STATS_VIEWS_CALCULATE_ALL_TIME_INTERVAL),
        buttondownApiUrl: envVarOrDefault("BUTTONDOWN_API_URL", "https://api.buttondown.com/v1"),
        buttondownApiKey: await envVarOrThrow("BUTTONDOWN_API_KEY"),
        buttondownWebhookUrl: envVarOrDefault("BUTTONDOWN_WEBHOOK_URL", "https://api.binaryigor.com/webhooks/newsletter"),
        buttondownWebhookDescription: envVarOrDefault("BUTTONDOWN_WEBHOOK_DESCRIPTION", "Primary API managed webhook for automation"),
        buttondownWebhookSigningKey: await envVarOrThrow("BUTTONDOWN_WEBHOOK_SIGNING_KEY"),
        fixedNewsletterSubscribeResponseStatus: process.env["FIXED_NEWSLETTER_SUBSCRIBE_RESPONSE_STATUS"]
    }
}

function analyticsAllowedPaths() {
    const allowedPaths = envVarOrDefault("ANALYTICS_ALLOWED_PATHS", "");
    if (allowedPaths) {
        return allowedPaths.split(",").map(e => e.trim());
    }
    return ["/",
        "/index.html",
        "/about.html",
        "/posts.html",
        "/newsletter.html",
        "/privacy-policy.html",
        "/bootstrap.html",
        "/htmx-posts.html",
        "/dbs-posts.html",
        "/modularity-posts.html",
        "/networks-posts.html",
        "/not-found.html",
        "/stats.html"];
}