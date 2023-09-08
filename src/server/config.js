import { envVarOrDefault } from "../shared/env.js";
import * as Files from "../shared/files.js";
import path from 'path';

//3 hours
const DEFAULT_DB_BACKUP_DELAY = 3 * 60 * 60 * 1000;

export function read() {
    return {
        serverPort: envVarOrDefault("SERVER_PORT", 8080),
        dbPath: envVarOrDefault("DB_PATH", "/tmp/analytics.db"),
        dbBackupPath: envVarOrDefault("DB_BACKUP_PATH", "/tmp/analytics_backup.db"),
        dbBackupDelay: envVarOrDefault("DB_BACKUP_DELAY", DEFAULT_DB_BACKUP_DELAY),
        analyticsAllowedPaths: analyticsAllowedPaths(),
        postsPath: envVarOrDefault("POSTS_PATH", localPostsPath()),
        postsReadDelay: envVarOrDefault("POSTS_READ_DELAY", 5000),
        viewsWriteDelay: envVarOrDefault("VIEWS_WRITE_DELAY", 1000)
    }
}

function localPostsPath() {
    return path.join(Files.currentDir(), "..", "..", "dist", "posts.json");
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