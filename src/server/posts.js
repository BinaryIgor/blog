import * as Logger from "../shared/logger.js";

export class PostsSource {

    constructor(postsUrl, scheduler, readDelay) {
        this._postsUrl = postsUrl;
        this._posts = new Set();
        this._lastReload = undefined;

        this._reloadPosts();

        scheduler.schedule(async () => this._reloadPosts(), readDelay);
    }

    async _reloadPosts() {
        try {
            const postsPaths = new Set();

            const posts = await this._fetchPosts();

            posts.forEach(p => {
                postsPaths.add(`/${p.slug}.html`);
            });

            this._posts = postsPaths;
            this._lastReload = new Date();
        } catch (e) {
            Logger.logError("Problem while fetching/reading posts...", e);
        }
    }

    async _fetchPosts() {
        const response = await fetch(this._postsUrl);
        return response.json();
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