import sqlite3 from "sqlite3";
import * as Logger from "../shared/logger.js";

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
    constructor(db, backupPath, scheduler, backupDelay) {
        scheduler.schedule(async () => {
            try {
                Logger.logInfo(`Backing up db to ${backupPath}...`);
                await db.backup(backupPath);
                Logger.logInfo(`Backup is done and could be found under ${backupPath} path`);
            } catch (e) {
                Logger.logError(`Fail to backup db to ${backupPath}`, e);
            }
        }, backupDelay);
    }
}
