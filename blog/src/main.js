import { marked } from 'marked';

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fontMatterRegex = /^---(.*?)---/s;
const templateVariablesRegex = /\{\{(.+?)\}\}/g;

const postsDir = path.join(__dirname, "..", "posts");
const templatesDir = path.join(__dirname, "..", "templates");

const distDir = path.join(__dirname, "..", "dist");
const postsJsonPath = path.join(distDir, "posts.json");

function fileContent(filePath) {
    return fs.promises.readFile(filePath, 'utf-8');
}

function writeFileContent(filePath, fileContent) {
    return fs.promises.writeFile(filePath, fileContent);
}

async function allTemplates(templatesDir) {
    const fileNames = fs.readdirSync(templatesDir);

    const templates = {};

    for (const fn of fileNames) {
        const content = await fileContent(path.join(templatesDir, fn));
        templates[fn] = content;
    }

    return templates;
}

async function allPosts(postsDir) {
    const fileNames = fs.readdirSync(postsDir);

    const posts = {};

    for (const fn of fileNames) {
        const post = await fileContent(path.join(postsDir, fn));

        const fMatterPost = fontMatterRegex.exec(post);
        let fMatter = JSON.parse(fMatterPost[1]);
        let postContent = post.replace(fMatterPost[0], '');

        posts[fn] = {
            fontMatter: fMatter,
            content: postContent
        };
    }

    return posts;
}

function templateWithReplacedVariables(template, data) {
    const matches = template.matchAll(templateVariablesRegex);

    let renderedTemplate = template;

    for (const match of matches) {
        const key = match[1].trim();
        const value = data[key];

        if (!value) {
            throw new Error(`Variable of ${key} hasn't been provided`);
        }

        renderedTemplate = renderedTemplate.replace(match[0], value);
    }

    return renderedTemplate;
}

const index = await fileContent(path.join(templatesDir, "index.html"));
const post = await fileContent(path.join(postsDir, "reduce-the-search-space.md"));

const html = marked.parse(post);

// console.log(html)

// console.log("\n");

// console.log("Raw index: ", index);
// console.log();

// const renderedIndex = templateWithReplacedVariables(index, {
//     posts: [
//         `<p>Reduce the search space</p>\n`,
//          `<p>Building Static Site Generator from scratch</p>`]
// });
// console.log("Rendered index:", renderedIndex);

const templates = await allTemplates(templatesDir);

// console.log(templates);

const posts = await allPosts(postsDir);
const postsData = [];

for (const [k, e] of Object.entries(posts)) {
    const { fontMatter, content } = e;
    console.log(fontMatter);
    console.log(marked.parse(content));
    postsData.push(fontMatter);
}

await writeFileContent(postsJsonPath, JSON.stringify(postsData, null, 2));
