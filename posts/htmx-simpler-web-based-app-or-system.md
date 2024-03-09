---
{
    "title": "HTMX: simpler web-based app/system",
    "slug": "htmx-simpler-web-based-app-or-system",
    "publishedAt": "2023-09-22",
    "timeToRead": "22 minutes",
    "wordsCount": 2687,
    "excerpt": "Nowadays, when we develop web-based app/system it is most likely built as SPA, which is a single page application. We should ask, why have we done that? Why have we switched from multi page applications, where the browser supported all of these functions out of the box, functions that we now need to recreate by writing custom JavaScript code?",
    "writingLog": [ 1.5, 4.5, 1.5, 0.5, 4, 1.5, 2.5, 1]
}
---

## Current approach - SPA

Nowadays, when we develop web-based app/system it is most likely built as SPA, which is a single page application.
In that model, we have a *server*, often called *<a href="https://en.wikipedia.org/wiki/REST" >REST API</a>*, which (for the most part) does not know anything about *UI* (User Interface). 
Then we also have a thick *client* which is a JavaScript application responsible for all things that were (and still can be) the responsibility of a browser. This app needs to:
* handle routing (going through pages) without doing full page reload
* make http requests to get data in the JSON format (most popular as of now) from the server and map it to HTML, so the browser can render it and show to the user
* translate some of the user actions (taken on HTML page) into JSON, so that they can be sent to the server and trigger some kind of action/state change

As we can see, there are quite a few functions that were traditionally handled by the browser and now we need to write a custom code to replicate them (if we want to use the SPA approach). This problem is a generic one, so many frameworks and libraries have sprung out to solve it, but the complexity is still there.

We should ask, why have we done that? **Why have we switched from multi page applications, where the browser supported all of these functions out of the box, functions that we now need to recreate by writing custom JavaScript code?** Mostly because of the user experience. We can create a superior, more app-like experience approaching the web in this way. When we do not need to do a full page reload, the whole experience in the browser feels much more like a native app, not a website. It can be faster also. After the initial load, we do exchange less data, going through pages, but whether it holds true depends on the particular implementation. For the most part, *if done correctly*, experience of the SPA with comparison to the traditional, multi-page website/application is better (if you do need that kind of experience. For blogs, like this one, I am completely fine with full page reloads. It is a blog after all, not an app). Another important factor is work organization. It is just easier to parallelize the development, when we have clear frontend and backend separation and each component could be taken care of by a dedicated person or team.

## Duplication and complexity

As we have established, in the SPA approach, we get some data (mostly, but not necessarily, in the JSON format) from the server and we then transform it to the HTML, so that the browser can render it. To do that, we have to model this data. As we know, we also need to have a server, so it needs to be modeled there as well. It is always easier to work on a concrete example, so **<a href="https://github.com/BinaryIgor/code-examples/tree/master/some-wisdom-htmx-app" >let's consider the following system</a>**:
* there are authors with quotes (assuming that they are in the system, we do not bother with managing them)
* we can search authors by name, getting back matching authors + random quote for each
* we can go to a single author page, where there is their bio and a list of quotes
* we can go the page with a single quote, where we can:
    * see other users notes to this quote
    * add our own note to the quote

How would we approach designing an app like that using SPA + API approach? First, we need to define an API, the contract between client and the server. It can look something like that:
```
GET: /authors?search={phrase}
Response: [
  {
    "author": string,
    "quote": string
  }
]

GET: /authors/{author}
Response: {
  "author": string,
  "bio": string,
  "quotes": [
    {
      "id": number,
      "quote": string
    }
  ]
}

GET: /quotes/{quoteId}
Response: {
  "quote": {
    "id": number
    "content": string,
    "author": string
  },
  "notes": [
    {
      "id": number,
      "note": string,
      "author": {
        "id": number,
        "name": string
      }
    }
  ]
}

...other endpoints
```
After establishing this contract we would then need to:
* implement it by writing and testing backend app
* implement it by writing and testing fronted app
* test it all together

