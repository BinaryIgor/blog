---
{
    "title": "HTMX and Web Components: A Match Made in Heaven",
    "slug": "htmx-and-web-components-a-match-made-in-heaven",
    "publishedAt": "2023-12-22",
    "startedAt": "2023-12-16",
    "timeToRead": "29 minutes",
    "wordsCount": 2687,
    "excerpt": "Nowadays, when we develop web-based app/system it is most likely built as SPA, which is a single page application. We should ask, why have we done that? Why have we switched from multi page applications, where the browser supported all of these functions out of the box, functions that we now need to recreate by writing custom JavaScript code?",
    "researchLog": [ 2 ],
    "writingLog": [ 4 ]
}
---

## Web Components in the context

Web Components are a set of browser APIs that allow us to create custom HTML elements. They are the missing thing that SPA (Single Page Application) frameworks have been giving us for a long time. Unfortunately, with this frameworks, all of them are specific to a given framework. It has the following consequences:
* components can be reused only in the context of a specific framework
* framework updates often cause our components to not be usable anymore
* when we decide to change framework - we need to ditch our/library components
* we need to learn the specifics of each framework in order to use/create components

Fortunately, for quite a long time right now (few years at least) we have Web Components, native to browser way of creating reusable, custom HTML tags and use them in our app.

It is extremely easy to create them. To illustrate, let's say that we would like to have something like this:
```
...
<div>
  <custom-message 
    category="Curiosities" 
    message="Some interesting message">
  </custom-message>
</div>
...
```

To have a custom element like this, all we need is a few lines of JavaScript:
```
class CustomMessage extends HTMLElement {
  constructor() {
    super();
    const category = this.getAttribute("category");
    const message = this.getAttribute("message");
    this.innerHTML = `
      <div>You've got an interesting message, from ${category} category:</div>
      <div>${message}</div>`;
    }
}

customElements.define('custom-message', CustomMessage);
```
That alone is tremendously powerful! If we add to that the ability to observe attribute value changes and lifecycle callbacks:
```
...
static observedAttributes = ["category", "message"];

attributeChangedCallback(name, oldValue, newValue) {
  console.log(`${name} attribute was changed from ${oldValue} to ${newValue}!`);
}

connectedCallback() {
  console.log("Element was added to the DOM!");
}

disconnectedCallback() {
  console.log("Element was removed from the DOM!");    
}
...
```
...there is virtually no limit of what we can to with Web Components! There is also a possibility of creating shadow (hidden) DOM and scoped CSS, but they are quite complex, have their drawbacks and are not needed in many cases, so we will stick with basics here, which are:
* creating custom elements in JavaScript, using them in HTML
* using plain-old DOM
* using lifecycle callbacks and attribute change observers

How and why can we utilise Web Components in the context of HTMX?

## HTMX

What is HTMX? I wrote a more extensive article about HTMX which you can find <a href="/htmx-simpler-web-based-app-or-system.html">here</a>.
In a nutshell: HTMX is a JavaScript library that allow us to may ajax request from any HTML element, not only forms or videos, expects HTML in response, and renders HTML pages/fragments directly in section we want; we do not need to exchange JSON/other data format with the server and translate it to HTML on the client side.

It is highly interesting and useful technology, it simplifies many things and allows us to build SPA-like applications without any frameworks, complicated tooling and mostly without writing any application-specific JavaScript! There is one thing that I found missing though. It is a way to create closed, isolated, (sometimes) reusable components, where I can enclose templates and sometimes JavaScript related to a given component. Would not it be also amazing, if we can create a library of reausable, framework-agnostic components, that can be then used in the HTMX-based applications? All of that is perfectly doable with Web Components, so let's dive in!

## Assumptions and approach

