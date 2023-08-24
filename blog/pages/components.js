//Also used in post.html js, remember to keep in sync!
export function postPreview(post) {
   const postUrl = `${post.slug}.html`;
   return `
   <li class="cursor-pointer border-[3px] border-dashed border-text-secondary-2 rounded-md p-6
        max-content-width m-auto"
    onclick="location.href='${postUrl}'">
        <a href="${postUrl}" class="text-2xl mb-2 font-semibold">${post.title}</a>
        <div class="text-xl mb-4 text-secondary-2">${post.publishedAt}</div>
        <div>${post.excerpt}</div>
    </li>`;
}

export function postsPreview({ posts }) {
    return `
    <ul class="pt-8 space-y-6">
        ${posts.map(p => postPreview(p)).join("\n")}
    </ul>`;
}

export function latestsPostsPreview({ posts }) {
    let latestsPosts = posts.length > 10 ? posts.slice(0, 10) : posts;
    return postsPreview({posts: latestsPosts});
}