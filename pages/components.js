const LATEST_POSTS = 5;

const NewsletterSignUp = {
    POST_MID: "POST_MID",
    POST_END: "POST_END",
    POST_FLOATING: "POST_FLOATING",
    LANDING: "LANDING"
};

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
    return newsletterSignUp(NewsletterSignUp.POST_MID, "Enjoying this piece?");
}

export function newsletterSignUpPostEnd() {
    return newsletterSignUp(NewsletterSignUp.POST_END, "Like this type of content?", "my-16");
}

export function newsletterSignUpPostFloating() {
    return newsletterSignUp(NewsletterSignUp.POST_FLOATING);
}

export function newsletterSignUpLanding() {
    return newsletterSignUp(NewsletterSignUp.LANDING);
}

// TODO: refactor
function newsletterSignUp(type, preface, additionalContainerClasses) {
    let containerClass = "border-[2px] border-solid border-primary-text-faded rounded p-6";
    if (additionalContainerClasses) {
        containerClass += " " + additionalContainerClasses;
    }

    let text = `Get the <span class="font-bold">Binary Log</span> - deep dives, discoveries and distilled insights from my latest work:`;
    if (preface) {
        text = preface + " " + text;
    }

    const headerHTML = `<div class="mb-2">${text}</div>`;
    const inputHTML = `<input class="p-2 border-[2px] border-solid border-primary-text-faded rounded w-full bg-primary focus:outline-primary-text focus:outline-[2px] focus:outline placeholder:text-secondary-3"
                placeholder="you@domain.ext" type="email" name="email">`;
    const privacyPolicyHTML = `<a href="/privacy.html" class="underline opacity-80 text-sm">Privacy</a>`;
    const footerHTML = `
    <div class="italic mt-8">Join other developers learning along the way.</div>
    <div class="italic">No spam, no fluff - pure signal. Unsubscribe anytime.</div>`;
    const cancelButtonHTML = `<div class="cursor-pointer text-secondary-3 hover:text-primary" data-close-button>Maybe later</div>`;
    const joinButtonHTML = `<div class="cursor-pointer text-secondary-3 hover:text-primary" data-join-button>Join Binary Log</div>`;

    if (type == NewsletterSignUp.POST_FLOATING) {
        return `
        <div id="newsletter-modal" class="bg-modal hidden fixed top-0 left-0 h-full w-full z-10">
            <div class="max-content-width w-11/12 top-1/2 left-1/2 absolute -translate-x-1/2 -translate-y-1/2 bg-primary border-[2px] border-solid border-primary-text-faded rounded p-6">
            ${headerHTML}
            ${inputHTML}
            ${privacyPolicyHTML}
            ${footerHTML}
            <div class="flex justify-between mt-8">
                ${cancelButtonHTML}
                ${joinButtonHTML}
            </div>
        </div>
        </div>
        <script>(function() {
            console.log("Setting up newsletter sign-up of ${type}");
        })()</script>`;
    }

    return `
     <div class="${containerClass}"
        data-newsletter-sign-up data-newsletter-sign-up-type="${type}">
            ${headerHTML}
            ${inputHTML}
            ${privacyPolicyHTML}
            ${footerHTML}
            <div class="flex justify-end mt-8">
                ${joinButtonHTML}
            </div>
        </div>
        <script>(function() {
            console.log("Setting up newsletter sign-up of ${type}");
        })()</script>`;
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