In our approach we will make the following assumptions/have preferences:
* We will not use shadow DOM. HTMX does not support it (it does not work with it), additionally I would argue that it complicates thing and is not needed to create useful, isolated, reusable components
* We will make our components fully configurable from the outside. They will make working with HTMX simple, but they do not know anything about HTMX
* For styling we will use amazing <a href="https://tailwindcss.com" target="_blank">Tailwindcss</a>. We could have done it without by scoping our CSS, but it easier with Tailwind, and is amazing tool on its own, so why not use it? 
* easy to work with HTMX

## Code and Context

Repo with all referenced code and more examples can be found <a href="https://github.com/BinaryIgor/code-examples/tree/web-components/flexible-web-components" target="_blank">here</a>.

To make configuring our components simple I have created *Components* object. Its main function is to make configuring our components easier. To make it more generic I have also devised the following convention to configure our components:
```
{component-element}:{attribute}="{value}"
```

InfoModal example (classes come from Tailwind):
```
<info-modal id="info-modal" 
  container:class="bg-black/80"
  content:class="bg-amber-300 border-solid border-4 border-black rounded-md m-auto mt-32 px-8 pt-8 pb-32 w-3/5"
  message:class="text-lg italic"
  close-icon="&#10006;"
  close:class="text-2xl p-4 cursor-pointer">
</info-modal>
```

Basically, *container:(.*)* attributes will be copied without *container:* prefix to container element of the *info-modal* component, *content:(.*)* attributes will be copied without *content:* prefix to content element and so on, for all supported *info-modal* component elements. Resulting HTML is as follows:
```
<info-modal id="info-modal" 
  container:class="bg-black/80" 
  content:class="bg-amber-300 border-solid border-4 border-black rounded-md m-auto mt-32 px-8 pt-8 pb-32 w-3/5" message:class="text-lg italic" 
  close-icon="&#10006;"
  close:class="text-2xl p-4 cursor-pointer">
  <div style="display: none;" class="fixed z-10 left-0 top-0 w-full h-full overflow-auto bg-black/80">
    <div style="position: relative;" 
        class="bg-amber-300 border-solid border-4 border-black rounded-md m-auto mt-32 px-8 pt-8 pb-32 w-3/5">
      <span class="absolute top-0 right-0 text-2xl p-4 cursor-pointer">"&#10006;"</span>
      <div class="text-2xl font-bold mb-2">Default title</div>
      <div class="text-lg italic">Default message</div>
    </div>
  </div>
</info-modal>
```

It is all possible by using the main method of *Components* object, which is the following:
```
export const Components = {
  mappedAttributes(element, elementId,
    { defaultAttributes = {},
      defaultClass = "",
      toAddAttributes = {},
      toAddClass = "",
      toSkipAttributes = [],
      keepId = false } = {}) {

    let baseAttributes = baseAtrributesFromDefaults(defaultAttributes, defaultClass);

    let mappedAttributes = mappedAttributesWithDefaults(element, elementId, baseAttributes, toSkipAttributes, keepId);

    mappedAttributes = mappedAttributesWithToAddValues(mappedAttributes, toAddAttributes, toAddClass);

    return Object.entries(mappedAttributes).map(e => `${e[0]}="${e[1]}"`).join("\n");
},
...
```
We then use it our custom components in the following way:
```
...
const containerAttributes = Components.mappedAttributes(this, "container", {
  toAddClass: containerClass,
  defaultClass: containerClassDefault
});
const contentAttributes = Components.mappedAttributes(this, "content", {
  defaultClass: contentClassDefault
});

...

this.innerHTML = `
<div style="display: none;" ${containerAttributes}>
  <div style="position: relative;" ${contentAttributes}>
    <span ${closeAttributes}>${closeIcon}</span>
    <div ${titleAttributes}>${titleToRender}</div>
    <div ${messageAttributes}>${messageToRender}</div>
  </div>
</div>`;

...
```

As we can see, this is quite generic and it has nothing to do with HTMX: we just allow to inject arbitrary, external attributes to exposed by a given component elements.

