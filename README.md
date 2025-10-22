# Blog

A blog with self-made static site generator, analytics and other tools. Simple yet powerful!

Requirements:
 * node 20+
 * Docker

Init:
```
npm install
```

Run all tests:
```
npm run test
```

Run single test file:
```
file=server npm run test:file
```

Run single test:
```
name="should reject too many visitor ids per ip hash in a day" npm run test:single
```

Build and run blog locally (in nginx):
```
npm run build:run:blog
```

For the rest, checkout package.json scripts and ops, and scripts folders!

For now, the blog is deployed on the Digital Ocean's amazing App Platform and the server (for analytics) is on the separate droplet (also Digital Ocean's).


### Newsletter
* integrate some webhooks: https://docs.buttondown.com/api-webhooks-introduction
* batch job to save analytics: https://docs.buttondown.com/api-emails-analytics
* https://docs.buttondown.com/welcome-sequence
* Buttondown - do they have retry policy? What about describing webhooks auth?
* https://docs.buttondown.com/customizing-email-design