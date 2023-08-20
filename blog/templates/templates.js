export function postPreview(post) {
   const postUrl = `${post.slug}.html`;
   return `
   <li class="cursor-pointer border-[3px] border-dashed border-slate-200 max-w-[700px] rounded-md p-6"
    onclick="location.href='${postUrl}'">
        <a href="${postUrl}" class="text-2xl mb-2 font-semibold">${post.title}</a>
        <div class="text-xl mb-4">${post.publishedAt}</div>
        <div>${post.excerpt}</div>
    </li>`;
}

export function postsPreview({ posts }) {
    return `
    <ul class="pt-8 flex flex-col gap-10 items-center justify-center">
        ${posts.map(p => postPreview(p)).join("\n")}
    </ul>`;
}