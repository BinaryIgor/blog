---
{
  "title": "Multi vs Single Page Apps: user experience, performance, complexity and more",
  "slug": "multi-vs-single-page-apps",
  "startedAt": "2025-03-02",
  "publishedAt": "2025-03-08",
  "excerpt": "To establish what these differences are, we will go through two implementations of <em>Projects App</em> - one as <em>HTMX MPA</em> and the other as <em>React SPA</em>. This makes our comparison more concrete and objective, since the same functionalities were implemented twice, only approach - MPA vs SPA - is what makes these cases different.",
  "writingLog": [ 2, 1.5, 2.5, 3.5, 2.25, 5, 2 ]
}
---

Recently, I have built [some *Projects App* twice as](https://github.com/BinaryIgor/code-examples/tree/master/htmx-mpa-vs-react-spa):
* **Multi Page Application (MPA)** - boosted with [HTMX](/htmx-simpler-web-based-app-or-system.html) to support partial updates
* **Single Page Application (SPA)** - implemented with the help of React

The goal here was to revisit Multi vs Single Page Applications debate and compare:
* **[User experience](#user-experience)** - does one feel noticeably better than the other? Does one allow for something that the other cannot?
* **[Performance](#performance)** - are there significant differences when it comes to page load speeds?
* **[Complexity](#complexity)** - which one is simpler to implement, maintain and develop?
* **[Tradeoffs](#tradeoffs)** - what both approaches give, what do they take (nothing is for free)?

To establish what these differences are, we will go through two implementations of *Projects App* - one as *HTMX MPA* and the other as *React SPA*. This makes our comparison more concrete and objective, since the same functionalities were implemented twice, only approach - MPA vs SPA - is what makes these cases different. Let's then see what set of tradeoffs both of these strategies bring to the table; but before that, we must establish a few definitions to make sure that we have a common understanding of the most important terminology used here.

## Definitions

**Multi Page Application (MPA)** is an approach to develop web applications or websites where the server mostly returns fully rendered HTML pages, ready to be displayed by browser. Going from one page to another (routing) is handled by the browser as each link click/change triggers full page reload; full page reloads mean that server returns complete HTML page with new `<head>`, `<body>` and possibly `<script>` tags, completely separate and isolated from the previous pages. JavaScript is used here and there to enhance some pages and components, adding dynamic behaviour where it is not possible with static HTML or CSS. They key points here are:
* **JavaScript is an addition, not the core of this solution** - most things are handled by the browser automatically, as long as the server returns properly rendered HTML pages
* most page changes trigger full page reload - new HTML page is returned by the server; we can still have partial updates here and there, but that is also an addition, not the essence of this approach (HTMX helps here a lot)
* there is really no backend/frontend distinction - we just have a web app (server) that returns HTML pages and fragments, CSS and JavaScript (where and if needed)

\
**Single Page Application (SPA)** is an approach to develop web applications where HTML is rendered mostly or completely by JavaScript on the client side; data is fetched from server in some data exchange format that is completely different from HTML - JSON is currently the most popular one. Transforming this data to HTML is done by JavaScript; going from one page to another (routing) is handled by JavaScript as well, native browser behaviour is in many cases reimplemented to work in a slightly different way. This heavy reliance on JS means that we must write lots of it or use a framework that does it for us; in either case, we end up with a rather complex client-side application - something that does not exist in the MPA approach. The key points here are:
* **JavaScript is the core of this solution, not an addition** - many native browser mechanisms are overridden by corresponding JS versions (mainly routing and state management)
* page changes do not trigger full page reloads - routing is handled mostly by JavaScript
* there is a sharp backend/frontend distinction - usually, there is a server (backend) that exposes *JSON API* used by UI (frontend) to display data and modify it


## User experience

[To see exactly how (and whether) both implementations feel differently, refer to the video on my YouTube channel](https://www.youtube.com/watch?v=vNzk9trrqy0&t=677s); I would say that they alike behave very smoothly and feel fast. This is mostly because:
* **in both cases, we have inline validation** - inputs and forms deliver the same user experience, since there are no full page reloads here
* **full page reloads are incredibly fast** - CSS and JS assets are shared and cached between HTML pages, which are returned in *less than 60 ms at 90th percentile* ([see test results](#performance-htmx-mpa)); because of this excellent performance, it is almost impossible to notice that pages are indeed fully reloaded
* **where applicable, MPA version is boosted with HTMX** - in some places (tasks search for example), we do not fully reload the page, but update parts of it directly with HTML partials returned by the server 

\
Out of curiosity, I have also run some [Lighthouse tests](https://developer.chrome.com/docs/lighthouse) for both implementations. Here are the results:
```
HTMX Multi Page Application
 Performance: 100
 First Contentful Paint (FCP): 0.8 s
 Largest Contentful Paint (LCP): 1.0 s
 Total Blocking Time: 10 ms
 Cumulative Layout Shift: 0
 Speed Index: 0.8 s

React Single Page Application
 Performance: 100
 First Contentful Paint (FCP): 1.4 s
 Largest Contentful Paint (LCP): 1.4 s
 Total Blocking Time: 10 ms
 Cumulative Layout Shift: 0.007
 Speed Index: 1.4 s
```

**Both are swift, but MPA has slightly better metrics.** This difference is also noticeable in practice; when clicking to see new pages - */projects, /tasks, /account* - HTMX MPA returns a fully visible and rendered page. React SPA version changes url immediately (client-side routing) to new page address, but then we need to wait for the fetch API call to finish to see rendered results; only then the page becomes fully interactive and useful.

To understand this difference better, let's compare what is required for a particular page to be fully visible and functional. For MPA, we need to:
* GET HTML page from */projects* url for example
* inside this page, there are links to required CSS and JS assets  - they can be and are fetched in parallel
* these CSS and JS assets are reused (are the same) across all pages and are aggressively cached, so they are usually downloaded just once per user session
* as a result, time to get fully visible and functional `Projects page = GET:projects + (worst of: GET:js, GET:css)`

For SPA, we need to:
* GET empty (skeleton) HTML page from */projects* url for example
* similarly, inside this page, there are links to required CSS and JS assets
* JS size is significantly larger - for our MPA it was 51 KB (HTMX, 19 KB gzipped), whereas for SPA it was 293 KB (93 KB gzipped)
* in the same vein, CSS and JS assets are reused (are the same) across all pages and are aggressively cached
* as a result, time to get fully visible and functional `Projects page = GET:projects + (worst of: GET:js, GET:css) + GET:api/projects`

\
As we now know that the user experience differences are minor (MPA has a slight advantage), let's measure page load performance in a more objective manner.

## Performance

Here, we are mostly interested in:
> How much time does it take for a given page to be fully visible and functional?

We might and will measure performance of individual requests as they are components in the whole page load speed equation, but their end sum is what is the most important here.

To perform these tests, we will use a simple [MpaVsSpaLoadTest.java](https://github.com/BinaryIgor/code-examples/blob/master/htmx-mpa-vs-react-spa/load-test/MpaVsSpaLoadTest.java) script that:
* makes 2000 requests with 100 requests per second rate to either HTMX MPA or React SPA, using their various endpoints
* outputs detailed stats per endpoint and per page (sum of a few requests)

A few important details:
* both MPA and SPA are hidden behind Nginx
* Nginx serves mainly as a reverse proxy and https certificates handler
* for SPA, it hosts static files as well - index.html, CSS and JS
* Java server implements MPA, returning fully rendered HTML pages and associated CSS and JS files; at the same time, it implements API for SPA
* both MPA and SPA use the same data stored in the SQLite database

\
[HTMX MPA results](https://github.com/BinaryIgor/code-examples/blob/master/htmx-mpa-vs-react-spa/load-test/results/mpa.txt):
```
Starting MpaVsSpaLoadTest!

Test case: MPA
About to make 2000 requests with 100/s rate to https://htmx-mpa.binaryigor.com host
Timeouts are 5000 ms for connect and 5000 ms for request
Max concurrency is capped at: 200

Endpoints to test (chosen randomly):
GET:js/htmx.2.0.4.min.js
GET:styles_cb92397d6961a772.css
GET:projects
GET:tasks
GET:account

...

2000 requests with 100 per second rate took PT20.434S

...

Executed requests: 2000, with 100/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.022 s
Max: 0.671 s
Mean: 0.037 s

Percentile 50 (Median): 0.027 s
Percentile 75: 0.028 s
Percentile 90: 0.031 s
Percentile 95: 0.034 s
Percentile 99: 0.45 s

...

Pages:

Tasks = (worst of: GET:js/htmx.2.0.4.min.js, GET:styles_cb92397d6961a772.css) + GET:tasks

Min: 0.047 s
Max: 1.246 s
Mean: 0.074 s

Percentile 50 (Median): 0.053 s
Percentile 75: 0.055 s
Percentile 90: 0.059 s
Percentile 95: 0.064 s
Percentile 99: 0.984 s

...

Projects = (worst of: GET:js/htmx.2.0.4.min.js, GET:styles_cb92397d6961a772.css) + GET:projects

Min: 0.047 s
Max: 1.129 s
Mean: 0.074 s

Percentile 50 (Median): 0.053 s
Percentile 75: 0.055 s
Percentile 90: 0.059 s
Percentile 95: 0.066 s
Percentile 99: 0.958 s

...

Account = (worst of: GET:js/htmx.2.0.4.min.js, GET:styles_cb92397d6961a772.css) + GET:account

Min: 0.046 s
Max: 1.188 s
Mean: 0.07 s

Percentile 50 (Median): 0.051 s
Percentile 75: 0.054 s
Percentile 90: 0.058 s
Percentile 95: 0.063 s
Percentile 99: 0.873 s
```

[React SPA results](https://github.com/BinaryIgor/code-examples/blob/master/htmx-mpa-vs-react-spa/load-test/results/spa.txt):
```
Starting MpaVsSpaLoadTest!

Test case: SPA
About to make 2000 requests with 100/s rate to https://react-spa.binaryigor.com host
Timeouts are 5000 ms for connect and 5000 ms for request
Max concurrency is capped at: 200

Endpoints to test (chosen randomly):
GET:/
GET:assets/index-Gy-0gLVz.js
GET:assets/index-BWhT5uIM.css
GET:api/projects
GET:api/tasks
GET:api/user-info

...

2000 requests with 100 per second rate took PT20.488S

...

Executed requests: 2000, with 100/s rate
Requests with connect timeout [5000]: 0, as percentage: 0
Requests with request timeout [5000]: 0, as percentage: 0

Min: 0.021 s
Max: 0.698 s
Mean: 0.038 s

Percentile 50 (Median): 0.026 s
Percentile 75: 0.035 s
Percentile 90: 0.041 s
Percentile 95: 0.048 s
Percentile 99: 0.396 s

...

Pages:

Tasks = GET:/ + (worst of: GET:assets/index-Gy-0gLVz.js, GET:assets/index-BWhT5uIM.css) + GET:api/tasks

Min: 0.075 s
Max: 1.718 s
Mean: 0.124 s

Percentile 50 (Median): 0.087 s
Percentile 75: 0.1 s
Percentile 90: 0.124 s
Percentile 95: 0.144 s
Percentile 99: 1.249 s

...

Projects = GET:/ + (worst of: GET:assets/index-Gy-0gLVz.js, GET:assets/index-BWhT5uIM.css) + GET:api/projects

Min: 0.074 s
Max: 1.734 s
Mean: 0.117 s

Percentile 50 (Median): 0.086 s
Percentile 75: 0.098 s
Percentile 90: 0.124 s
Percentile 95: 0.143 s
Percentile 99: 0.978 s

...

Account = GET:/ + (worst of: GET:assets/index-Gy-0gLVz.js, GET:assets/index-BWhT5uIM.css) + GET:api/user-info

Min: 0.075 s
Max: 1.881 s
Mean: 0.124 s

Percentile 50 (Median): 0.086 s
Percentile 75: 0.098 s
Percentile 90: 0.124 s
Percentile 95: 0.148 s
Percentile 99: 1.243 s
```
`GET:/` in the SPA results stands for *index.html* page. Here is a summary of the results:

#### HTMX MPA {#performance-htmx-mpa}

* The slowest `Tasks page = (worst of: js/htmx.2.0.4.min.js, styles_cb92397d6961a772.css) + tasks`
  * Min: 0.047 s, Max: 1.246 s, Mean: 0.074 s
  * Percentile 50 (Median): 0.053 s, Percentile 75: 0.055 s
  * **Percentile 90: 0.059 s, Percentile 99: 0.984 s**
* The fastest `Account page = (worst of: js/htmx.2.0.4.min.js, styles_cb92397d6961a772.css) + account`
  * Min: 0.046 s, Max: 1.188 s, Mean: 0.07 s
  * Percentile 50 (Median): 0.051 s, Percentile 75: 0.054 s
  * **Percentile 90: 0.058 s, Percentile 99: 0.873 s**

#### React SPA {#performance-react-spa}

* The slowest `Tasks page = index.html + (worst of: assets/index-Gy-0gLVz.js, assets/index-BWhT5uIM.css) + api/tasks`
  * Min: 0.075 s, Max: 1.718 s, Mean: 0.124 s
  * Percentile 50 (Median): 0.087 s, Percentile 75: 0.1 s
  * **Percentile 90: 0.124 s, Percentile 99: 1.249 s**
* The fastest `Projects page = index.html + (worst of: assets/index-Gy-0gLVz.js, assets/index-BWhT5uIM.css) + api/projects`
  * Min: 0.074 s, Max: 1.734 s, Mean: 0.117 s
  * Percentile 50 (Median): 0.086 s, Percentile 75: 0.098 s
  * **Percentile 90: 0.124 s, Percentile 99: 0.978 s**

\
**Both are very performant - for all pages, in both cases, load times are less than 125 ms at 90th percentile!** Nevertheless, Multi Page Application has once more shown a slight advantage.

## Complexity

As we have seen, when it comes to the user experience and performance, the MPA implementation has some advantage - [what about Complexity](https://grugbrain.dev/#grug-on-complexity)?

We might measure complexity in various different ways, there is no one way to do it. First, let's consider what is needed for both MPA and SPA in order to display fully functional pages.

For MPA, there are:
* [HTML templates](https://github.com/BinaryIgor/code-examples/tree/master/htmx-mpa-vs-react-spa/server/static/templates) (Mustache in our case) + inline JavaScript where needed
* one global CSS file, mostly generated by Tailwind CSS
* HTMX library - single JS file
* [Translations.java](https://github.com/BinaryIgor/code-examples/blob/master/htmx-mpa-vs-react-spa/server/src/main/java/com/binaryigor/htmxvsreact/shared/html/Translations.java) file with translations
* external dependencies:
  * Tailwind CSS
  * Mustache templates - Java library, [available in multiple other programming languages as well](https://mustache.github.io)
  * HTMX - JS library

On the server, we use these files and code to take data from the SQLite database and return fully rendered HTML pages and fragments.

For SPA, there are:
* separate JavaScript application, written in React - many files and lots of lines of code
* one global CSS file, mostly generated by Tailwind CSS
* similar [i18n.js](https://github.com/BinaryIgor/code-examples/blob/master/htmx-mpa-vs-react-spa/react/src/i18n.js) file with translations
* external dependencies:
  * Tailwind CSS
  * Node.js and npm
  * react, react-dom, react-router and a few other JS packages

JavaScript application (SPA) is totally separate from the server/backend (our Java app). It makes HTTP requests to the API, implemented in the server app that takes data from the SQLite database, gets JSON in response and transforms it to HTML. For all these operations, we need to write code.

**Conceptually, in the SPA model we have two independent applications that must be maintained and kept in sync separately.** There are more dependencies in this approach as well, since a new set of tools is needed to write these JS frontend applications. On the other hand, backend (server) is simpler, since it does not need to know anything about HTML, CSS or translations - it just returns, validates and allows modification of data. In the MPA model, we have a single application; there are less dependencies and code to write, but treated as one unit, it is indeed more complex. **But, considering it all, as one system - which is more complex? Are number of dependencies, lines of code and components the only metric?** What about their nature and other tradeoffs?

Before answering, [let's count some lines of code](https://github.com/AlDanial/cloc)!

To measure SPA code size, we just need to run (from the root repo dir):
```
docker run --rm -v $PWD/react/src:/tmp aldanial/cloc .

-------------------------------------------------------------------------------
Language                     files          blank        comment           code
-------------------------------------------------------------------------------
JSX                             19            109             52            858
JavaScript                       8             35             80            256
CSS                              1              2              0              9
-------------------------------------------------------------------------------
SUM:                            28            146            132           1123
-------------------------------------------------------------------------------
```
A little over 1100 lines of JavaScript (JSX is just an JS extension). Compared with MPA templates, translations and a single CSS file:
```
docker run --rm \
-v "$PWD/server/static/templates:/tmp" \
-v "$PWD/server/static/styles.css:/tmp/styles.css" \
aldanial/cloc .

-------------------------------------------------------------------------------
Language                     files          blank        comment           code
-------------------------------------------------------------------------------
Mustache                        16             44              0            377
CSS                              1              2              0             11
-------------------------------------------------------------------------------
SUM:                            17             46              0            388
-------------------------------------------------------------------------------
```
**It gives us 1123 lines of code for SPA and 388 for the MPA frontend.**
It should be obvious that *it is not only about the numbers here* - HTML (Mustache) templates are easier to understand and maintain, since they just render HTML based on a set of variables - there is no complex logic besides some JS here and there to make them more dynamic (inline validation, modals, navigation and so on).

As mentioned, HTML controllers (returning HTML instead of JSON) are more complex than their API counterparts:
```
ProjectHTMLController: 92
TaskHTMLController: 172
UserHTMLController: 71

ProjectAPIController: 52
TaskAPIController: 65
UserAPIController: 49

Additionally, HTML controllers use:
 HTMLTemplates: 49
 Translations: 128

As a result:
 HTML: 335 + 49 + 128 = 512
 API: 166
```

Summing it up, where it differed - rendering (frontend) code + HTML/API controllers - we have:
```
HTMX MPA
 rendering = 388
 controllers = 512
 sum = 900

React SPA
 rendering = 1123
 controllers = 166
 sum = 1289
```
...which means **~1.43 times as many (43% more) lines of code for the SPA version**.

As a result, **comparing code size and its nature, required components, skills and dependencies - I would argue that the SPA version is significantly more complex**.

## Tradeoffs

We have analyzed *user experience, performance and code complexity*, which is quite a lot, but what are the other dimensions worth our attention?

**Division of labour** - similarly as with (micro)services, even though they are more complex they do allow for more work to be done in parallel, by multiple people or teams. SPA brings a sharp frontend/backend division, which increases complexity - there are now two components, more code to write and dependencies to manage. As a consequence, in total there is more work to be done, but it is more divisible.

**Components ecosystem** - because the SPA approach has been dominant for a long time, it benefits from a rich ecosystem of libraries and ready-to-use components. For all major SPA frameworks - React, Angular, Vue, Svelte and so on - there are many developed and mature collections/libraries of components. That kind of reuse can make development in the SPA model faster; there also are libraries of universal Web Components ([Shoelace](/htmx-with-shoelace-framework-agnostic-components-in-an-example-app.html) for example) and collections of plain old HTML templates that might be used in the MPA approach, but the fact of the matter is that framework-specific SPA ecosystem is much more developed (at least as of now).

**Skills availability** - people like to specialize and we have been living with frontend/backend split for a long time (it is one of the major SPA approach consequences). Because of that, there simply might be less developers who can and want to understand the whole web development tech stack and take responsibility for it. Even though building in the MPA mode requires less knowledge and skills overall, compared to those required for both frontend and backend development stacks in the SPA approach, it is still quite a lot, and it is rather rarely possessed by a single person.

**Client- vs Server-Driven State** - some applications are just better suited to be rendered mostly or completely on the client side; apps like Paint, Excel, Canva or video conferencing software of the Zoom or the Google Meet variety. In those cases, state is changed almost exclusively by the client, very frequently and might be synced with the server/backend in the background, on dedicated user action or not synced at all, living entirely on the client device. In the Multi Page Application approach, we mostly return rendered HTML pages, created predominantly based on the server, not client, state. It is possible to develop some kind of MPA/SPA hybrid, but most likely it would be more complex than just sticking to one approach that fits the nature of our application more. Although it is not often the case, if our web app can have meaningful offline capabilities, the SPA model fits it better as well.

**Developer experience** - some programmers just like to develop apps in the SPA model, where we have a clear backend/frontend split and the UI state lives and is managed always in a single place, on the frontend. Arguably, there are many tools that make this experience quite pleasant (hot reloading/module replacement for example). In the MPA approach (at least for now), we need to put together a few scripts to have similar development experience; as with components, the SPA approach had a historical head start here as well.

**Search Engine Optimization (SEO)** - if we care about it, we should have fully rendered HTML pages on the server side, which is exactly what MPA does by default (indexing asynchronous JavaScript content is tricky and limited). It is possible to support server-side rendering with SPA frameworks like Vue, React or Angular, but it increases complexity even further; to have it, we need to deploy a separate Node.js (JavaScript) server, since all SPA frameworks are written in and support only JavaScript runtimes. Even then, [it still has limitations](https://vuejs.org/guide/scaling-up/ssr.html) and we have to write our components in a specific way to handle them.

## Conclusion: simpler and faster, but...

As we have seen, **it is totally possible to develop the same app using either MPA or SPA approach and achieve similar user experience and performance**. Surprisingly even, the MPA implementation of *Projects App* has a slight advantage when it comes to both of these dimensions.

What is more, the Multi Page Application approach is characterized by less code and fewer dependencies required - overall, it is simply more lightweight. Additionally, tools like HTMX allow MPAs to efficiently handle partial updates, reducing one of the traditional advantages of SPAs.

On the other hand, Single Page Applications take advantage of a rich and mature ecosystem of frameworks and components that might make development faster. Because of the sharp frontend/backend division, work can also be more easily divided among developers; while the total effort might be higher, more people can work together and at the same time. Lastly, some applications naturally involve extensive client-driven state, where the MPA approach simply does not fit due to its server-driven nature.

**In conclusion, Multi Page Applications offer simpler and often more performant default choice.** Unless we have an application with clear requirements that justify SPA - such as highly complex client-side interactions and state management or sophisticated offline capabilities - starting with MPA is a wiser move.

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. Repo with the code: https://github.com/BinaryIgor/code-examples/tree/master/htmx-mpa-vs-react-spa
2. Related video on my YouTube channel: https://www.youtube.com/watch?v=vNzk9trrqy0
3. I did not know, but the way in which I have implemented the MPA version is a pattern, called *Islands Architecture*:
    1. https://www.patterns.dev/vanilla/islands-architecture/
    2. https://docs.astro.build/en/concepts/islands/
    3. https://deno.com/blog/intro-to-islands
4. Lighthouse tests tool: https://developer.chrome.com/docs/lighthouse
5. cloc tool to count lines of code: https://github.com/AlDanial/cloc
6. Increased CPU load on the server side (rendering) could be also mentioned as a tradeoff of MPAs. I did not cover it because:
   1. when performing load tests (see the YouTube video), CPU usage difference between MPA and SPA was negligible
   2. lower server CPU load in the SPA approach is accompanied by higher CPU load on the client side - they essentially cancel each other out

</div>  