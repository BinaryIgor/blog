import { envVarOrDefault } from "../shared/env.js";

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

export function read() {
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
        buttonDownApiUrl: envVarOrDefault("BUTTON_DOWN_API_URL", "https://api.buttondown.com/v1"),
        buttonDownApiKey: envVarOrDefault("BUTTON_DOWN_API_KEY", "_BUTTON_DOWN_API_KEY_")
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
        "/htmx-posts.html",
        "/dbs-posts.html",
        "/modularity-posts.html",
        "/networks-posts.html",
        "/not-found.html",
        "/stats.html"];
}