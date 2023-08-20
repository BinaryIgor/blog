export function postPreview(post) {
    return `<li class="cursor-pointer border-[3px] border-dashed border-slate-200 max-w-[700px] rounded-md p-6">
    <h2 class="text-2xl mb-2 font-semibold">${post.title}</h2>
    <div class="text-xl mb-4">${post.publishedAt}</div>
    <div>${post.excerpt}</div>
</li>`;
}

export function postsPreview({posts}) {
    const postsList = posts.map(p => postPreview(p)).join("\n");
    return `<ul class="pt-8 flex flex-col gap-10 items-center justify-center">
        ${postsList}
    </ul>
    `;
}