**That is... complexity, lots of moving parts**. In practice, most often it is either two people/teams doing that, or if you do it on your own (respect for all generalists/fullstacks!), there is a lot of mental gymnastics and context switching involved (different programming models, often also languages, development and runtime environments etc.). Fundamentally, there is just tons of code to write and test. We have to model, implement and test our domain and its rules two times. Certainly there are some contextual differences, but many things do duplicate, as we need to work in the following flow (more or less):
```
html -> json -> http request -> http response -> json -> html
```

**Models, validation, error handling, tests.... what if we can write it all once, in a single place, but maintain all (or almost all) flexibility and control over user experience that we have with SPA?** That is where HTMX comes in.

## HTMX - fewer layers, simpler system

Is it possible to simplify it and have just one (sort of) layer for data serialization and deserialization? Is it possible to simplify our previous flow to just:
```
html -> http request -> http response -> html
```
...?
HTMX takes an approach, where it is indeed possible (or at least something very close to it). Instead of going through the hustle of sending and receiving JSON (or some other data representation format) and then translating it back and forth to HTML, **we can just receive ready to be rendered HTML pages and fragments**.

How does it work? HTMX is just a JavaScript library. We add it as a dependency and then it allows us to trigger virtually any ajax (http) request from any HTML element (WebSockets are also supported). In non-extended, standard HTML this can be done to a very limited degree, both when it comes to form and source of request (mostly on the form element and also by getting media directly in the video and audio HTML elements). With HTMX, we can update fragments of our HTML page just like this:
```
<html>
  <head>
    <title>HTMX - single index.html page</title>
  </head>
  <body>
    <h1>HTMX - single index.html page</h1>
    <h2>Items</h2>
    <div id="items">
      <ul>
        <li>First item: 1</li>
        <li>Second item: 2</li>
      </ul>
    </div>
    <button hx-post="/reverse-items" hx-target="#items">Reverse items</button>
    <!--HTMX library goes here-->
    <script src="https://unpkg.com/htmx.org@1.9.5"></script>
   </body>
<html>
```
What will happen here?
* on the button click (we can override it to be virtually any event!) HTMX will issue *POST* request to the */reverse-items* url
* it will then take response from the server and swap *#items* div content directly with what it got from the server

To illustrate:
```
Page before request:
<body>
  <h1>HTMX - single index.html page</h1>
  <h2>Items</h2>
  <div id="items">
    <!--This will be changed-->
    <ul>
      <li>First item: 1</li>
      <li>Second item: 2</li>
    </ul>
    <!--This will be changed-->
  </div>
  <button hx-post="/reverse-items" hx-target="#items">Reverse items</button>
  <script src="https://unpkg.com/htmx.org@1.9.5"></script>
</body>


On a click, 
HTMX does POST to /reverse-items
and gets HTML fragment in the response:
<ul>
  <li>Second item: 2</li>
  <li>First item: 1</li>
</ul>

Page after request:
<body>
  <h1>HTMX - single index.html page</h1>
  <h2>Items</h2>
  <div id="items">
    <!--This was changed-->
    <ul>
      <li>Second item: 1</li>
      <li>First item: 1</li>
    </ul>
    <!--This was changed-->
  </div>
  <button hx-post="/reverse-items" hx-target="#items">Reverse items</button>
  <script src="https://unpkg.com/htmx.org@1.9.5"></script>
</body>
```
It basically means that **just by adding these two custom HTML attributes, we can update any fragment of our page with the data returned directly from the server, without writing any JavaScript code**. Isn't that amazing? Isn't the problem that most SPA frameworks are trying to solve? Updating the page partially, without reloading it fully?

