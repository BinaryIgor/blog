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
            component += ',</span><span> but probably more to understand;</span>';
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
    return htmlDescription ? htmlDescription : excerpt;
}

//Also used in post.html js, remember to keep in sync!
export function postPreview(post) {
    const postUrl = `${post.slug}.html`;
    return `
   <li class="cursor-pointer border-[3px] border-dashed border-text-secondary-2 rounded-md p-6
        max-content-width m-auto"
    onclick="location.href='${postUrl}'">
        <a href="${postUrl}" class="text-2xl mb-2 font-semibold">${post.title}</a>
        <div class="text-lg mb-6 text-secondary-3 flex flex-wrap justify-center whitespace-pre-wrap">${postMetadata(post)}</div>
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
    let latestsPosts = posts.length > 5 ? posts.slice(0, 5) : posts;
    return postsPreview({ posts: latestsPosts });
}

export function postsSiteMap({ domain, posts }) {
    return posts.map(p => `
    <url>
        <loc>https://${domain}/${p.slug}.html</loc>
        <lastmod>${p.updatedAt ? p.updatedAt : p.publishedAt}</lastmod>
    </url>`).join("\n");
}