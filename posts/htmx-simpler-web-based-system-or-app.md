---
{
    "title": "HTMX - simpler web-based system/app",
    "slug": "htmx-simpler-web-based-system-or-app",
    "publishedAt": "2023-09-22",
    "timeToRead": "12 minutes",
    "wordsCount": 1983,
    "excerpt": "Nowadays, when we develop web-based app/system it is most likely built as SPA, which is a single page application. We might ask, why have we done that? Why have we switched from multi page applications where the browser supports all of these functions out of the box, that now we need to recreate by writing custom JavaScript code?",
    "writingLog": [ 1.5, 4.5, 1.5 ]
}
---

## Current approach - SPA

Nowadays, when we develop web-based app/system it is most likely built as SPA, which is a single page application.
In that model, we have a *server*, often called an *API* , which (for the most part) doesn't know anything about UI (User Interface). 
Then we also have a thick *client* which is a JavaScript application responsible for all things that was (and still can be) the responsibility of a browser. This app needs to:
* handle routing (going through pages) without doing full page reload
* make http requests to get data in the json format (most popular, as of now, format for this particular data exchange) from the server and translate it into HTML, so the browser can render it and show to the user
* translate some of the user actions (taken in HTML page) into json, so that they can be sent to the server and trigger some kind of action/state change

As we can see, there are quite a few functions that were traditionally done by the browser and now we need to write a custom code do that (if we want to use SPA approach). That is a generic problem, so many frameworks and libraries have sprang out to simplify it, but still the complexity is there.

**We might ask, why have we done that? Why have we switched from multi page applications where the browser supports all of these functions out of the box, that now we need to recreate by writing custom JavaScript code?** Mostly, arguably only, because of the user experience. We can create more app-like experience when approaching the web in this way. When we do not need to do full page reload, whole experience in the browser feels much more like an app, not a website. It can be faster also. After the initial load, we do exchange less data, going through pages, but whether that is true depends on the particular implementation. For the most part, *if done correctly*, experience of the SPA with comparison to the traditional, multi page website/application is better (if you do need that kind of experience. For blogs, like this one, I am completely fine with full page reloads. It is a blog after all, not an app).

## Duplicated model and growing complexity

As we have established, in the SPA approach, we get some data (mostly in json format) from the server, transform it into HTML so that the browser can render it. To do that, we have to model described data. As we have said, we also need to have a server, so it needs to be modelled there as well. It is always easier to work on a concrete example, so let's consider the following system:
* there are authors with quotes (assuming that they are in the system, we do not bother with managing them)
* you can search authors by name, getting back matching results with one random quote
* you can go to a single author page, where there is their short bio and list of quotes
* you can go the page with a single quote, where you can:
    * see other users notes to this quote
    * add your own note to the quote

How would we approach designing an app like that, using SPA + API approach? First, we need to define an API, a contract between client and the server. It can look something like that:
```
GET: /authors?search=<phrase>
Response: [
    {
        "author": string,
        "quote": string
    }
]

GET: /authors/<author>
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
...
```
Having that contract established we would then need:
* model it and write backend app
* model it and write fronted app

That's a lot of complexity. Most often, it's either two people/teams doing that, or if you do (respect for all fullstacks!) it on your own, there is a lot of mental gymnastics and context switching involved (different programming models, languages, environments etc.). Fundamentally, there is just a lot of code to write! We need to model, implement and test our domain two times! Obviously, there are some contextual differences, but many things do duplicate. Models, validation (partially), error handling, tests.... what if we can write it all once, in a single place, but maintain all (or almost all) flexibilty and control over user experience that we have with SPA? That is where HTMX is trying to close the gap.

## HTMX - less layers, simpler system

Is it possible to simplify it and have just one (sort of) layer? HTMX takes approach, where it is indeed possible (or something almost like that). Instead of going through the hustle of sending and receiving json (some data representation) and then translating it back and forth into HTML, we can just receive ready to be rendered **html pages and fragments**.

