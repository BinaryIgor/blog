import sqlite3 from "sqlite3";
import * as Logger from "../shared/logger.js";

export function initSchema(db) {
    return db.executeRaw(`
        CREATE TABLE IF NOT EXISTS event (
            timestamp INTEGER(8) NOT NULL,
            visitor_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            ip_hash TEXT NOT NULL,
            source TEXT NOT NULL,
            medium TEXT,
            campaign TEXT,
            ref TEXT,
            path TEXT NOT NULL,
            type TEXT NOT NULL,
            data TEXT
        );
    
        CREATE INDEX IF NOT EXISTS event_timestamp ON event(timestamp);

        -- migrations --
        -- ALTER TABLE event ADD COLUMN medium TEXT; --
        -- ALTER TABLE event ADD COLUMN campaign TEXT; --
        -- ALTER TABLE event ADD COLUMN ref TEXT; --
        -- ALTER TABLE event ADD COLUMN session_id TEXT NOT NULL DEFAULT ''; --
        -- migrations --

        CREATE VIEW IF NOT EXISTS view AS SELECT * FROM event WHERE type = 'VIEW';
        CREATE VIEW IF NOT EXISTS scroll AS SELECT * FROM event WHERE type = 'SCROLL';
        CREATE VIEW IF NOT EXISTS ping AS SELECT * FROM event WHERE type = 'PING';
    
        CREATE TABLE IF NOT EXISTS stats_view (
            period TEXT PRIMARY KEY NOT NULL,
            -- json --
            stats TEXT NOT NULL,
            calculated_at INTEGER(8) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subscriber (
            email TEXT NOT NULL UNIQUE,
            external_id TEXT UNIQUE,
            external_source TEXT,
            external_type TEXT,
            created_at INTEGER(8) NOT NULL,
            signed_up_at INTEGER(8) NOT NULL,
            confirmed_at INTEGER(8),
            unsubscribed_at INTEGER(8),
            unsubscribed_reason TEXT,
            last_opened_at INTEGER(8),
            last_clicked_at INTEGER(8),
            state TEXT NOT NULL,
            sign_up_context_visitor_id TEXT,
            sign_up_context_session_id TEXT,
            sign_up_context_source TEXT,
            sign_up_context_medium TEXT,
            sign_up_context_campaign TEXT,
            sign_up_context_ref TEXT,
            sign_up_context_placement TEXT
        );
        `);
}

const CAMEL_CASE_REGEX = /([a-z0-9])([A-Z])/g;
export function snakeCasedObject(object) {
    const snakeCased = {};
    for (let f in object) {
        const scField = f.replace(CAMEL_CASE_REGEX, '$1_$2').toLowerCase();
        snakeCased[scField] = object[f];
    }
    return snakeCased;
}

export class SqliteDb {

    #dbs;
    #nextDbIdx = 0;

    constructor(filePath, connections = 5) {
        if (!connections || connections < 1 || connections > 10) {
            throw new Error(`1 - 10 connections are supported but ${connections} were requested`);
        }
        this.#dbs = Array.from({ length: connections }, () => new sqlite3.Database(filePath));
    }

    #db() {
        const db = this.#dbs[this.#nextDbIdx];
        this.#nextDbIdx = (this.#nextDbIdx + 1) % this.#dbs.length;
        return db;
    }

    static async initInstance(filePath, connections = 5) {
        const db = new SqliteDb(filePath, connections);
        await db.init();
        return db;
    }

    async init() {
        for (let db of this.#dbs) {
            await this.#initDb(db);
        }
    }

    async #initDb(db) {
        // Cache size stands for a multiple of page size - 4096 bytes by default.
        // Setting 10 000 gives us  ~ 40,96MB of cache.
        // Pragma reference: https://sqlite.org/pragma.html
        await this.#execute(db, "PRAGMA cache_size=10000");
        await this.#execute(db, "PRAGMA busy_timeout=5000");
        await this.#execute(db, "PRAGMA journal_mode=WAL");
        await this.#execute(db, "PRAGMA synchronous=NORMAL");
    }

    executeRaw(sql) {
        return new Promise((resolve, reject) => {
            this.#db().exec(sql, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    execute(sql, params = []) {
        return this.#execute(this.#db(), sql, params);
    }

    #execute(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    queryOne(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.#db().get(sql, params, (error, row) => {
                if (error) {
                    reject(error);
                }
                resolve(row);
            });
        });
    }

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.#db().all(sql, params, (error, rows) => {
                if (error) {
                    reject(error);
                }
                resolve(rows);
            });
        });
    }

    backup(backupPath) {
        return new Promise((resolve, reject) => {
            const backup = this.#db().backup(backupPath);
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
        const closePromises = this.#dbs.map(db =>
            new Promise((resolve, reject) => {
                db.close(error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            }));
        return Promise.all(closePromises);
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
