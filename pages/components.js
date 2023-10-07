export function postMetadata({ publishedAt, wordsCount, timeToRead }) {
    if (!publishedAt) {
        throw new Error("Published at is required, but wasn't supplied!");
    }

    let component = `${publishedAt};`;

    if (wordsCount) {
        component += ` ${wordsCount} words;`;
    }

    if (timeToRead) {
        component += ` ${timeToRead} to read;`;
    }

    return component;
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
        <div class="text-lg mb-6 text-secondary-3">${postMetadata(post)}</div>
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
    let latestsPosts = posts.length > 10 ? posts.slice(0, 10) : posts;
    return postsPreview({ posts: latestsPosts });
}

export function postsSiteMap({ domain, posts }) {
    return posts.map(p => `
    <url>
        <loc>https://${domain}/${p.slug}.html</loc>
        <lastmod>${p.updatedAt ? p.updatedAt : p.publishedAt}</lastmod>
    </url>`).join("\n");
}