import sqlite3 from "sqlite3";
import * as Logger from "../shared/logger.js";

export function initSchema(db) {
    return db.executeRaw(`
        CREATE TABLE IF NOT EXISTS event (
            timestamp INTEGER(8) NOT NULL,
            visitor_id TEXT NOT NULL,
            ip_hash TEXT NOT NULL,
            source TEXT NOT NULL,
            path TEXT NOT NULL,
            type TEXT NOT NULL,
            data TEXT
        );
    
        CREATE INDEX IF NOT EXISTS event_timestamp ON event(timestamp);
    
        CREATE VIEW IF NOT EXISTS view AS SELECT * FROM event WHERE type = 'VIEW';
        CREATE VIEW IF NOT EXISTS scroll AS SELECT * FROM event WHERE type = 'SCROLL';
        CREATE VIEW IF NOT EXISTS ping AS SELECT * FROM event WHERE type = 'PING';
    
        CREATE TABLE IF NOT EXISTS stats_view (
            period TEXT PRIMARY KEY NOT NULL,
            -- json --
            stats TEXT NOT NULL,
            calculated_at INTEGER(8) NOT NULL
        );
        `);
}

export class SqliteDb {

    constructor(filePath) {
        this.db = new sqlite3.Database(filePath);
    }

    executeRaw(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    execute(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    queryOne(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (error, row) => {
                if (error) {
                    reject(error);
                }
                resolve(row);
            });
        });
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (error, rows) => {
                if (error) {
                    reject(error);
                }
                resolve(rows);
            });
        });
    }

    backup(backupPath) {
        return new Promise((resolve, reject) => {
            const backup = this.db.backup(backupPath);
            backup.step(-1, error => {
                if (error) {
                    reject(error);
                } else {
                    backup.finish(error => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve()
                        }
                    });
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close(error => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}

export class SqliteDbBackuper {
    constructor(db, backupPath, clock) {
        this.db = db;
        this.backupPath = backupPath;
        this.clock = clock;
        this.lastBackupTimestamp = null;
    }

    schedule(scheduler, backupDelay) {
        scheduler.schedule(async () => this.backup(), backupDelay);
    }

    async backup() {
        try {
            Logger.logInfo(`Backing up db to ${this.backupPath}...`);
            await this.db.backup(this.backupPath);
            Logger.logInfo(`Backup is done and could be found under ${this.backupPath} path`);
            this.lastBackupTimestamp = this.clock.nowTimestamp();
        } catch (e) {
            Logger.logError(`Fail to backup db to ${this.backupPath}`, e);
        }
    }
}