How does it work? HTML is just a JavaScript library. You add it as a dependency and then it allows you to do trigger virtually any ajax (http) request from any html element. In non-extended, standard html, this can be done to a very limited degree, mostly on form element (also by getting media directly in the video and audio elements). With HTMX you can update fragments of your HTML page just like this:
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
What happens here?
* on button click (you can override it to be any event!) HTMX will issue POST request to the */reverse-items* url
* it will then take response from the server and swapped *#items div* content directly with what it got from the server!

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
    </div>
    <button hx-post="/reverse-items" hx-target="#items">Reverse items</button>
    <!--HTMX library goes here-->
    <script src="https://unpkg.com/htmx.org@1.9.5"></script>
</body>


On a click, HTMX does POST: /reverse-items and gets HTML fragment in response:
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
    </div>
    <button hx-post="/reverse-items" hx-target="#items">Reverse items</button>
    <!--HTMX library goes here-->
    <script src="https://unpkg.com/htmx.org@1.9.5"></script>
</body>
```


That basically mean that by adding these two tags, we can update any fragment of our page, with the data returned from the server, without writing any JavaScript code! Isn't that amazing? Isn't that what most SPA frameworks are trying to solve? Updating page partially, without reloading it?

What about routing, simply going to a different page, but as with SPA, without doing full page reload? Well, that's also simple. Using HTML fragment from **<a href="https://github.com/BinaryIgor/code-examples/tree/master/some-wisdom-htmx-app">my simple Some Wisdom App</a>**, we have a list of authors:
```
<div hx-history="false" id="app">
...
<div class="w-full p-4">
<div class="relative">
<input id="search-authors-input" class="p-2 rounded-md bg-indigo-900 shadow-md mb-2 border-2 border-indigo-800 
    hover:bg-indigo-800 focus:outline-none placeholder-zinc-500 w-full" 
    name="authors-search" 
    placeholder="Search for interesting authors by their name..." 
    hx-trigger="keyup changed delay:500ms" 
    hx-post="/search-authors" 
    hx-target="#search-results" 
    hx-indicator="#search-results-indicator">
...
<div class="mt-2" id="search-results"><div class="space-y-4">
<div class="rounded-lg shadow-md p-4 cursor-pointer border-2 
        border-indigo-800 shadow-indigo-800" 
        hx-target="#app" 
        hx-get="/authors/Jordan Peterson" 
        hx-push-url="true">
        <div class="text-xl">Jordan Peterson</div>
        <div class="text-zinc-300 italic mt-2">"When you have something to say, silence is a lie."</div>
    </div>
<div class="rounded-lg shadow-md p-4 cursor-pointer border-2 
        border-indigo-800 shadow-indigo-800" 
        hx-target="#app"
        hx-get="/authors/Saifedean Ammous"
        hx-push-url="true">
        <div class="text-xl">Saifedean Ammous</div>
        <div class="text-zinc-300 italic mt-2">"Civilization is not about more capital accumulation per se; rather, it is about what capital accumulation allows humans to achieve, the flourishing and freedom to seek higher meaning in life when their base needs are met and most pressing dangers averted."</div>
</div>
</div>
...
```
Here, among tailwind for css, you can see lots of HTMX tags. Let's focus on the div:
```
<div class="rounded-lg shadow-md p-4 cursor-pointer border-2 border-indigo-800 shadow-indigo-800" 
        hx-target="#app" 
        hx-get="/authors/Jordan Peterson" 
        hx-push-url="true">
