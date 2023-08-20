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

const configPath = path.join(__dirname, "..", "config.json");
const config = JSON.parse(await fileContent(configPath));

function fileContent(filePath) {
    return fs.promises.readFile(filePath, 'utf-8');
}

function writeFileContent(filePath, fileContent) {
    return fs.promises.writeFile(filePath, fileContent);
}

async function allTemplates(templatesDir, postsData) {
    const fileNames = fs.readdirSync(templatesDir);

    const templates = {};

    for (const fn of fileNames) {
        const content = await fileContent(path.join(templatesDir, fn));
        templates[fn] = content;
    }

    for (const [k, v] of Object.entries(templates)) {
        const matches = v.matchAll(templateVariablesRegex);

        let renderedTemplate = v;

        for (const match of matches) {
            const trimmedName = match[1].trim();

            if (!trimmedName.includes(".html") && !trimmedName.includes(".js")) {
                continue;
            }

            let templ = templates[trimmedName];
            if (!templ) {
                if (trimmedName.includes(".js:")) {
                    templ = await jsTemplate(postsData);
                }
                if (!templ) {
                    throw new Error(`There is no template of ${trimmedName} name , but was expected by ${k} template`);
                }
            }

            renderedTemplate = renderedTemplate.replace(match[0], templ);
        }

        templates[k] = renderedTemplate;
    }

    return templates;
}

async function jsTemplate(postsData) {
    const jsTemplates = await import('../templates/templates.js');
    return jsTemplates['postsPreview']({ posts: postsData });
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

        console.log("Replace", match[0], value);
    }

    return renderedTemplate;
}


const posts = await allPosts(postsDir);
const postsData = [];
const postsToRender = [];

for (const [k, e] of Object.entries(posts)) {
    const { fontMatter, content } = e;
    postsData.push(fontMatter);
}

await writeFileContent(postsJsonPath, JSON.stringify(postsData, null, 2));

const templates = await allTemplates(templatesDir, postsData);

for (const p of config.pagesToRender) {
    await writeFileContent(path.join(distDir, p), templates[p]);
}

const postTemplate = templates[config.postTemplate];

for (const [k, e] of Object.entries(posts)) {
    const htmlContent = marked.parse(e.content);
    const variables = { ...config, ...e.fontMatter, post: htmlContent};
    const post = templateWithReplacedVariables(postTemplate, variables);

    await writeFileContent(path.join(distDir, `${e.fontMatter.slug}.html`), post);
}