\
Using HTMX is mostly about setting its attributes on our components, in the HTML. Our generic approach has thus interesting consequences. We can then take components created in that way (without any knowledge about HTMX) and use them in the following manner (InputWithError):
```
 <input-with-error 
   input:type="text"
   input:name="message"
   input:placeholder="Input something..."
   ...HTMX starts here:
   input:hx-post="${PATH}/validate"
   input:hx-trigger="input changed delay:500ms"
   input:hx-swap="outerHTML"
   input:hx-target="next input-error">
</input-with-error>
```


## Confirmable HTMX request Modal

In HTMX we might quite often have a need for certain requests to be confirmed by the user. There is a special attribute that we can use here, which is <a href="https://htmx.org/attributes/hx-confirm/" target="_blank">hx-confirm</a>. Having *confirmable-modal* similar to *info-modal* from one of the previous examples, we can have the following HTML:
```
<confirmable-modal title="Delete confirmation" ok-text="Delete">
</confirmable-modal>

<button 
  hx-delete="/test"
  hx-confirm="Are you sure to delete this test entity?"
  hx-target="#delete-result">
  Try to confirm
</button>
```

To capture requests and show our custom modal, we need to add the following JavaScript to our page:
```
const confirmableModal = document.querySelector("confirmable-modal");

document.addEventListener("htmx:confirm", e => {
  console.log("Let's confirm htmx request..", e);
    
  // do not issue htmx request
  e.preventDefault();

  confirmableModal.onOk = () => {
    e.detail.issueRequest(e);
    confirmableModal.hide();
  };

  confirmableModal.show({ message: e.detail.question });
});
```

Which will show our modal before issueing an http request which looks like:
<figure>
    <img src="{{ imagesPath }}/htmx-and-web-components/confirmable-modal.png">
</figure>




## Highly elaborate HTMX example

Bulding on previously, shortly shown *input-with-error* example, we can have *form-cotainer* that provides form functionality. As name suggests, it is just a container, so it accepts and can work with any number of inputs. It provides a common form functionality like clearing all inputs after submit or showing generic after failed submit. To make the example more relevant to HTMX context, we will also have *list-container*. We will add items from our *form-container* to it. *List-container*, similarly to *form-container* will be just a container for items. It will host arbtrary number of elements and 


## Copyable components collection and closing thoughts

Pretty useful, maybe create simple tools out of it


### TODO:
* tell sth about overcomplicated libraries/frameworks like Shoelace?
* some screenshots at the end!

<div class="article-delimiter">---</div>

### Related videos on my <a target="_blank" href="{{ youtubeChannelUrl }}">youtube channel</a>
1. <a target="_blank" href="https://www.youtube.com/watch?v=M4i-JQVLgfE&t=2431s">Similar concept, presented on video</a>

<div class="article-delimiter">---</div>

### Notes and resources
* HTMX: https://htmx.org
* https://lamplightdev.com/blog/2019/03/26/why-is-my-web-component-inheriting-styles/
* https://developer.mozilla.org/en-US/docs/Web/CSS/::part
* https://ionicframework.com/docs/api/button
* https://shoelace.style/
* https://eisenbergeffect.medium.com/debunking-web-component-myths-and-misconceptions-ea9bb13daf61
* https://www.hjorthhansen.dev/you-might-not-need-shadow-dom/
* https://javascript.info/shadow-dom-style
* https://github.com/web-padawan/awesome-web-components
* https://backlight.dev/mastery/best-web-components-libraries-for-design-systems
* https://www.webcomponents.org/libraries
* https://www.youtube.com/watch?v=MN2jIUonuQQ
* https://meyerweb.com/eric/thoughts/2023/11/01/blinded-by-the-light-dom
* https://buttondown.email/cascade/archive/006-shadow-dom-is-not-a-good-default/
* https://aaadaaam.com/notes/step-into-the-light-dom/
* https://blog.jeremylikness.com/blog/build-a-spa-site-with-vanillajs/