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
const pagesDir = path.join(__dirname, "..", "pages");

const distDir = path.join(__dirname, "..", "dist");
const postsJsonPath = path.join(distDir, "posts.json");

const configPath = path.join(__dirname, "..", "config.json");
const config = JSON.parse(await fileContent(configPath));

if (process.env.ENV == 'dev') {
    config.assetsPath = path.join(config.devAssetsPathPrefix, config.assetsPath);
    config.imagesPath = path.join(config.devAssetsPathPrefix, config.imagesPath);
}

const HTML_EXTENSION = ".html";
const JS_EXTENSION = ".js";
const MD_EXTENSION = ".md";

function fileContent(filePath) {
    return fs.promises.readFile(filePath, 'utf-8');
}

function writeFileContent(filePath, fileContent) {
    return fs.promises.writeFile(filePath, fileContent);
}

async function allPages(pagesDir, postsData) {
    const fileNames = fs.readdirSync(pagesDir);

    let pages = {};

    for (const fn of fileNames) {
        const content = await fileContent(path.join(pagesDir, fn));
        pages[fn] = content;
    }

    pages = pagesWithReplacedVariables(pages, config);

    for (const [k, v] of Object.entries(pages)) {
        const matches = v.matchAll(templateVariablesRegex);

        let renderedPage = v;

        for (const match of matches) {
            const trimmedName = match[1].trim();

            if (!isFileVariable(trimmedName)) {
                continue;
            }

            let templ = pages[trimmedName];
            if (!templ) {
                if (trimmedName.includes(".js:")) {
                    const componentName = trimmedName.split(".js:")[1].trim();
                    templ = await jsComponent(componentName, postsData);
                }
                if (!templ) {
                    throw new Error(`There is no page of ${trimmedName} name , but was expected by ${k} page`);
                }
            }

            if (trimmedName.includes(MD_EXTENSION)) {
                templ = markdownToHtml(templ);
            }

            renderedPage = renderedPage.replace(match[0], templ);
        }

        pages[k] = renderedPage;
    }

    return pages;
}

function pagesWithReplacedVariables(pages, variables) {
    const replacedVariablesPages = {...pages};
    for (const [k, v] of Object.entries(pages)) {
        replacedVariablesPages[k] = templateWithReplacedVariables(v, variables, true);
    }
    return replacedVariablesPages;
}

function isFileVariable(variable) {
    return variable.includes(HTML_EXTENSION) || variable.includes(MD_EXTENSION)
        || variable.includes(JS_EXTENSION);
}

function markdownToHtml(markdown) {
    return marked.parse(markdown);
}

async function jsComponent(name, postsData) {
    const jsComponents = await import('../pages/components.js');
    console.log("Getting js component: ", name);
    return jsComponents[name]({ posts: postsData });
}

async function allPosts(postsDir, variables) {
    const fileNames = fs.readdirSync(postsDir);

    const posts = {};

    for (const fn of fileNames) {
        const post = await fileContent(path.join(postsDir, fn));

        const fMatterPost = fontMatterRegex.exec(post);
        let fMatter = JSON.parse(fMatterPost[1]);
        let postContent = post.replace(fMatterPost[0], '');

        posts[fn] = {
            fontMatter: fMatter,
            content: templateWithReplacedVariables(postContent,
                { ...fMatter, ...variables })
        };
    }

    return posts;
}

function templateWithReplacedVariables(template, data, skipMissing=false) {
    const matches = template.matchAll(templateVariablesRegex);

    let renderedTemplate = template;

    for (const match of matches) {
        const key = match[1].trim();
        const value = data[key];

        if (!value) {
            if (skipMissing) {
                continue;
            }
            throw new Error(`Variable of ${key} hasn't been provided`);
        }

        renderedTemplate = renderedTemplate.replace(match[0], value);
    }

    return renderedTemplate;
}


const posts = await allPosts(postsDir, config);
const postsData = [];

for (const [k, e] of Object.entries(posts)) {
    const { fontMatter, content } = e;
    postsData.push(fontMatter);
}

await writeFileContent(postsJsonPath, JSON.stringify(postsData, null, 2));

const pages = await allPages(pagesDir, postsData);

for (const p of config.pagesToRender) {
    await writeFileContent(path.join(distDir, p), pages[p]);
}

const postTemplate = pages[config.postTemplate];

for (const [k, e] of Object.entries(posts)) {
    const htmlContent = markdownToHtml(e.content);
    const variables = { ...config, ...e.fontMatter, post: htmlContent };
    const post = templateWithReplacedVariables(postTemplate, variables);

    await writeFileContent(path.join(distDir, `${e.fontMatter.slug}.html`), post);
}


