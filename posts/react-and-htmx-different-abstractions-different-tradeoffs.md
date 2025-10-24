---
{
    "title": "React and HTMX: different abstractions, different tradeoffs",
	  "slug": "react-and-htmx-different-abstractions-different-tradeoffs",
    "startedAt": "2025-01-19",
    "publishedAt": "2025-01-28",
    "excerpt": "React and HTMX represent two completely different approaches to building web applications. <em>React approach is JSON centric.</em> It is driven by JSON, a data format that is totally different from what is needed to render web pages or their fragments - HTML ... <em>HTMX approach is HTML centric.</em> It is driven by HTML - data is received in the exactly same way it is required for rendering, there is no need for any transformations.",
    "researchLog": [ 0.5, 0.75, 1 ],
	  "writingLog": [ 1, 1, 2.5, 4, 3.5, 2, 3, 1, 2 ],
    "tags": [ "htmx" ]
}
---

## JSON and HTML

React and HTMX represent two completely different approaches to building web applications. 

**React approach is JSON centric.** It is driven by JSON, a data format that is totally different from what is needed to render web pages or their fragments - HTML. JSON can be replaced here with XML, YAML or any other data exchange format; JSON is just the most popular as of now, the key point being: these formats are completely different from HTML. React is just an example, it also holds true for virtually any Single Page Application (SPA) framework; Vue, Angular, Svelte and so on. In this model, data flow is something like this:
1. Client (JavaScript) has HTML, as it is seen on the rendered by browser web page
2. Client takes data from HTML, transforms it to JSON and sends a request to the Server
3. Server responds with JSON
4. Client gets JSON response from the Server and transforms it into HTML, so it can be rendered

At the core of this approach lie HTML to JSON and JSON to HTML transformations, performed by JavaScript, on the client side.

**HTMX approach is HTML centric.** It is driven by HTML - data is received in the exactly same way it is required for rendering, there is no need for any transformations. HTMX is also used here as an example of the more general approach, where we take HTML pages/fragments from the server and render them on the client side directly, in the exact same form as received. Data flow in this model is something like this:
1. Client has HTML, as it is seen on the rendered by browser web page
2. Client sends forms and data from other HTML elements (supported by the HTMX or HTMX-like libraries) to the Server
3. Server responds with HTML pages and fragments
4. Client renders Server responses directly as they come, without any modifications

At the core of this approach lies working with HTML directly, letting the browser do the majority of work for us, using as little JavaScript as possible.

**As with most things, there is no free lunch - both approaches have their own strengths and weaknesses, offering different tradeoffs.** Let's explore them to see where they shine, where they fall short and when/if one is better than the other.

## From Multi to Single Page Applications

First, a little bit of context. How did JSON-centric Single Page Applications come to being?

Browsers speak HTML, transforming it into a usable interface for the human users. **For the majority of web history, we were developing Multi Page Applications - MPAs.** In this model, a website/application consists of multiple HTML pages, static or dynamic, returned by the server and rendered by the browser as received, without any modifications. Clicking links, submitting forms or any other page modifications that require exchanging data with the server trigger full page reload - making HTTP request to the server to get a completely new HTML page with (optional) CSS, JavaScript, fonts and other assets (they usually do not differ from page to page and can be cached  aggressively). More or less, this is how it works:
* we have a server app, developed in programming language of choice - Java, PHP, C#, Python, Ruby, Go and so on
* we go to the main page; the server returns a full HTML page that is rendered by the browser with additional (optional) CSS, JavaScript and other assets to enhance its look and maybe add some interactivity
* usually, there is some navigation; when any of the navigable items is clicked:
	* let's say we want to go to the `/contact` page
	* in the navigation, there would be some `<a>` HTML element with a link
	* we click on it and the browser makes an HTTP request to the server; in response, it gets a whole new HTML page with additional (optional) CSS, JavaScript and other assets, either embedded directly or as links
	* it renders the page exactly as received

**It is the simplest possible flow as most things are handled by the browser automatically - we just need to return valid HTML pages with related assets to the client.** HTML pages can be either static or dynamic. In the latter case, we usually get data from a database and use some kind of templating engine or raw string operations to prepare HTML pages based on it. CSS is usually added statically to every HTML page head. Where it is needed, JavaScript files or inline scripts are added as well, just to enhance mostly prepared on the server side and static HTML pages (things like modals, dropdowns, forms or inline validation).

This is still a completely valid way of developing websites and web applications. In fact, for most blogs and content-based websites (including this one) it is the best strategy to employ.

**But, as the never-ending strive for better user experience continued, we came up with another idea.** Why not operate on a single HTML page and update only parts that need to change, never fully reloading the page? That would improve user experience, because there is less data to be fetched from the server; but it also required developing new tools and new ways of building web applications.

