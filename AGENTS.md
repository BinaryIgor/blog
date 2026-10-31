# Binary Igor blog – agent guide

## What this repository contains

This is the source for [binaryigor.com](https://binaryigor.com), made of two
separate but related applications:

- a static-site generator (`src/generator.js`) that renders Markdown posts and
  HTML templates into `dist/`;
- an Express + SQLite analytics API (`src/server/`), packaged independently in
  Docker.

The project uses Node.js ESM (`"type": "module"`) and requires Node 20 or
newer. `package-lock.json` is the dependency lockfile.

## Repository map

- `posts/` – one Markdown source file per article, with JSON front matter.
- `pages/` – page templates, reusable HTML/Markdown fragments, and
  `components.js` render functions.
- `assets/` – source CSS, browser analytics code, icons, and images. Post
  images normally live below `assets/images/<post-slug>/`.
- `src/generator.js` – the static-site build pipeline.
- `src/server/` – analytics API, SQLite persistence, scheduling, and input
  validation.
- `src/shared/` – shared utility modules.
- `test/server/` – Mocha tests for API and analytics behavior.
- `ops/` – Docker image packaging, deployment, nginx, and operational scripts.
- `scripts/` – local helper scripts (including image resizing).
- `dist/` – generated site/build output; never make source changes here.

## Common commands

Install dependencies with `npm ci` (or `npm install` when intentionally
updating the lockfile).

```bash
npm test                 # Mocha test suite
npm run build:blog       # recreate dist/, copy assets, compile/minify CSS, generate the site, hash assets
npm run generate:site    # render pages/posts; requires a prepared dist/ directory
npm run generate:site:dev  # generator with /dist asset paths for local serving
npm run build:api        # test, then package the API Docker image
```

`npm run build:blog` deliberately deletes and recreates `dist/`; treat it as
generated output. Docker builds, deployment commands, backup/download scripts,
and scripts under `ops/` can affect external services or machines. Run those
only when the task explicitly calls for them and their target configuration has
been checked.

## Static-site conventions

- Keep a post's JSON front matter valid. Required practical fields include
  `title`, `slug`, `publishedAt`, `excerpt`, and `tags`; use ISO dates
  (`YYYY-MM-DD`). `updatedAt` is optional. A truthy `draft` causes the
  generator to prefix the rendered slug with `__draft__` and omit the post
  from public lists and `posts.json`.
- URLs are based on `slug` and render as `<slug>.html`. Keep slugs stable unless
  redirects/links are deliberately handled too.
- Templates use `{{ variable }}`. File-like variables (for example
  `{{ navigation.html }}` or `{{ about.md }}`) include another page fragment;
  `.js:` entries call exports from `pages/components.js`.
- Generator configuration, rendered top-level pages, and site metadata are in
  `config.json`. Adding a new standalone page usually requires adding it to
  `pagesToRender` as well as creating its source template.
- `pages/components.js` and the matching client-side helpers in `pages/post.html`
  intentionally duplicate some post-preview logic; keep both implementations
  aligned when changing that markup.
- Use `{{ imagesPath }}`/`{{ assetsPath }}` in templates and posts instead of
  hard-coded environment-specific asset prefixes.

## API conventions

- The API entry point is `src/server/server.js`; configuration is read from
  environment variables in `src/server/config.js` and has development-friendly
  defaults using `/tmp` SQLite files.
- Keep request validation and analytics-domain rules in their existing modules
  (`validator.js`, `analytics.js`) rather than adding route-specific bypasses.
- `/internal/*` endpoints execute privileged operational actions. Do not expose,
  loosen, or exercise them against non-local environments without explicit
  authorization.

## Change and verification expectations

- Preserve the existing four-space indentation and the project's current
  JavaScript style; there is no configured formatter or linter.
- For server behavior changes, add or update focused Mocha tests in
  `test/server/`, then run `npm test`.
- For generator, template, content, or CSS changes, run `npm run build:blog`
  and inspect the relevant generated output locally. Do not commit build output
  unless the task explicitly asks for it.
- Do not commit credentials, environment files containing secrets, databases,
  generated artifacts, or `node_modules/`.
- Keep commits and related changes small and focused - explaing them to your human, prioritizing understanding and verifiability over speed
