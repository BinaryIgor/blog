---
{
    "title": "HTMX - simpler web based system/app",
    "slug": "htmx-simpler-web-based-system-or-app",
    "publishedAt": "2023-09-22",
    "timeToRead": "10 minutes",
    "wordsCount": 1983,
    "excerpt": "",
    "writingLog": [ 1.5 ]
}
---

## Current approach - SPA

Nowadays, when you develop web based app/system you most-likey built it as SPA, which is single page application.
In that model, you have a *server*, often call an *API* , which (for the most part) doesn't know anything about your UI. 
Then we have a thick *client* which is JavaScript application responsible for all things that back in the days was the responsiblity of the browser. This app needs to (at the very least):
* handle routing (going through pages) without doing full-page reload
* make http requests to get data in the json (most popular, as of now, format for this particular data exchange) from the server and translate it into HTML, so the browser can render it
* translate some of the user actions (HTML page) into json, so that the server can make actions on their behalf 


As we can see, there are quite a few functions that were traditionally done by the browser and now we need to write a custom code do that. That's quite generic problem, so many frameworks and libraries have sprang out to simplify this work, but still the complexity is there. Especially the part that we didn't touch which is a server. 

## Server and the duplicated data model

As we have established, in the SPA approach we get some data (in json format) from the server, transform it into HTML so that the browser can render it. To do that, we need to model. As we have said, we also need to have a server, so it's need to be modelled there as well. It's always easier to work on concrete so let's consider the following system:
* There are authors with quotes (let's assume that they are in the system, we don't bother with managing them)
* you can search authors
* you can go to a single author page, where there is their short bio and list of quotes
* you can go the page with a single quote, where you can:
    * see other users' notes to this quote
    * add your own note to the quote


How would we approach designing an app like that, using SPA + API approach? First, we would need to define an API, a contract between client and the server. It can look something like that:
```
```


## Less layers, simpler system


## Why have we done that?

## Alternative approach - send HTML fragments over wire

## Closing thoughts


### Notes and resources