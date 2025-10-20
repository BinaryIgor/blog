import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const componentsTemplatesDir = path.join(__dirname, "components-templates");

const LATEST_POSTS = 5;

const NewsletterSignUpPlacement = {
    POST_MID: "POST_MID",
    POST_END: "POST_END",
    POST_FLOATING: "POST_FLOATING",
    LANDING: "LANDING"
};

function fileContent(filePath) {
    return fs.promises.readFile(filePath, 'utf-8');
}

export function postMetadata({ publishedAt }) {
    if (!publishedAt) {
        throw new Error("Published at is required, but wasn't supplied!");
    }
    return `<span>${publishedAt}</span>`;
}

export function postHtmlDescription({ excerpt, htmlDescription }) {
    const description = htmlDescription ? htmlDescription : excerpt;
    return stripHtml(description);
}

// Also used in post.html js, remember to keep in sync!
export function postPreview(post) {
    const postUrl = `/${post.slug}.html`;
    return `
   <li class="cursor-pointer border-2 border-solid border-primary-text-faded p-6 rounded
        max-content-width m-auto"
        onclick="(function() { const selected = document.getSelection().toString(); if (!selected) location.href='${postUrl}' })()">
        <a href="${postUrl}" class="text-2xl mb-2 font-bold">${post.title}</a>
        <div class="mb-6 text-secondary-3 flex flex-wrap justify-center whitespace-pre-wrap">${postMetadata(post)}</div>
        <div>${post.excerpt}</div>
    </li>`;
}

export function postsPreview({ posts }) {
    return `
    <ul class="space-y-6">
        ${posts.map(p => postPreview(p)).join("\n")}
    </ul>`;
}

export function htmxPostsPreview({ posts }) {
    return tagPostsPreview(posts, "htmx");
}

export function dbsPostsPreview({ posts }) {
    return tagPostsPreview(posts, "dbs");
}

export function modularityPostsPreview({ posts }) {
    return tagPostsPreview(posts, "modularity");
}

export function networksPostsPreview({ posts }) {
    return tagPostsPreview(posts, "networks");
}

function tagPostsPreview(posts, tag) {
    return postsPreview({ posts: posts.filter(p => p.tags && p.tags.includes(tag)) });
}

export function latestsPostsPreview({ posts }) {
    return postsPreview({ posts: latestsPosts(posts) });
}

function latestsPosts(posts) {
    return posts.length > LATEST_POSTS ? posts.slice(0, LATEST_POSTS) : posts;
}

export function allPostsPreview({ posts }) {
    const latests = latestsPosts(posts);

    let olderPosts;
    if (posts.length > latests.length) {
        olderPosts = posts.slice(LATEST_POSTS);
    } else {
        olderPosts = [];
    }

    return `
        <h2 class="text-3xl font-bold mb-8">Latest</h2>
        ${postsPreview({ posts: latests })}
        <h2 id="prior" class="text-3xl font-bold mt-24 mb-8 anchor-top-scroll">Prior</h2>
        ${postsPreview({ posts: olderPosts })}
    `;
}

export function newsletterSignUpPostMid() {
    return newsletterSignUp(NewsletterSignUpPlacement.POST_MID, "Enjoying this piece?");
}

export function newsletterSignUpPostEnd() {
    return newsletterSignUp(NewsletterSignUpPlacement.POST_END, "Like this type of content?", "my-16");
}

export function newsletterSignUpPostFloating() {
    return newsletterSignUp(NewsletterSignUpPlacement.POST_FLOATING);
}

export function newsletterSignUpLanding() {
    return newsletterSignUp(NewsletterSignUpPlacement.LANDING);
}

// TODO: refactor
async function newsletterSignUp(placement, preface, additionalContainerClasses) {
    if (placement == NewsletterSignUpPlacement.POST_FLOATING) {
        const template = await fileContent(path.join(componentsTemplatesDir, "newsletter-sign-up-modal.html"));
        return template.replaceAll("__PLACEMENT__", placement);
    }

    const template = await fileContent(path.join(componentsTemplatesDir, "newsletter-sign-up.html"));
    return template.replaceAll("__CLASSES_TO_APPEND__", additionalContainerClasses ? " " + additionalContainerClasses : "")
        .replaceAll("__PLACEMENT__", placement)
        .replaceAll("__HEADER_PREFACE__", preface ? preface + " " : "");
}

export function feedUpdatedAt({ posts, lastFeedUpdateAtAfterLatestPost = null }) {
    const latestPostPublishedAt = dateToAtomFeedDateTime(posts[0].publishedAt);
    if (lastFeedUpdateAtAfterLatestPost == null) {
        return latestPostPublishedAt;
    }
    return latestPostPublishedAt > lastFeedUpdateAtAfterLatestPost ? latestPostPublishedAt : lastFeedUpdateAtAfterLatestPost;
}

function dateToAtomFeedDateTime(date) {
    return `${date}T00:00:00Z`;
}

export function postsSiteMap({ httpsDomain, posts }) {
    return posts.map(p => `
    <url>
        <loc>${httpsDomain}/${p.slug}.html</loc>
        <lastmod>${p.updatedAt ? p.updatedAt : p.publishedAt}</lastmod>
    </url>`).join("\n");
}

function stripHtml(text) {
    return text.replaceAll(/<[a-zA-Z]+>/g, "")
        .replaceAll(/<\/[a-zA-Z]+>/g, "");
}

export function postsAtomFeed({ httpsDomain, posts }) {
    return posts.map(p => `
    <entry xml:lang="en">
        <title>${p.title}</title>
        <id>${httpsDomain}/${p.slug}</id>
        <link href="${httpsDomain}/${p.slug}.html" rel="alternate" type="text/html" />
        <published>${dateToAtomFeedDateTime(p.publishedAt)}</published>
        <updated>${dateToAtomFeedDateTime(p.updatedAt ? p.updatedAt : p.publishedAt)}</updated>
        <summary>${stripHtml(p.excerpt)}</summary>
    </entry>`).join("\n");
}