```
Here, HTMX will swap content of *#app* (almost the entire page, convention taken from SPA's) with the results of */authors/Jordan Peterson* request. *Hx-push-url="true"* means that *hx-get* url will be pushed to the browser history, which means the following flow:
1. localhost: user click on our div with hx-get="/authors/Jordan Peterson" and hx-push-url="true"
2. User lands on *localhost/authors/Jordan Peterson* without page reload, just by updating relevant part of the DOM (Document Object Model) with the response from server
3. User clicks back button and is on the localhost again, again without doing page reload, just by the virtue of swapping HTML fragments from the server with the relevant DOM fragment.


So again, routing can be done quite simply without using dedicated library. To handle errors on forms and from http requests we can use quite elegant **HTMX events API**. Let's see how we can handle form validation completely on server side (in one place), but with as good user experience as we would expect from SPA. Here's the full code:
```
<body>
    <h1>HTMX - single index.html page</h1>
    <h2>Items</h2>
    <div id="items">
    </div>
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

Here, we listen to the provided by HTMX, *htmx:afterRequest* event. As name suggests, it's triggered after every http request, issued by HTMX. We then check whether it failed (non-200 response code) and render error, returned from the server, in our *errors-container*. Again, error could be a text/HTML fragment, whatever we want to have directly rendered here.

Let's get back to our server. As said, in SPA approach it would return json data. Here, we sometimes need full HTML pages, sometimes HTML fragments. So, let's say that we have our app on the *awesome-app.com* domain. When user navigates to *awesome-app.com* server responds with the full HTML page, with relevant JS, CSS and whatever other static files are needed. This page and files will be defined in one repository, close to the server code. When we navigate to *awesome-app.com/feature-1* let's say, another HTML fragment needs to be returned. In SPA approach, our frontend app would handle this routing and then probably on */feature-1* screen issue a request to the server to get some relevant data. With HTMX, our *awesome-app.com* screen (defined in the backend code/templates) have a button/div/something somewhere on the page of the kind:
```
<button hx-post="/feature-1" hx-push="true">Feature 1</button>
```
And as we know, upon clicking it, the server will return HTML fragment ready to be rendered dirrectly. 
Instead of sending and receving json, our server no returns HTML pages and fragments. That does mean a little more code there, we don't have a separate frontend app anymore! We just have a single app, with the server and UI parts. Server can written in any language/framework (JavaScript also!). Most of our frontend will be defined in HTML pages + HTMX magic + CSS + some custom JS for error handling and whatever we wish. The amount of JavaScript that we need to write is minimal and it serves only to enhance our apps behavior, not to constitute its most important part.

Quite interestingly, because we have a single app with one deployment, **we can write end-to-end tests using something like Playwright or Cypress** to run our app locally, in the same manner as it will be running in the production and have it trully tested e2e. With SPA approach, if it's done (e2e testing), it's usually done with the mocked backend which obviously is not trully end-to-end testing.

## Is it really that simple?

Is it really all great and wonderful? Are there no trade-offs? As with everything, there are. Whether they are worth taking, it depends completely on your specific case. But as we have shown, I believe that majority of UI's can be build using HTMX and the resulting system will be simpler than traditional SPA approach. How much? It depends on the particularities of the project. What are the disadvantages/problems worth considering before jumping into HTMX?

First, it's quite a novel approach, so it can harder to find rich libraries of components, for example (as of the date of writing this article). That will most likely change and you still get very far with just CSS (Tailwind/other css lirary) and your own custom JavaScript, but depending on your project needs, you might need to write more code for your UI components, because there are less ready-to-use components like there are for Vue, React and Svelte alternatives (most component libraries are framework-specific). That will be less and less true as HTMX gains popularity, but it is still the case now (as of the date of writing this article). **Already, there are interesting ideas and initiatives like <a href="https://shoelace.style" target="_blank">shoelace</a>, which is building components based on <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_components">Web Components</a>, which are completely framework-agnostic and supported natively by browsers**.

