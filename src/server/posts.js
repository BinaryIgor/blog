import * as Files from "../shared/files.js";

export class PostsSource {

    constructor(postsPath, scheduler, readDelay) {
        this._postsPath = postsPath;
        this._posts = new Set();

        scheduler.schedule(async () => {
            try {
                const postsPaths = new Set();
                
                const posts = JSON.parse(await Files.textFileContent(this._postsPath));
                
                posts.forEach(p => {
                    postsPaths.add(`/${p.slug}.html`);
                });

                this._posts = postsPaths;
            } catch(e) {
                console.error("Problem while reading posts...", e);
            }
        }, readDelay);
    }

    postOfPathExists(path) {
        return this._posts.has(path);
    }
}