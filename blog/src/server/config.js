import { envVarOrDefault } from "../shared/env.js";
import * as Files from "../shared/files.js";
import path from 'path';

export function read() {
    return {
        serverPort: envVarOrDefault("SERVER_PORT", 8080),
        dbPath: envVarOrDefault("DB_PATH", "/tmp/analytics.db"),
        dbBackupPath: envVarOrDefault("DB_BACKUP_PATH", "/tmp/analytics_backup.db"),
        analyticsAllowedPaths: analyticsAllowedPaths(),
        postsPath: envVarOrDefault("POSTS_PATH", localPostsPath())
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