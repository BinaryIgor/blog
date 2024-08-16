import { marked } from 'marked';

const markedRenderer = {
    heading({ text, depth }) {
        const escapedText = text.toLowerCase()
            .replace(/<a(.*?)>(.*?)<\/a>/g, (match, g1, g2) => g2)
            .replace(/[^\w]+/g, (match) => {
                const trimmedMatch = match.trim();
                if (trimmedMatch == '?' || trimmedMatch == '.' || trimmedMatch == '!') {
                    return '';
                }
                return '-';
            });
        return `
        <h${depth} id="${escapedText}">
            ${text}
        </h${depth}>`;
    }
};

marked.use({ renderer: markedRenderer });

import fs from "fs";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const draftPrefix = "__draft__";

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

const jsComponents = await import('../pages/components.js');

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

            if (!isFileVariable(trimmedName) || isFunctionVariable(trimmedName)) {
                continue;
            }

            let templ = pages[trimmedName];
            if (!templ) {
                if (isJsComponent(trimmedName)) {
                    templ = renderedJsComponent(trimmedName, { ...config, posts: postsData });
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
    const replacedVariablesPages = { ...pages };
    for (const [k, v] of Object.entries(pages)) {
        replacedVariablesPages[k] = templateWithReplacedVariables(v, variables, { skipMissing: true });
    }
    return replacedVariablesPages;
}

function isFileVariable(variable) {
    return variable.includes(HTML_EXTENSION) || variable.includes(MD_EXTENSION)
        || variable.includes(JS_EXTENSION);
}

function isJsComponent(variable) {
    return variable.includes(".js:");
}

function renderedJsComponent(variable, args) {
    let componentName = variable.split(".js:")[1].trim();
    if (isFunctionVariable(componentName)) {
        componentName = componentName.replace("(", "").replace(")", "").trim();
    }
    return jsComponents[componentName](args);
}

function isFunctionVariable(variable) {
    return variable.includes("()") || variable.includes("( )");
}

function markdownToHtml(markdown) {
    return marked.parse(markdown);
}

async function allPosts(postsDir, variables) {
    const fileNames = fs.readdirSync(postsDir);

    const posts = {};

    for (const fn of fileNames) {
        const post = await fileContent(path.join(postsDir, fn));

        const fMatterPost = fontMatterRegex.exec(post);
        let fMatter = JSON.parse(fMatterPost[1]);

        let postContent = post.replace(fMatterPost[0], '');

        if (fMatter.draft) {
            fMatter.slug = draftPrefix + fMatter.slug;
        }

        posts[fn] = {
            fontMatter: fMatter,
            content: templateWithReplacedVariables(postContent,
                { ...fMatter, ...variables })
        };
    }

    return posts;
}

function sortedPostsFromRecentOnes(posts) {
    return posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function templateWithReplacedVariables(template, data, opts = { renderFunctions: false, skipMissing: false }) {
    const matches = template.matchAll(templateVariablesRegex);

    let renderedTemplate = template;

    for (const match of matches) {
        const key = match[1].trim();

        let value;
        if (opts.renderFunctions && isFunctionVariable(key)) {
            value = renderedJsComponent(key, data);
        } else {
            value = data[key];
        }

        if (!value) {
            if (opts.skipMissing) {
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

const withoutDraftsPostsData = postsData.filter(p => !p.draft);
const withoutDraftsSortedPostsData = sortedPostsFromRecentOnes(withoutDraftsPostsData);

await writeFileContent(postsJsonPath, JSON.stringify(withoutDraftsSortedPostsData, null, 2));

const pages = await allPages(pagesDir, withoutDraftsSortedPostsData);

for (const p of config.pagesToRender) {
    await writeFileContent(path.join(distDir, p), pages[p]);
}

const postTemplate = pages[config.postTemplate];

for (const [k, e] of Object.entries(posts)) {
    const htmlContent = markdownToHtml(e.content);
    const variables = { ...config, ...e.fontMatter, post: htmlContent };
    const post = templateWithReplacedVariables(postTemplate, variables, { skipMissing: false, renderFunctions: true });

    await writeFileContent(path.join(distDir, `${e.fontMatter.slug}${HTML_EXTENSION}`), post);
}