import * as Files from "../shared/files.js";

export class PostsSource {

    constructor(postsPath) {
        this._postsPath = postsPath;
    }

    async postOfPathExists(path) {
        const posts = JSON.parse(await Files.textFileContent(this._postsPath));

        console.log("path: ",path, "posts :", posts);

        return true;
    }
}