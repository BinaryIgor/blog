import { envVarOrDefault } from "../shared/env.js";

//3 hours
const DEFAULT_DB_BACKUP_DELAY = 3 * 60 * 60 * 1000;

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
        viewsWriteDelay: envVarOrDefault("VIEWS_WRITE_DELAY", 1000)
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
        "/stats.html"];
}