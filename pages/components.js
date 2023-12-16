const LATEST_POSTS = 4;

export function postMetadata({ publishedAt, wordsCount, timeToRead, extended = false }) {
    if (!publishedAt) {
        throw new Error("Published at is required, but wasn't supplied!");
    }

    let component = `<span>${publishedAt};</span>`;

    if (wordsCount) {
        component += `<span> ${wordsCount} words;</span>`;
    }

    if (timeToRead) {
        component += `<span> ${timeToRead} to read`;
        if (extended) {
            component += ',</span><span> but probably more to ponder and understand;</span>';
        } else {
            component += ';</span>';
        }
    }

    return component;
}

export function extendedPostMetadata({ publishedAt, wordsCount, timeToRead }) {
    return postMetadata({ publishedAt, wordsCount, timeToRead, extended: true });
}

export function postHtmlDescription({ excerpt, htmlDescription }) {
    const description = htmlDescription ? htmlDescription : excerpt;
    return stripHtml(description);
}

// Also used in post.html js, remember to keep in sync!
export function postPreview(post) {
    const postUrl = `${post.slug}.html`;
    return `
   <li class="cursor-pointer border-[2px] border-solid border-primary-text-faded p-6 rounded
        max-content-width m-auto"
    onclick="location.href='${postUrl}'">
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
        <h2 id="older" class="text-3xl font-bold mt-24 mb-8 anchor-top-scroll">Older</h2>
        ${postsPreview({ posts: olderPosts })}
    `;
}


export function nowDateTime() {
    return new Date().toISOString();
}

export function postsSiteMap({ domain, posts }) {
    return posts.map(p => `
    <url>
        <loc>https://${domain}/${p.slug}.html</loc>
        <lastmod>${p.updatedAt ? p.updatedAt : p.publishedAt}</lastmod>
    </url>`).join("\n");
}

function stripHtml(text) {
    return text.replaceAll(/<[a-zA-Z]+>/g, "")
        .replaceAll(/<\/[a-zA-Z]+>/g, "");
}

export function postsAtomFeed({ domain, posts }) {
    function dateToAtomFeedDateTime(date) {
        return `${date}T00:00:00+00:00`;
    }

    return posts.map(p => `
    <entry xml:lang="en">
        <title>${p.title}</title>
        <id>https://${domain}/${p.slug}</id>
        <link href="https://${domain}/${p.slug}.html" rel="alternate" type="text/html" />
        <published>${dateToAtomFeedDateTime(p.publishedAt)}</published>
        <updated>${dateToAtomFeedDateTime(p.updatedAt ? p.updatedAt : p.publishedAt)}</updated>
        <summary>${stripHtml(p.excerpt)}</summary>
    </entry>`).join("\n");
}