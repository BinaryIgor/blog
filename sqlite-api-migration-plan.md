# SQLite API migration plan

This project uses deprecated sqlite3 dependency that is no longer maintained.

The native SQLite module has been available since Node 22.5.0; this migration targets Node 26, where it is supported, and we want to:
* migrate project to it
* remove sqlite3 dependency, while preserving all project functionalities and performance assumptions
* update the API Dockerfile and package engine requirement to Node 26 (`node:26-alpine` and `>=26.0.0`)

I've verified that the project builds locally with node `v26.0.0` as it is.

The DB wrapper is in `server/db.js`, but `SqliteAnalyticsRepository` and `StatsViews` in `server/analytics.js` directly use its asynchronous API. Keep the DB wrapper in `server/db.js`, but update its consumers too; replacing only the implementation will break their promise chains. Some important things to keep in mind:
* `sqlite3` allowed async interactions, which is reflected in the `server/db.js` functions and its consumers. Native `node:sqlite` exposes synchronous `DatabaseSync` APIs.
* For fast, non-analytical queries, use one synchronous main-thread connection. This includes event-validation reads, `saveEvents`, and reading `stats_view`. Preserve the existing SQLite configuration for this connection (`cache_size`, WAL, synchronous mode, and a 5-second busy timeout).
* For scheduled, analytical queries calculated mostly in `SqliteAnalyticsRepository`, use one long-lived Worker so they cannot block the main event loop. The worker must open and configure its own SQLite connection.
* The Worker boundary must be explicit: do not attempt to share DB, repository, or `StatsViews` instances across threads. Send commands such as `calculateShorterPeriods`, `calculateLongerPeriods`, and `calculateAllTime`; the worker calculates and persists its own `stats_view` updates, then reports completion or an error. The logic should live a single worker, defined in one file.
* Serialize jobs in the worker. `setInterval` does not await its async callback and `/internal/calculate-stats-views` can overlap with scheduled work, so the schedule delays alone do not guarantee that calculations never overlap. Queue jobs (or document an intentional coalescing/rejection policy).
* `SqliteAnalyticsRepository.saveEvents` counts as a fast query - events are limited there to about 100
* `StatsViews` hold the main logic for calculating longer-running stats
* Start with one Worker for all stats calculations. Retain the public `StatsViews` orchestration methods, but have them await the corresponding worker job so existing callers and tests can retain their behavioral contract.
* Keep `SqliteDbBackuper` in the main process. Native `sqlite.backup(...)` is asynchronous and can run while the database is in use, so a Worker is not needed to protect the event loop. Using a separate worker connection for backups is less desirable because mutations from other connections can restart a backup. Ensure shutdown waits for an in-progress backup before closing the main DB connection.
* No separate test suite is required: modify the existing tests to exercise worker-backed stats calculations, error propagation, serialization of overlapping requests, and clean worker shutdown.
* After the source and adapted tests pass, remove the `sqlite3` dependency and regenerate `package-lock.json`; rerun the full test suite.
* Once the dependency is gone and tests pass, update the Dockerfile to `node:26-alpine` and `package.json` to require Node `>=26.0.0`, then verify the API build image.
* Split the work cleanly into a few, easy to review commits. Remember to stop after each commit, so I can review it and ask for fixes or explanations.

