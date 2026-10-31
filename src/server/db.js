import { backup as sqliteBackup, DatabaseSync } from "node:sqlite";
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

    #db;
    #backups = new Set();

    constructor(filePath) {
        this.#db = new DatabaseSync(filePath);
    }

    static async initInstance(filePath) {
        const db = new SqliteDb(filePath);
        db.init();
        return db;
    }

    init() {
        // Cache size stands for a multiple of page size - 4096 bytes by default.
        // Setting 10 000 gives us  ~ 40,96MB of cache.
        // Pragma reference: https://sqlite.org/pragma.html
        this.executeRaw("PRAGMA cache_size=10000");
        this.executeRaw("PRAGMA busy_timeout=5000");
        this.executeRaw("PRAGMA journal_mode=WAL");
        this.executeRaw("PRAGMA synchronous=NORMAL");
    }

    executeRaw(sql) {
        this.#db.exec(sql);
    }

    execute(sql, params = []) {
        return this.#db.prepare(sql).run(...params).changes;
    }

    queryOne(sql, params = []) {
        return this.#db.prepare(sql).get(...params);
    }

    query(sql, params = []) {
        return this.#db.prepare(sql).all(...params);
    }

    backup(backupPath) {
        const backupPromise = sqliteBackup(this.#db, backupPath);
        this.#backups.add(backupPromise);
        return backupPromise.finally(() => this.#backups.delete(backupPromise));
    }

    async close() {
        await Promise.all(this.#backups);
        this.#db.close();
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
