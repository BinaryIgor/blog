---
{
    "title": "Multi vs Single Page Apps: user experience, performance, complexity and more",
    "slug": "multi-vs-single-page-apps",
    "startedAt": "2024-03-02",
	"publishedAt": "2025-03-16",
    "excerpt": "The tradeoffs.",
    "writingLog": [ 2, 1.5 ]
}
---

Recently, I have implemented [an example of Projects App twice as](https://github.com/BinaryIgor/code-examples/tree/master/htmx-mpa-vs-react-spa):
* Multi Page Application (MPA), boosted with [HTMX](/htmx-simpler-web-based-app-or-system.html) for partial updates
* Single Page Application (SPA), implemented with the help of React

The goal here was to revisit Multi vs Single Page Applications debate and compare:
* **User experience** - does one feel noticeably better that the other? Does one allow for something that the other does not?
* **Performance** - are there significant differences when it comes to page load speeds?
* **Complexity** - which one is simpler to implement, maintain and extend?

To establish what these differences are, we will go through two implementations of *Projects App* - one as HTMX MPA and the other as React SPA. This will make our comparison more concrete and objective, since the same set of functionalities will be implemented in both cases, only approach is what makes them different. Let's then see, what tradeoffs both of these strategies bring to the table; but before that, we need to establish a few definitions to make sure that we have the same understanding of the most important terminology used here.

## Definitions

**Multi Page Application** is an approach to develop web applications/websites where server mostly returns fully rendered HTML pages, ready to be displayed by the browser. Going from page to page (routing) is handled by the browser as each link click/change triggers full page reload. Full page reloads mean that server returns complete HTML pages with new head, body and script tags, completely isolated from the previous pages. JavaScript is used here and there to enhance some pages/compoents and add dynamic behaviour where it is not possible to do with just HTML or CSS. They key points here are:
* JavaScript is an addition, not core of the solution - most things are handled by the browser automatically, as long as server returns properly rendered HTML pages
* every page change triggers full page reload - new HTML page is returned by the server; we can still have partial updates here and there of course, but that is again an addition, not the essence of this approach
* there is no real backend/frontend distinction - we just have a web app (server) that returns HTML pages, CSS and JavaScript where and if needed

\
**Single Page Application** is an approach to develop web applications where HTML is rendered mostly or completely by the JavaScript on the client side; data is fetched from the server in some data exchange format that is completely different from HTML - JSON is currently the most popular one. Transforming this data to HTML is done by JavaScript; similarly, going from page to page (routing) is handled by JavaScript as well, native browser behavior is reimplemented to work in a slightly different way. Because of this heavy reliance on JavaScript, we have to write lots of it or use a framework that does it for us; in any case, we end up with a rather complex client side application - something that is not needed in the MPA approach. The key points here are:
* JavaScipt is the core of this solution, not an addition - many browser mechanisms are overidden by corresponding JavaScript versions (mostly routing, state management, caching and error handling)
* page changes do no trigger full page reload - routing is handled completely by JavaScript
* there is a sharp backend/frontend distinction - usually, there is a server that exposes JSON API which UI (client app) uses to display data and allows to modify it


## User experience

[To see exactly how (and whether) differently they feel, refer to the video on my YouTube channel](https://www.youtube.com/watch?v=vNzk9trrqy0&t=677s); but basically, there are no significant differences - both behave and feel very smoothly. That is mostly because:
* in both cases, we have inline validation - inputs and forms deliver the same user experience, since even in case of the MPA version, there are no full page reloads here
* full page reloads are incredibly fast - CSS and JS are cached aggresively and new HTML pages are returned in less than 50 ms at 90th percentile (see test results); because of this performance, it is almost impossible to notice that pages are indeeded reloaded
* where applicable, MPA version is boosted with HTMX; in some places (tasks search for example), we do not fully reload the page but update parts of it with HTML partials, directly as returned by the server 

Out of curiosity, I have also run some [Lighthouse tests](https://developer.chrome.com/docs/lighthouse/overview) for both implementations. Here are the results:
```
MPA:
 Performance: 100
 First Contentful Paint (FCP): 0.8 s
 Largest Contentful Paint (LCP): 1.0 s
 Total Blocking Time: 10 ms
 Cumulative Layout Shift: 0
 Speed Index: 0.8 s

SPA:
 Performance: 100
 First Contentful Paint (FCP): 1.4 s
 Largest Contentful Paint (LCP): 1.4 s
 Total Blocking Time: 10 ms
 Cumulative Layout Shift: 0.007
 Speed Index: 1.4 s
```

Both are performant, but we can see, MPA has slightly better metrics here. The difference is also felt in practice - upon clicking new pages - */projects, /tasks, /account* - MPA returns fully visible and rendered page. SPA version changes url immediately (client-side routing), but then we need to wait for fetch API call to finish, before we can see rendered results.

To understand this difference better, let's compare what is required for a page to be fully visible and functional, for both these approaches. For MPA, we need to:
* get HTML page from */projects* url for example
* in this page we have links to CSS and JS that is shared across all pages - we need to get them as well, but they can be and are loaded in parallel
* these CSS and JS assets are reused (the same) across all pages and are aggresively cached, so they are usually fetched just once per user session
* as a result, time to get fully functional and visible `Projects page = GET:projects + (worst of: GET:js, GET:css)`

For SPA, we need to:
* ??


## Performance

Tests...

## Complexity

Lines of code?

## Tradeoffs
?? 

## Conclusion

To conclude...