**This is where, slowly and step by step, the JSON-centric Single Page Application approach was born.**
As we no longer wanted to get full HTML pages from the server and were getting more and more comfortable with JavaScript on the client side, we started to use other data exchange formats - mostly JSON.
These data formats have nothing to do with HTML that is rendered into a useful UI by the browser; that is also exactly why we needed to create new tools, patterns and strategies to perform complex, two-way JSON-HTML transformations.

As a result, modern SPA frameworks came into being. In this model, we have a system where the server - backend, talks mostly JSON with the client - frontend. Because of this, client applications (JavaScript) became much more complex as they must replicate many functionalities that are handled out of the box by the browser, in the Multi Page Application model (routing, state management, caching, error handling and so on). JavaScript was once used only to enhance some parts of the pages - in the SPAs, we use it to drive whole applications; replicating, replacing and enhancing traditional browser features, sometimes inventing new ones as well.

**In the MPA approach, there is no frontend/backend distinction.**  We just have a web app, sprinkled with additional JavaScript for enhanced client interactivity where plain HTML/CSS is not enough. The SPA approach changed this completely: there is a sharp frontend/backend, client/server separation.
It is a natural consequence of how JSON-centric Single Page Applications work:
* we have a server that hosts static files of our SPA - HTML, CSS, JavaScript, fonts, images and other assets
* we go to the main page; the server returns `index.html` with links to needed CSS, JavaScript and other assets
* this time `index.html` is different (as compared to MPA) - it does not contain anything renderable, it is just a skeleton for JavaScript to take control
* once JavaScript finishes loading, it modifies the HTML page so that it renders something useful
* usually, to render something useful we need to make an HTTP request to the backend
* backend returns JSON in response - JavaScript client code transforms this data to HTML, browser cannot do this on its own
* when we want to navigate to a different page:
	* let's say we go to the `/contact` page again
	* in the navigation, we would have an element that handles going there
	* we click on it and JavaScript uses the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to push a new state or replace current one - this is a routing part that is handled automatically by the browser in the MPA model
	* after this new state is pushed, JavaScript handles it and renders another page - without full page reload
	* to render this page, it modifies fragments or all of currently visible HTML - usually replacing content with another piece of data received from the server, in the JSON format

Frontend (client) applications are written in JavaScript (TypeScript increasingly) - the only language that browsers understand. Backend (server) applications can be written in any programming language of our choice as they might run on any machine controlled by us; they need only to expose RESTful JSON (mostly) API for frontend applications.

**To sum this history up, Single Page Applications usually offer better user experience at the cost of increased development and maintenance complexity.** Tools needed to support these efforts grew in number and complexity as well; also, expertise, knowledge and technology stacks of people developing frontend and backend applications diverged sharply. In this model, it becomes increasingly harder and rarer to find somebody who operates productively both on the frontend and backend side of development.

## Simple Single Page Applications, driven by HTML

Can we get a better user experience of Single Page Applications while retaining Multi Page Applications simplicity?

We can; all we need to do is to abandon JSON and get back to HTML, but with a slight twist.

It still must be a single page application, so no full page reloads. 
But instead of talking JSON with the server and performing complex JSON to HTML transformations, we simply might:
* prepare HTML on the server side, as we used to have in the Multi Page Application model
* instead of returning full HTML pages, return only changed fragments; render them on the client side directly as they come from the server

**[This is exactly what HTMX is doing.](/htmx-simpler-web-based-app-or-system.html)** 
It is a simple library that allows any HTML element to trigger any HTTP request. In response, it expects to get an HTML fragment that is then used to modify the current HTML page in the specified place and way, exactly as it is returned from the server:
```
Page before request:
<html>
  <head>
    ...
  </head>
  <body>
    ...
    <div id="items">
      <ul>
        <li>First item: 1</li>
        <li>Second item: 2</li>
      </ul>
    </div>
    <button
      hx-post="/reverse-items"
      hx-target="#items">
      Reverse items
    </button>
    <!-- HTMX library goes here -->
    <script src="https://unpkg.com/htmx.org@2.0.4"></script>
   </body>
<html>

On a click, HTMX makes POST to /reverse-items;
it gets HTML fragment in the response:
<ul>
  <li>Second item: 2</li>
  <li>First item: 1</li>
</ul>

As a result, page after request:
<body>
  ...
  <div id="items">
    <!-- This was changed -->
    <ul>
      <li>Second item: 1</li>
      <li>First item: 1</li>
    </ul>
    <!-- This was changed -->
  </div>
  <button 
    hx-post="/reverse-items"
    hx-target="#items">
    Reverse items
  </button>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</body>
```