What about routing? It is simply going to a different page (route), but as with SPA, without doing full page reload. Well, that is also simple. Using HTML fragment from **<a  href="https://github.com/BinaryIgor/code-examples/tree/master/some-wisdom-htmx-app">my simple Some Wisdom App</a>**, where we have a list of authors:
```
<div hx-history="false" id="app">
...
<div class="w-full p-4">
<div class="relative">
<input id="search-authors-input" class="p-2 ..." 
  name="authors-search" 
  placeholder="Search for interesting authors by their name..." 
  hx-trigger="keyup changed delay:500ms" 
  hx-post="/search-authors" 
  hx-target="#search-results" 
  ...>
...
<div class="mt-2" id="search-results">
<div class="space-y-4">
  <div class="rounded-lg ..." 
    hx-target="#app" 
    hx-get="/authors/Jordan Peterson" 
    hx-push-url="true">
    <div class="text-xl">Jordan Peterson</div>
    <div class="text-zinc-300 ...">"When you have something to say silence is a lie."</div>
    </div>
  <div class="rounded-lg ..." 
    hx-target="#app"
    hx-get="/authors/Saifedean Ammous"
    hx-push-url="true">
    <div class="text-xl">Saifedean Ammous</div>
    <div class="text-zinc-300 ...">"Civilization is not about more  capital accumulation per se; rather, it is about what capital accumulation allows humans to achieve, the flourishing and freedom to seek higher meaning in life when their base needs are met and most pressing dangers averted."</div>
  </div>
</div>
...
```
Here, besides <a  href="https://tailwindcss.com">Tailwind</a> for CSS, we can see lots of HTMX tags/attributes. Let's focus on the div:
```
<div class="rounded-lg ..." 
  hx-target="#app" 
  hx-get="/authors/Jordan Peterson" 
  hx-push-url="true">
```
Here, HTMX will swap content of *#app* (almost the entire page, convention taken from SPA's) with the results of */authors/Jordan Peterson* request. *hx-push-url="true"* means that the url of value from *hx-get* attribute will be pushed to the browser history, which means the following flow:
1. *app-domain.com*: user clicks on our div with *hx-get="/authors/Jordan Peterson"* and *hx-push-url="true"*
2. User lands on *app-domain.com/authors/Jordan Peterson* without full page reload, just by updating relevant part of the DOM (Document Object Model) with the response from server, which is done entirely by HTMX
3. User clicks the back button and is on the *app-domain.com* again, again without going through a full page reload. It just happens by the virtue of swapping HTML fragments from the server with the relevant DOM fragment

Concluding all of that, routing can be done in a simple way without using a dedicated library. To handle errors on forms and from http/websockets requests we can use **quite elegant <a href="https://htmx.org/events" >HTMX events API</a>**. Let's see how we can handle form validation completely on the server side (in one place), but with as good user experience as we expect from full-fledged SPA. <a href="https://github.com/BinaryIgor/code-examples/blob/master/htmx-single-index-html-page/index.js" >Here is the full code</a>:
```
<body>
  <h1>HTMX - single index.html page</h1>
  <h2>Items</h2>
  <div id="items"></div>
  <h2>Add item</h2>
  <div style="color: red;" id="errors-container"></div>
  <form hx-post="/add-item" hx-target="#items">
    <input name="name" placeholder="Item name...">
    <br>
    <input name="value" placeholder="Item value...">
    <br>
    <input type="submit" value="Add item">
  </form>
  <script>
    const errorsContainer = document.getElementById("errors-container");
    document.addEventListener("htmx:afterRequest", e => {
    console.log("After request we have", e);
      if (e.detail.failed) {
        errorsContainer.innerHTML = e.detail.xhr.response;
      } else {
        errorsContainer.innerHTML = "";
      }
    });
  </script>
  <!--HTMX library goes here-->
</body>
```

Here, we listen to the provided by HTMX *htmx:afterRequest* event. As the name suggests, it is triggered after every http request issued by HTMX. We then check whether the request failed (non-200 response code) and render error returned directly from the server, in our *#errors-container* div. Error could be a text or HTML fragment, whatever we want to have directly rendered to present an error to the user.

Getting back to our server. As said, in the SPA approach it would return mostly JSON data. Using HTMX, we sometimes need full HTML pages, sometimes HTML fragments. So, let's say that we have our app on the *awesome-app.com* domain. When the user navigates to *awesome-app.com*, the server responds with the full HTML page with the relevant JS, CSS and whatever other static files are needed to render the full page. This page and related files will be defined in one repository, close to the server code. When we navigate to the *awesome-app.com/feature-1* let's say, another HTML fragment needs to be returned. In the SPA approach, our frontend app would handle this routing (in the JavaScript code) and then probably on */feature-1* screen issue a request to the server to get some relevant data. With HTMX, our *awesome-app.com* screen (defined in the backend code/templates) have a button/div/something clickable of the kind:
```
<button hx-post="/feature-1" hx-push="true">Feature 1</button>
```
And as we know, upon clicking it, the server will return an HTML fragment ready to be rendered directly in the browser. 
Instead of sending and receiving JSON, our server now returns HTML pages and fragments. That does mean a little more code there (on the server side), but we do not have a separate frontend app anymore. We just have a single app, with the server code and UI pages and fragments/components. Server can be written in any language/framework (JavaScript also). Most of our frontend will be defined in HTML pages (with HTMX tags/attributes) + CSS + some custom JS for error handling/representation and whatever else we wish. **The amount of JavaScript that we need to write is minimal and it serves only to enhance our app's behavior, not to constitute its most important part.**

