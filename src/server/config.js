import { envVarOrDefault } from "../shared/env.js";

const MINUTE_MILLIS = 60 * 1000;
// 10 minutes
const DEFAULT_STATS_VIEWS_SHORTER_PERIODS_DELAY = 10 * MINUTE_MILLIS;
// 1 hour + slight delay not to conflict with shorter period stats (2 minutes)
const DEFAULT_STATS_VIEWS_LONGER_PERIODS_DELAY = 60 * MINUTE_MILLIS + 2 * MINUTE_MILLIS;
// 3 hours + slight delay not to conflict with longer period stats (5 minutes)
const DEFAULT_DB_BACKUP_DELAY = 3 * 60 * MINUTE_MILLIS + 5 * MINUTE_MILLIS;

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
        dbBackupDelay: envVarOrDefault("DB_BACKUP_DELAY", DEFAULT_DB_BACKUP_DELAY),
        analyticsAllowedPaths: analyticsAllowedPaths(),
        postsPath: `${postsHost}/posts.json`,
        postsReadDelay: envVarOrDefault("POSTS_READ_DELAY", 60 * 60_000),
        eventsWriteDelay: envVarOrDefault("EVENTS_WRITE_DELAY", 1000),
        eventsMaxInMemory: envVarOrDefault("EVENTS_MAX_IN_MEMORY", 250),
        statsViewsShorterPeriodsDelay: envVarOrDefault("STATS_VIEWS_SHORTER_PERIODS_DELAY",
            DEFAULT_STATS_VIEWS_SHORTER_PERIODS_DELAY),
        statsViewsLongerPeriodsDelay: envVarOrDefault("STATS_VIEWS_LONGER_PERIODS_DELAY",
            DEFAULT_STATS_VIEWS_LONGER_PERIODS_DELAY)
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