Secondly, there are some application that would not be suitable to write in HTMX. Things where UI changes are mainly done without interaction with the server or they need to be real time fast. WebRTC (Web Real-Time Communication) comes to mind here. You most likely will not build a virtual conference room in HTMX, because your UI changes will be dictated by non-HTTP (suite of WebRTC protocols) data exchanges (but you obviously can build the rest of your app in HTMX, and probably can build this one screen in vanilla JS). Additionally, if you have many (many, not one) cases where input in one fragment on the page often causes data in multiple places to change. <a href="https://htmx.org/examples/update-other-content/">But realistically, you need to have something similar to an excel spreadsheet, rather than just something like adding item to a basket + updating its counter in the different part of the page. For that cases, HTMX has elegant solutions</a>. Another case that comes to mind is an application that needs to work offline. Since HTMX depends on server-side rendering of HTML pages/component it would be quite hard to achieve a trully offline functionality (altough it's possible to some extent with Service Workers).

Third (maybe), scattered logic. For some cases, there is still a need to write client-side JavaScript to achieve certain behaviors, like modal confirmation or dynamic error-handling for example. I don't know, if I would call a logic necessarily, but this is something to keep in mind. As far as validation goes, you can actually move it completely to the server, where it always should be anyways, which can be viewed as simplification. Probably as times go on, more and more people will figure out useful patterns here, and some frameworks above HTMX will be created so this will be less and less of a problem. For now, you need to design your app properly to avoid these problems.

## Consequences and closing thoughts

Let's summarize the consequences of using HTMX and have one server app, instead of two (backend and fronted):
1. Instead of two separate apps/projects (frontend and backend) we have everything defined in the one place.
2. We radically decrease amount of JavaScript that needs to be written. In most cases, we use it only to enhance the behavior of our components, nothing else.
3. Our server returns HTML pages and fragments instead of json (or other, relevant data format that doesn't know anything about UI).
4. As we decrease the amount of JavaScript that we write, behavior of or UI is defined mostly in HTML, using HTMX tags and headers.
5. We need to write more code on the server, because we need to define views there (HTML pages and fragments).
6. Overall, less code needs to be written. We need to have one repo instead of two, one application instead of two, data and model defined in one place, instead of two. For that reason, as stated above, there will be more code on the server (one app that we have right now), to compensate for the lack of frontend, but overall it still will be significantly less than in the SPA model (separate backend + frontend).
7. It will be easier to write true end-to-end tests, since we have our whole app (system) defined in one place, instead of two. Using tools like Playwright/Sentry we can spin up whole application locally and test it e2e
8. Screens/pages where the changes are mostly driven not by http/websockets, mostly text-based data exchange, but something more binary, ale harder/impossible to write using this approach. Here, we will be better off with Vanilla.js/some SPA framework/library.
9. It is easier for one person or a small team to work on the project and have full-stack skills, because there are less abstractions and tools to keep in mind (no elaborate build setup, no SPA framework + HTMX is just plain simple).
10. It is easier to thing about system holistically, since we do not have frontend/backend dichotomy anymore (again, less layers of abstraction).  
11. If you have larger team of people working on the project, it could be slower, since it is harder to parallelize. While frontend/backend separation that comes with SPA approach creates more abstractions it does allow more people to work in parallel since they often just need to agree on the API contact and can then work largely independently.  

..there are probably more, but these are the most important ones that come to my mind.

Overall, as you can tell, HTMX looks like a great technology and a new paradigm that we can use to write our web-based system faster and making them simpler. As said, there are few caveats, and cases where it is just not a good fit for a project, but I highly, highly recommend you try it. 
Let's simplify web development!



### Notes and resources
1. HTMX: https://htmx.org
2. WebSockets support in HTMX: https://htmx.org/extensions/web-sockets/
3. https://htmx.org/essays/when-to-use-hypermedia/
4. https://www.youtube.com/watch?v=u2rjnLJ1M98
5. https://htmx.org/examples/update-other-content/
6. https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
7. https://shoelace.style/
8. https://developer.mozilla.org/en-US/docs/Web/API/Web_components
9. Interesting Carson Gross (creator of HTMX) talks:   
    1. https://www.youtube.com/watch?v=u2rjnLJ1M98
    2. https://www.youtube.com/watch?v=LRrrxQXWdhl
10. Some wisdom app code mentioned in the article: https://github.com/BinaryIgor/code-examples/tree/master/some-wisdom-htmx-app