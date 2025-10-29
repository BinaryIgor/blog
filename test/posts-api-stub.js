import { randomNumber } from "./test-utils.js";


export const route = {
    path: "/posts.json",
    method: "GET",
    handler: postsHandler
};

const POSTS = [
    {
        slug: "about-postgres"
    },
    {
        slug: "abstractions"
    }
];
let additionalPosts = [];

let postsFetchesToFail = 0;
export function failNextNPostsFetches(n) {
    postsFetchesToFail = n;
}

export function setAdditionalPosts(posts) {
    additionalPosts = posts.map(p => { return { slug: p }; });
}

export function allowedPostPaths() {
    return POSTS.map(post => `/${post.slug}.html`);
}

export function randomAllowedPostPath() {
    return allowedPostPaths()[randomNumber(0, POSTS.length)];
}

function postsHandler(_, res) {
    if (postsFetchesToFail > 0) {
        res.sendStatus(500);
        postsFetchesToFail--;
    } else {
        res.send([...POSTS, ...additionalPosts]);
    }
}
