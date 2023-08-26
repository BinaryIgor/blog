import sqlite3 from "sqlite3";

export class SqliteDb {
    
    constructor(filePath) {
        this.db =  new sqlite3.Database(filePath);
    }

    execute(sql, params=[]) {
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

    queryOne(sql, params=[]) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (error, row) => {
                if (error) {
                    reject(error);
                }
                resolve(row);
            });
        });
    }

    query(sql, params=[]) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (error, rows) => {
                if (error) {
                    reject(error);
                }
                resolve(rows);
            });
        });
    }
}