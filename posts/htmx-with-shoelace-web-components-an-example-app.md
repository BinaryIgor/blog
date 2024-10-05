---
{
    "title": "HTMX with Shoelace Web Components: an example Books App",
    "slug": "htmx-with-shoelace-components-an-example-app",
    "publishedAt": "2024-10-12",
    "excerpt": "As we already know, HTMX pairs really nicely with Web Components. Shoelace is a popular library/collection of ready-to-be-used and highly configurable Web Components. Since writing your own Web Components library is a lot of work, we would much rather prefer to use something ready and battle tested. Let's then see how this library plays with HTMX!",
    "researchLog": [],
    "writingLog": [ 1, 1, 2 ]
}
---

As we [already know](/htmx-and-web-components-a-perfect-match.html), HTMX pairs really nicely with Web Components. [Shoelace](https://shoelace.style) is a popular library/collection of ready-to-be-used and highly configurable Web Components. Since writing your own Web Components library is a lot of work, we would much rather prefer to use something ready and battle tested. Let's then see how this library plays with HTMX! Other things we will use in an [example Books App](https://github.com/BinaryIgor/TODO) are:
* Tailwind CSS for styling
* Node.js as a server/just app - it is HTMX after all, so there is no frontend/backend distinction

With this simple stack, we will create a fully functional app and see how hard/easy, bad/good it is. But before that, let's spend a while talking about the Shoelace library itself and Shadow DOM in particular.

## Shoelace Library

It is a really well-maintained collection of a huge number of Web Components (it might be the largest one). There are tens of components, ready to be used and configured, to suits our needs. Here are some most prominent examples:
* [Alert](https://shoelace.style/components/alert) 
* [Button](https://shoelace.style/components/button)
* [Checkbox](https://shoelace.style/components/checkbox)
* Dialog
* Input
* Menu
* Option
* Progress Bar
* Progress Ring
* Range
* Select
* ...and so on

**Every component uses Shadow DOM - it has its own benefits and drawbacks.** Because of that, stylization and customization works a little bit differently to what we might be accustomed to in the classic HTML/CSS world. To understand why it is the case, let's spend a while on the Shadow DOM, to understand it better.

### Shadow DOM: is complexity worth the benefits?

What the Shadow DOM even is?
> Shadow DOM is a scoped, separate part of the Document Object Model that can be created within the standard DOM, isolated in both style and structure.

As an example, we can create something like this:
```
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    p {
      color: red;
    }
</style>
</head>
<body>
  <p>Red text</p>
  <custom-component text="Not red, but blue"></custom-component>
  <script>
    customElements.define("custom-component", class extends HTMLElement {
      connectedCallback() {
        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = `
          <style>
            p {
              color: blue;
            }
          </style>
          <p>${this.getAttribute("text")}</p>`;
      }
    });
  </script>
</body>
```
Styles and structure of the Shadow DOM inside this `custom-component` are completely isolated from the global DOM. Global CSS rules do not apply and we cannot get elements of this component by using standard APIs like `Document.getElementById()`, `Document.querySelector()` or `Document.getElementsByTagName()`. We can get them by using `Element.shadowRoot` property though, if it was created with the *open*, not *closed* mode.

\
The benefits are rather obvious - we can create completely independent components which look the same, anywhere they are placed since they are not affected by the global CSS (almost, there are some exceptions). The question is: when and do why need this degree of separation? I would argue that we only need it if:
1. we work on a legacy system where there are many not-so-specific CSS rules which can unexpectedly change styling of various elements; we cannot change it or it is simply not feasible to change how CSS works there
2. we want to create components which look the same anywhere they are used; in a nutshell, we intent to give/sell it to the people working on the systems from point 1.

On the other hand, if we work on a system that follows virtually any of the well-established CSS approaches/conventions:
* BEM (Block, Element, Modifier)
* TailwindCSS utility-first approach
* CSS Modules
* Scoped CSS, suported by every popular SPA framework

...I would argue, that it not a problem, since we have highly specific CSS selectors there. Because of that, our styling will not randomly leak into newly added components. In Shoelace, they made a different decision so obviously they do not agree but I really wanted to get this point across here: we do not need to use Shadow DOM to create highly reusable and framework-agnostic Web Components. It is a choice, with a set of tradeoffs. 

What are the disadvantages? It is harder and less intuitive to style components created with the help of Shadow DOM. We cannot use standard CSS selectors on them or put defined by us classes there. We need to use [CSS shadow parts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_shadow_parts) or CSS variables - they both must be explicitly exported by the Component author, otherwise we are out of luck. It can be still made highly configurable and flexible, as it is with the Shoelace library, but that is something new, something additonal that we need to learn and use, alongside standard CSS rules. Here is a real-world example of styling Sholeace button (`sl-button`):
```
:root,
:host {
  ...

  --color-primary-500: #f59e0b;
  --color-primary-600: #d97706;
  --color-primary-700: #b45309;
  --color-primary-800: #92400e;
  --color-primary-900: #78350f;
  --color-primary-950: #451a03;

  --color-text-600: #52525b;
  --color-text-700: #3f3f46;
  --color-text-800: #27272a;
  --color-text-900: #18181b;
  --color-text-950: #09090b;

  ...

  --sl-color-primary-400: var(--color-primary-400);
  --sl-color-primary-500: var(--color-primary-500);
  --sl-color-primary-600: var(--color-primary-600);
  --sl-color-primary-700: var(--color-primary-700);
  --sl-color-primary-800: var(--color-primary-800);

  ...
}

sl-button[variant="default"]::part(base) {
  border-color: var(--color-primary-400);
  background-color: var(--color-primary-500);
  font-weight: bold;
}

sl-button[variant="default"]::part(base):hover {
  border-color: var(--color-primary-500);
  background-color: var(--color-primary-600);
  color: var(--color-text-600);
}
```

We need to override a few shoelace-specific variables (mostly related to colors) to have consistent colors across application, not only on a button. Shoelace has it mostly documented but it is something that we need to constantly keep in mind and recheck with the docs.

To sum it up, I just do not think that Shadow DOM is worth its complexity, in most cases. Given that, I must say that Shoelace library authors made a superb effor to document how to customize their components using this new browser API. Having understood that, let's finally dive into the HTMX + Shoelace example Books app!

## An example Books App

### Setup

[App](https://github.com/BinaryIgor/code-examples/tree/web-components-experiments/htmx-shoelace-app) consists of two main parts:
* static
* app

In the `static` dir we have all things static:
* fonts in assets
* needed Shoelace components, declared in the `index.js` file
* Tailwind CSS depedency and config
* HTMX dependency
* rollup config to create a few bundles, served by the `app`: Shoelace components and assets, HTMX bundle and, generated with the help of Tailwind, CSS file

After installing dependecies (check out README in the repo), we can build mentioned above distributable:
```
npm run build

> htmx-with-shoelace-app-static@1.0.0 build
> bash build.bash


index.js → dist...
created dist in 1.2s

Rebuilding...

Done in 384ms.
```

In the `dist` we can find a few key static files that the `app` will serve. Assets from the `static/assets` directory will be exposed as well.

In the `app` dir, we have the Books App. It is just a node server, built with the help of `express.js`, with a few endpoint to provide Books functionality and static assets generated in the previous step (`static` dir). 
Basically, in the single HTML page we just have things like ([web.js](https://github.com/BinaryIgor/code-examples/blob/web-components-experiments/htmx-with-shoelace-app/app/src/web.js#L119)):
```
<head>
  ...
  <link rel="stylesheet" href="/dist/shoelace.css">
  <link rel="stylesheet" href="/dist/style.css">
  <link rel="preload" as="font" type="font/ttf" crossorigin="anonymous"
    href="/assets/fonts/Kalam/Kalam-Regular.ttf">
  ...
</head>

<body>
  ...
  <script src="/dist/index.js" defer></script>
  <script src="/dist/htmx/dist/htmx.min.js"></script>
</body>
```

After installing dependencies (check out README in the repo), we can start the app locally by running:
```
npm start

> htmx-with-shoelace-app@1.0.0 start
> node .

Server has started on port 8080!
```

We can now go to http://localhost:8080 and see the Books App!

### Walkthrough

As we are now running the app locally on port 8080, we should be able to see the main page:
<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/main-page.png">
  <figcaption>Books main page with some categories to choose from</figcaption>
</figure>

After selecting one of the categories, we can see books:
<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/category-selected.png">
  <figcaption>Books main page with category selected</figcaption>
</figure>

<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/books-list.png">
</figure>

<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/book-error.png">
</figure>

<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/book-page.png">
</figure>

<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/get-book-offer.png">
</figure>

<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/get-book-offer-error.png">
</figure>

<figure>
  <img src="{{ imagesPath }}/htmx-with-shoelace/get-book-offer-success.png">
</figure>

## Closing thoughts

As we have seen..


<div class="post-delimiter">---</div>

### Notes and resources

1. Shoelace library: https://shoelace.style/. Docs and...
2. https://nolanlawson.com/2023/12/30/shadow-dom-and-the-problem-of-encapsulation/
3. https://www.matuzo.at/blog/2023/pros-and-cons-of-shadow-dom/