Quite interestingly, because we have a single app with one deployment, **we can easily write end-to-end tests using something like <a href="https://playwright.dev/" >Playwright</a> or <a  href="https://www.cypress.io/">Cypress</a>**. We can run our app locally, in the same manner as it will be run in the production and have it truly e2e-tested (we can also do this with SPA approach, but there we need to setup backend and frontend separately, which is a little harder to do, not impossible, but harder).

## Is it really that simple?

Is it really all great and wonderful? **Are there no trade-offs? As with everything, there are. Whether they are worth taking depends completely on the particular case.** As we have shown, HTMX is quite robust. I believe that the majority of UI's can be built using HTMX and the resulting system will be simpler and easier to develop, without sacrificing user experience, than the traditional SPA approach. How much? It depends on the particularities of the project. What are the problems and challenges worth considering before jumping into HTMX?

First of all, it is quite a novel approach. Developers might be scarce and reluctant to use HTMX and it can be harder to find rich libraries of components. That will most likely change with the passage of time and we can get very far with just CSS (Tailwind/other CSS library) and our own custom JavaScript, but depending on the project design and needs, we might have to write more code to have our desired UI components. There are just fewer ready-to-use components, like there are for Vue, React or Svelte (most libraries of components are framework-specific). As said, that will probably be less and less true as HTMX gains popularity, but it is still the case as of now. Moreover, **there already are interesting ideas and initiatives like <a href="https://shoelace.style" >shoelace</a>, which is a library based on <a  href="https://developer.mozilla.org/en-US/docs/Web/API/Web_components">Web Components</a>**. They are completely framework-agnostic and supported natively by the browsers.

Second, there are applications that just are not suitable to write in HTMX. Cases where UI changes are mainly done without any interaction with the server or they need to be real-time fast. <a  href="https://en.wikipedia.org/wiki/WebRTC">WebRTC (Web Real-Time Communication)</a> comes to mind here. We probably should not build a virtual conference room in HTMX, because UI changes are dictated by non-HTTP data exchanges (we can still build the rest of the app in HTMX, implementing this one screen using vanilla JS). Another one can be if we have many (many, not one) cases where input from one fragment on the page often causes data in multiple places of the page to change. Realistically though, we would need to have a case similar to an excel spreadsheet, rather than just something like adding an item to the basket + updating items counter in the different parts of the page. **<a  href="https://htmx.org/examples/update-other-content">For cases like that, HTMX has elegant solutions</a>**. Yet another example that comes to mind is an application that needs to work offline. Since HTMX depends on the server-side rendering of HTML pages/components it would be quite hard to achieve a truly offline functionality (although it is possible to some extent with <a href="https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API" >Service Workers</a>).

Third (maybe), possibly scattered logic. For some cases, there is still a need to write client-side JavaScript to achieve certain behaviors, like modal confirmation or dynamic error handling/representation. I am not sure, if we shall call it a logic necessarily, but this is something to keep in mind. As far as validation goes, we can actually move it completely to the server side, where it always should be anyway, which can be viewed as a simplification. Most likely, as time goes on, more and more people will figure out useful patterns for working with HTMX, and some frameworks/libraries on top of HTMX will be created, so this will be less and less of a problem. For now, we need to design our apps properly to avoid those problems.

