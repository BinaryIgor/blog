import { envVarOrDefault } from "../shared/env.js";

const MINUTE_MILLIS = 60 * 1000;
// 10 minutes
const DEFAULT_STATS_VIEWS_CALCULATE_SHORTER_PERIODS_INTERVAL = 10 * MINUTE_MILLIS;
// 1 hour + slight initial schedule delay not to conflict with shorter period stats (1 minutee)
const DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_SCHEDULE_DELAY = MINUTE_MILLIS;
const DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_INTERVAL = 60 * MINUTE_MILLIS;
// 3 hours + slight initial schedule delay not to conflict with longer period stats (5 minutes)
const DEFAULT_DB_BACKUP_SCHEDULE_DELAY = 5 * MINUTE_MILLIS;
const DEFAULT_DB_BACKUP_INTERVAL = 3 * 60 * MINUTE_MILLIS;

export function read() {
    const postsHost = envVarOrDefault("POSTS_HOST", "https://localhost");
    if (postsHost.includes("localhost")) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    return {
        serverPort: envVarOrDefault("SERVER_PORT", 8080),
        corsAllowedOrigin: envVarOrDefault("CORS_ALLOWED_ORIGIN", "https://binaryigor.com"),
        dbPath: envVarOrDefault("DB_PATH", "/tmp/analytics.db"),
        dbBackupPath: envVarOrDefault("DB_BACKUP_PATH", "/tmp/analytics_backup.db"),
        dbBackupScheduleDelay: envVarOrDefault("DB_BACKUP_SCHEDULE_DELAY", DEFAULT_DB_BACKUP_SCHEDULE_DELAY),
        dbBackupInterval: envVarOrDefault("DB_BACKUP_INTERVAL", DEFAULT_DB_BACKUP_INTERVAL),
        analyticsAllowedPaths: analyticsAllowedPaths(),
        postsPath: `${postsHost}/posts.json`,
        postsReadInterval: envVarOrDefault("POSTS_READ_INTERVAL", 60 * MINUTE_MILLIS),
        eventsWriteInterval: envVarOrDefault("EVENTS_WRITE_INTERVAL", 1000),
        eventsMaxInMemory: envVarOrDefault("EVENTS_MAX_IN_MEMORY", 250),
        statsViewsCalculateShorterPeriodsInterval: envVarOrDefault("STATS_VIEWS_CALCULATE_SHORTER_PERIODS_INTERVAL",
            DEFAULT_STATS_VIEWS_CALCULATE_SHORTER_PERIODS_INTERVAL),
        statsViewsCalculateLongerPeriodsScheduleDelay: envVarOrDefault("STATS_VIEWS_CALCULATE_LONGER_PERIODS_SCHEDULE_DELAY",
            DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_SCHEDULE_DELAY),
        statsViewsCalculateLongerPeriodsInterval: envVarOrDefault("STATS_VIEWS_CALCULATE_LONGER_PERIODS_INTERVAL",
            DEFAULT_STATS_VIEWS_CALCULATE_LONGER_PERIODS_INTERVAL)
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
        "/not-found.html",
        "/stats.html"];
}