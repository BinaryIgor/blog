const LATEST_POSTS = 5;

const NewsletterSignUpPlacement = {
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

export function postUpdatedAt({ publishedAt, updatedAt }) {
    return updatedAt ? updatedAt : publishedAt;
}

export function postOgDatesMetaTags({ publishedAt, updatedAt }) {
    if (updatedAt) {
        return `
        <meta property="article:published_time" content="${dateToIsoDateTime(publishedAt)}">
        <meta property="article:modified_time" content="${dateToIsoDateTime(updatedAt)}">`.trim();
    }
    return `<meta property="article:published_time" content="${dateToIsoDateTime(publishedAt)}">`;
}

export function postLdDates({ publishedAt, updatedAt }) {
    if (updatedAt) {
        return `
        "datePublished": "${dateToIsoDateTime(publishedAt)}",
        "dateModified": "${dateToIsoDateTime(updatedAt)}`.trim();
    }
    return `"datePublished": "${dateToIsoDateTime(publishedAt)}"`;
}

export function postMetaDescription({ excerpt, metaDescription }) {
    const description = metaDescription ? metaDescription : excerpt;
    return stripHtml(description);
}

// TODO
export function postMetaImage({ httpsDomain, defaultMetaImage, metaImage }) {
    return metaImage ? `${httpsDomain}/${metaImage}` : `${httpsDomain}/todo.jpg`;
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
    <ul class="flex flex-col gap-6">
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
        <h2 id="prior" class="text-3xl font-bold mt-16 mb-8 anchor-top-scroll">Prior</h2>
        ${postsPreview({ posts: olderPosts })}
    `;
}

export function newsletterSignUpPostMid() {
    return newsletterSignUp(NewsletterSignUpPlacement.POST_MID, "Enjoying this piece?", "my-6");
}

export function newsletterSignUpPostEnd() {
    return newsletterSignUp(NewsletterSignUpPlacement.POST_END, "Like this type of content?", "mt-24 mb-16");
}

export function newsletterSignUpPostFloating() {
    return newsletterSignUp(NewsletterSignUpPlacement.POST_FLOATING);
}

export function newsletterSignUpLanding() {
    return newsletterSignUp(NewsletterSignUpPlacement.LANDING);
}

// trimming is crucial: without it, markdown -> html conversion is broken when embedding this component inside markdown!
function newsletterSignUp(placement, preface, additionalContainerClasses) {
    let headerMessage = `Get the <span class="font-bold">Binary Log</span> Newsletter - deep and broad dives, discoveries and distilled insights for driven developers who care about the craft:`;
    if (preface) {
        headerMessage = preface + " " + headerMessage;
    }
    const headerHTML = `<div class="mb-2">${headerMessage}</div>`;
    const inputHTML = `
    <input class="p-2 border-2 border-solid border-primary-text-faded rounded w-full bg-primary focus:outline-primary-text focus:outline-2 focus:outline placeholder:text-secondary-3" 
        placeholder="you@domain.ext" type="email" name="email" autocomplete="email">
    <span class="text-error block my-2 hidden text-sm" data-email-error>Valid email is required.</span>
    <div class="opacity-80 text-sm my-2"><a href="/privacy-policy.html" class="underline">Privacy Policy</a></div>`
        .trim();
    const footerHTML = `
    <div class="italic mt-8">
        <div>No spam, no fluff - pure signal. Unsubscribe anytime.</div>
    </div>`
        .trim();

    let buttonsHTML;
    if (placement == NewsletterSignUpPlacement.LANDING) {
        buttonsHTML = `
        <div class="flex justify-end mt-8">
            <div class="newsletter-sign-up-button" data-join-button>Join Log</div>
        </div>`
            .trim();
    } else if (placement == NewsletterSignUpPlacement.POST_FLOATING) {
        buttonsHTML = `
        <div class="flex justify-between mt-8">
            <div class="newsletter-sign-up-button mr-4" data-close-button>Not Yet</div>
            <div class="newsletter-sign-up-button ml-4" data-join-button>Join Log</div>
        </div>`
            .trim();
    } else {
        buttonsHTML = `
        <div class="flex justify-between mt-8">
            <div class="newsletter-sign-up-button mr-4" data-joined-already-button>Already In</div>
            <div class="newsletter-sign-up-button ml-4" data-join-button>Join Log</div>
        </div>`
            .trim();
    }

    if (placement == NewsletterSignUpPlacement.POST_FLOATING) {
        return `
        <div class="bg-modal hidden fixed top-0 left-0 h-full w-full z-10" data-newsletter-sign-up-modal
            data-newsletter-sign-up-placement="${placement}">
            <div data-modal-content class="max-content-width w-11/12 top-1/2 left-1/2 absolute -translate-x-1/2 -translate-y-1/2 bg-primary border-2 border-solid border-primary-text-faded rounded p-6">
            ${headerHTML}
            ${inputHTML}
            ${footerHTML}
            ${buttonsHTML}
            </div>
        </div>`
            .trim();
    }

    let containerClasses = "border-2 border-solid border-primary-text-faded rounded p-6";
    if (additionalContainerClasses) {
        containerClasses = containerClasses + " " + additionalContainerClasses;
    }

    return `
    <div class="${containerClasses}" data-newsletter-sign-up data-newsletter-sign-up-placement="${placement}">
    ${headerHTML}
    ${inputHTML}
    ${footerHTML}
    ${buttonsHTML}
    </div>`
        .trim();
}

export function feedUpdatedAt({ posts, lastFeedUpdateAtAfterLatestPost = null }) {
    const latestPostPublishedAt = dateToIsoDateTime(posts[0].publishedAt);
    if (lastFeedUpdateAtAfterLatestPost == null) {
        return latestPostPublishedAt;
    }
    return latestPostPublishedAt > lastFeedUpdateAtAfterLatestPost ? latestPostPublishedAt : lastFeedUpdateAtAfterLatestPost;
}

function dateToIsoDateTime(date) {
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
        <published>${dateToIsoDateTime(p.publishedAt)}</published>
        <updated>${dateToIsoDateTime(p.updatedAt ? p.updatedAt : p.publishedAt)}</updated>
        <summary>${stripHtml(p.excerpt)}</summary>
    </entry>`).join("\n");
}