Finally, **cohesion versus independence/decoupling**. Although more complex, the SPA approach draws a clear line between backend and the frontend. It means that two people/teams can work almost independently, in parallel, which can significantly speed up the software development process. It is still possible to split work between people with the cohesive HTMX approach (no clear frontend/backend distinction), but it is not as obvious. Again, whether it is an advantage or disadvantage depends on the specific case. Additionally, if our server will also have non-HTML clients (mobile apps, other servers), HTMX does not bring its full advantages as we need to write and expose a separate API anyway.

## Consequences and closing thoughts

Let's summarize the most important consequences of taking HTMX versus traditional SPA approach for building web-based apps/systems:
1. Instead of two separate apps/projects (frontend and backend) we have everything defined in a single place/app
2. We radically decrease the amount of JavaScript that needs to be written. In most cases, we use it only to enhance behavior of our components/page fragments, nothing more
3. Our server returns HTML pages and fragments instead of JSON (or other, relevant data format that does not know anything about UI)
4. As we decrease the amount of JavaScript that we write, behavior of the UI is defined mostly in HTML, using HTMX attributes
5. We need to write more code on the server, because we need to define and render views there (HTML pages and fragments)
6. Overall, less code needs to be written. We have one code repo instead of two, and one application instead of two. Data and model are also defined in one place, instead of two. For that reason, there will be more code on the server (one app that we have right now), to compensate for the lack of frontend, but overall it still will be significantly less than in the SPA approach
7. It will be easier to write true end-to-end tests (involving UI in the browser), since we have our whole app (system) defined in one place, instead of two. Using tools like Playwright/Cypress we can spin up the whole application locally and test it E2E
8. Screens/pages where the changes are mostly driven not by http/websockets text-based data exchange, but something more binary, are harder/impossible to write using this approach. Here, we will be better off with vanilla JS or some SPA framework/library
9. It is easier for one person or a small team to work on the project and have full stack skills, because there are fewer abstractions and tools to keep in mind and know (no elaborate build setup, no SPA framework + HTMX is just plain simple)
10. It is easier to think about the system holistically, since we do not have frontend/backend dichotomy anymore (fewer layers of abstraction)
11. It is a new approach, which means that there are less ready to be used UI components  
12. If we have a larger team of people working on the project, the development could be slower, since it is harder to parallelize the work. While frontend/backend separation that comes with SPA approach creates more abstractions, it does allow more people to work in parallel since they often just need to agree on the API contract and can then work largely independently
13. If the server has multiple clients, we will need to write json (most likely) REST API for its other clients, be it mobile apps or other backends (machines). We could still use the HTMX approach, but if we have to expose an API for non-HTML clients anyway, it defeats the major purpose of HTMX and it is more natural to just write SPA

Overall, HTMX looks like a great technology and an interesting paradigm that we can use to write our web-based apps/systems faster while making them simpler, thus easier to change and maintain. **As said, there are few caveats, and cases where it is just not a good fit, but I highly, highly recommend trying it out. 
Let's simplify web development!**

<div class="article-delimiter">---</div>

### Related videos on my <a  href="{{ youtubeChannelUrl }}">youtube channel</a>
1. <a  href="https://www.youtube.com/watch?v=A3UB3tyDWa4">HTMX basics, simple index.html page from scratch</a>
2. <a  href="https://www.youtube.com/watch?v=9cu0NbyrNuU">General overview of HTMX, going through Some Wisdom App, which is using it</a>

<div class="article-delimiter">---</div>

### Notes and resources
1. HTMX: https://htmx.org
2. WebSockets support in HTMX: https://htmx.org/extensions/web-sockets
3. HTMX approach explained by its creator: https://htmx.org/essays/when-to-use-hypermedia
4. Updating many fragments of the page, based on a single response from the server: https://htmx.org/examples/update-other-content
5. Shoelace, library of web components: https://shoelace.style
6. Framework-agnostic web components: https://developer.mozilla.org/en-US/docs/Web/API/Web_components
7. Collections of resources, tools and libraries around Web Components: https://www.webcomponents.org
7. Interesting Carson Gross (creator of HTMX) talks:   
    1. https://www.youtube.com/watch?v=u2rjnLJ1M98
    2. https://www.youtube.com/watch?v=LRrrxQXWdhI
8. Some Wisdom App code mentioned in the article: https://github.com/BinaryIgor/code-examples/tree/master/some-wisdom-htmx-app