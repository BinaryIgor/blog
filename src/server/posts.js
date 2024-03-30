import * as Logger from "../shared/logger.js";
import * as Promises from "../shared/promises.js";

export class PostsSource {

    constructor(postsUrl, retryConfig, scheduler, readDelay) {
        this._postsUrl = postsUrl;
        this._posts = new Set();

        this._retryConfig = retryConfig;

        this._lastReload = undefined;

        if (scheduler && readDelay) {
            this.reload();

            scheduler.schedule(async () => {
                try {
                    this.reload();
                } catch (e) {
                    Logger.logError("Problem while fetching/reading posts...", e);
                }
            }, readDelay);
        }
    }

    async reload() {
        Logger.logInfo("Reloading posts...");

        const postsPaths = new Set();

        const posts = await this._fetchPosts();

        posts.forEach(p => {
            postsPaths.add(`/${p.slug}.html`);
            postsPaths.add(`/${p.slug}/`);
        });

        this._posts = postsPaths;
        this._lastReload = new Date();

        Logger.logInfo(`Posts reloaded, have ${this._posts.size} of them`);
    }

    async _fetchPosts(trial = 0, nextDelay = this._retryConfig.initialDelay) {
        try {
            const response = await fetch(this._postsUrl);
            if (response.status >= 400) {
                throw new Error(`Failed to get posts. Got Response: ${response.status}`)
            }
            return response.json();
        } catch (e) {
            if (trial < this._retryConfig.retries) {
                Logger.logInfo(`Error while fetching posts. Retrying after ${nextDelay} for the ${trial + 1} time...`, e);
                await Promises.delay(nextDelay);
                return this._fetchPosts(trial + 1, nextDelay * this._retryConfig.backoffMultiplier);
            }
            throw e;
        }
    }

    postOfPathExists(path) {
        return this._posts.has(path);
    }

    knownPosts() {
        return {
            lastReload: this._lastReload ? this._lastReload.toISOString() : null,
            knownPosts: [...this._posts]
        }
    }
}