import { envVarOrDefault } from "../shared/env.js";

export function read() {
    return {
        serverPort: envVarOrDefault("SERVER_PORT", 8080),
        dbPath: envVarOrDefault("DB_PATH", "/tmp/analytics.db")
    }
}