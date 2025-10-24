import { SqliteDb, SqliteDbBackuper } from "../../src/server/db.js";

import { assert } from "chai";

import fs from "fs";
import crypto from 'crypto';
import path from 'path';
import { TestClock } from "../test-utils.js";

const DB_PATH = path.join("/tmp", "backup_test.db");
const DB_BACKUP_PATH = path.join("/tmp", "backup_test_backup.db");

let db;

const clock = new TestClock();

describe("SqliteDbBackuper tests", () => {
    before(async () => {
        db = await SqliteDb.initInstance(DB_PATH);
        await createTestTable();
    });

    after(() => {
        fs.rmSync(DB_PATH);
        fs.rmSync(DB_BACKUP_PATH);
    });

    it(`backups db`, async () => {
        const backuper = new SqliteDbBackuper(db, DB_BACKUP_PATH, clock);
        await createTestTable();

        await insertTestTableRow();
        await insertTestTableRow();

        assert.equal(await countTestTableRows(db), 2);

        await backuper.backup();
        const lastBackupTimestamp1 = clock.nowTimestamp();

        const dbBackup = await SqliteDb.initInstance(DB_BACKUP_PATH);

        assert.equal(await countTestTableRows(db), 2);
        assert.equal(await countTestTableRows(dbBackup), 2);
        assertLastBackupTimestampEqual(backuper, lastBackupTimestamp1);

        await insertTestTableRow();

        assert.equal(await countTestTableRows(db), 3);
        assert.equal(await countTestTableRows(dbBackup), 2);

        clock.moveTimeByReasonableAmount();
        await backuper.backup();
        const lastBackupTimestamp2 = clock.nowTimestamp();

        assert.equal(await countTestTableRows(dbBackup), 3);
        assertLastBackupTimestampEqual(backuper, lastBackupTimestamp2);
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

function assertLastBackupTimestampEqual(backuper, expectedTimestamp) {
    assert.equal(backuper.lastBackupTimestamp, expectedTimestamp);
}