\
**In this way, we write far less JavaScript (close to none) but still deliver the same, better user experience as in JSON-centric Single Page Applications.** Additionally, we go back to having just an app, there is no frontend/backend distinction; we just need to return ready for rendering HTML pages/fragments to client. To support this approach, all that is required is *HTMX or HTMX-like tool* that can trigger arbitrary HTTP requests from arbitrary HTML elements and replace fragments of the page with received HTML responses, without fully reloading the page.

## Components

**All major JSON-centric SPA frameworks (React, Vue, Angular or Svelte) have their own, framework-specific, libraries/collections of reusable components.** Web Components, which are framework independent, are growing in popularity but they still have not delivered on their promise of creating truly universal components for the web. There are projects like [Shoelace](https://shoelace.style/), a collection of reusable  Web Components, but they still provide and maintain [wrappers for each framework](https://shoelace.style/frameworks/react) to make them easier to use. The current reality of the JSON-centric SPA components landscape is that every framework develops and maintains its own libraries/collections of components. In every SPA framework, components are defined in JavaScript and there is a framework-specific API to parameterize and configure them.

What about the HTML-centric SPA approach? 

This approach is new and thus requires different abstractions and ways of thinking. First, we mostly do not use JavaScript to render HTML on the client side; we receive ready to render HTML pages/partials from the server. So what we really need is a set of reusable HTML templates sprinkled with JavaScript, if and where needed. There are at least two problems to solve here:
1. How to pass variables to components? For example, a list of items in the dropdown
2. If JavaScript is required for a component to be functional, how/where to add it?

**In JSON-centric SPAs, these problems are solved by having everything defined in JavaScript and rendered on the client side; right now, we must think mostly in HTML.** Getting back to our two problems, there are a few possible solutions, depending on how generic our components ought to be.

To pass attributes, properties and data to HTML templates we can:
* perform string operations on our server, in the code - components will be coupled to the server programming language
* use templating language: Go Templates, Thymeleaf, FreeMarker, Haml, Twig, Jinja, Mustache and so on; most of them are limited to a specific programming language, but some - Mustache for example - have implementations in multiple languages
* create Web Components and do string operations in JavaScript, inside them; that is not HTML templating per se, but can definitely work and is universal

To sprinkle our HTML-based components with JavaScript, we might:
* use JavaScript IIFE - [Immediately Invoked Function Expression](https://developer.mozilla.org/en-US/docs/Glossary/IIFE)
* use Web Components and have all necessary JavaScript defined there

All these approaches represent different tradeoffs and are less or more generic. Using them, it is completely feasible to build:
1. Collection of HTML components for a particular server-side programming language: Java, Go, Python, JavaScript, PHP and so on
2. Collection of Web Components - they are rendered on the client side using JavaScript, but might be configured and populated with data on the server
3. Collection of HTML components using a more universal templating language like Mustache; then, our components can be used in any application that is written in a programming language that has a [library with Mustache implementation](https://mustache.github.io/)

\
**To be less abstract and more concrete, let's delve into an example of a component built in two different ways.** We are going to create a `<collapsible-item>`, with a list of shown/collapsed items. Generic and backend-configurable Web Component implementation might look like this:
```
class CollapsibleItem extends HTMLElement {
  connectedCallback() {
    const header = this.getAttribute("header");
    const items = this.getAttribute("items").split(",");
    
    this.innerHTML = `
      <div>${header}</div>
      <div style="display: none">
      ${items.map(i => `<div>${i}</div>`).join("\n")}
    </div>`;
    
    const [itemsHeader, itemsContainer] = this.querySelectorAll("div");
    itemsHeader.onclick = () => {
      const itemsDisplay = itemsContainer.style.display;
      if (itemsDisplay == 'block') {
        itemsContainer.style.display = 'none';
      } else {
        itemsContainer.style.display = 'block';
      }
    };
  }
}

customElements.define("collapsible-item", CollapsibleItem);
```

Server would then configure and return it as HTML partial:
```
<collapsible-item 
  header="Items"
  items="A,B"
</collapsible-item>
```
For the second, also generic implementation, we use the Mustache templating engine and JavaScript IIFE pattern:
```
<div id="{{id}}">
  <div>{{header}}</div>
  <div style="display: none">
    {{#items}}
    <div>{{.}}</div>
    {{/items}}
  </div>
</div>

<script>
  (function() {
    const collapsible = document.getElementById("{{id}}");
    const [itemsHeader, itemsContainer] = collapsible.querySelectorAll("div");
    itemsHeader.onclick = () => {
      const itemsDisplay = itemsContainer.style.display;
      if (itemsDisplay == 'block') {
        itemsContainer.style.display = 'none';
      } else {
        itemsContainer.style.display = 'block';
      }
    };
  })();
</script>
```

As said, Mustache has implementations in multiple programming languages, which makes it universal enough. Here is how we might use it with Java and Spring Framework:
```
...

@GetMapping("/html-component")
String htmlComponent() throws Exception {
  // file with shown above template
  var compiled = factory.compile("collapsible.mustache");
  var writer = new StringWriter();
  compiled.execute(
    writer,
    Map.of(
      "id", "collapsible-example",
      "header", "Items",
      "items", List.of("A", "B")))
    .flush();

  return writer.toString();
}

...
```
which results in:
```
<div id="collapsible-example">
  <div>Items</div>
  <div style="display: none">
    <div>A</div>
    <div>B</div>
  </div>
</div>

<script>
  (function() {
    const collapsible = document.getElementById("collapsible-example");
    const [itemsHeader, itemsContainer] = collapsible.querySelectorAll("div");
    itemsHeader.onclick = () => {
      const itemsDisplay = itemsContainer.style.display;
      if (itemsDisplay == 'block') {
        itemsContainer.style.display = 'none';
      } else {
        itemsContainer.style.display = 'block';
      }
    };
  })();
</script>
```
\
So, we have at least two ways of implementing universal and language-independent, server-side HTML components.


## Conclusion: it is all about Tradeoffs

As we have seen, **JSON-centric Single Page Applications introduce a ton of complexity, but they do have some serious advantages**. First and foremost, they can provide a better user experience. Additionally, they decouple backend from frontend, which might be both an advantage and disadvantage. On the one hand, backends are now simpler, since they do not know anything about HTML, CSS and other visual things; work is also easier to split and to perform more independently, in parallel. On the other hand, in total, there is more work to be done; decoupling comes at the cost of more abstraction layers, tools to learn and use, code to write, maintain and support. To their advantage though, historically and as of now, JSON-centric SPA frameworks benefit from rich collections and libraries of reusable components.

With the [rise of HTMX and similar tools](https://htmx.org/essays/alternatives/) however, we now have a simpler alternative. **We can build HTML-centric Single Page Applications that deliver user experience no worse than JSON-centric apps, but without the complexity.** Here, frontend is again coupled with backend - same as in the preceding SPAs, Multi Page Application model. To be more precise, as previously, there really is no frontend/backend distinction, there is just a web app. Again, that might be both an advantage and disadvantage. Overall, there is less work to be done, compared to JSON-centric SPAs, but work is coupled, harder to split and do in parallel by multiple people. But, there is less code to write, maintain and support, fewer tools and abstractions to learn and use. Moreover, tools - HTMX mostly - that support this paradigm are far easier to learn and master than SPA frameworks like React, Vue, Angular or Svelte.

**As with everything in life and Software Engineering, it is all about Tradeoffs.** But, if we are willing to be a little more experimental, write or find some components on our own, come up with new code patterns and architectures, have a full stack expertise or team, I highly recommend trying the HTML-centric approach out, with the help of HTMX. 
I think that we might be deeply surprised:
> How simple our systems can be to develop and maintain, without any compromises on the user experience!

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. Regarding Multi vs Single Page Applications user experience, it is not so clear that SPAs are always better. Browsers optimize HTML rendering all the time and many things can be done to improve MPA response times (caching, partial updates here and there), so that it can rival the smoothness of SPAs. Here are some interesting takes:
    1. https://unplannedobsolescence.com/blog/hard-page-load/
    2. https://unplannedobsolescence.com/blog/less-htmx-is-more/
2. HTMX is just an implementation (great one!) of a more general pattern, focused on HTML. Here are some alternatives: https://htmx.org/essays/alternatives/
3. Maybe JSON is not the best data exchange format to build REST APIs: https://htmx.org/essays/hateoas/
4. My posts about HTMX: 
    1. [/htmx-simpler-web-based-app-or-system.html](/htmx-simpler-web-based-app-or-system.html)
    2. [/htmx-and-web-components-a-perfect-match.html](/htmx-and-web-components-a-perfect-match.html)
    3. [/htmx-a-setup-ready-for-production.html](/htmx-a-setup-ready-for-production.html)
5. Components in HTMX: https://htmx.org/essays/webcomponents-work-great/
6. Mustache templating language: https://mustache.github.io. It has implementations in virtually all popular programming languages! Because of that, we can use it to create truly generic server-side HTML components.
7. My pet project, Flexible Components - fully configurable (on the server) Web Components: https://github.com/BinaryIgor/Flexible-Components
8. What is a Single Page Application, anyway? https://developer.mozilla.org/en-US/docs/Glossary/SPA

</div>