import { Scheduler } from "../../src/server/scheduler.js";
import { delay } from "../../src/shared/promises.js";

import { SqliteDb, SqliteDbBackuper } from "../../src/server/db.js";

import { assert } from "chai";

import fs from "fs";
import crypto from 'crypto';
import path from 'path';

const DB_PATH = path.join("/tmp", `${crypto.randomUUID()}.db`);
const DB_BACKUP_PATH = path.join("/tmp", `${crypto.randomUUID()}_backup.db`);

const BACKUP_DELAY = 1;
const BACKUP_DELAY_AWAIT = 5;

const scheduler = new Scheduler();

const db = new SqliteDb(DB_PATH);

describe("SqliteDbBackuper tests", () => {
    before(async () => {
        await createTestTable();
    });

    afterEach(() => {
        scheduler.close();
    });

    after(() => {
        fs.rmSync(DB_PATH);
        fs.rmSync(DB_BACKUP_PATH);
    });

    it(`should backup db`, async () => {
        await insertTestTableRow();
        await insertTestTableRow();

        assert.equal(await countTestTableRows(db), 2);

        await initSingleBackup();

        const dbBackup = fromBackupDb();

        assert.equal(await countTestTableRows(db), 2);
        assert.equal(await countTestTableRows(dbBackup), 2);

        await insertTestTableRow();

        assert.equal(await countTestTableRows(db), 3);
        assert.equal(await countTestTableRows(dbBackup), 2);

        await initSingleBackup();

        assert.equal(await countTestTableRows(dbBackup), 3);
    });
})

function createTestTable() {
    return db.execute(`
    CREATE TABLE IF NOT EXISTS test_table (
        timestamp INTEGER(8) NOT NULL,
        id TEXT NOT NULL
    );`);
}

function insertTestTableRow(timestamp = Date.now(), id = crypto.randomUUID()) {
    return db.execute(`INSERT INTO test_table (timestamp, id) VALUES (?, ?)`, [timestamp, id]);
}

function countTestTableRows(db) {
    return db.queryOne("SELECT COUNT(*) AS rows FROM test_table").then(r => r['rows']);
}

function nextBackupDelay() {
    return delay(BACKUP_DELAY_AWAIT);
}

function fromBackupDb() {
    return new SqliteDb(DB_BACKUP_PATH);
}

async function initSingleBackup() {
    new SqliteDbBackuper(db, DB_BACKUP_PATH, scheduler, BACKUP_DELAY);
    await nextBackupDelay();
    scheduler.close();
}
