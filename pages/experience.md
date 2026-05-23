<h1 class="mb-8">Experience</h1>

**I have been working professionally since 2017** in a variety of domains - energy and utilities, e-commerce, fintech, social networking, automated guided vehicles (AGV) - solving diverse problems in projects of all sizes and complexity levels. **Backend & infrastructure are my main focus and strength, but I was also involved as a fullstack web and mobile developer;** I enjoy being versatile and taking end-to-end responsibility. I am always interested in the following questions:
> How the system works as a whole? What is its role and purpose? What value does it provide? 

To have them answered, my curiosity often drives me to go beyond the currently assigned role. I truly love my work and care deeply about delivering the best possible solutions - taking the specific circumstances and context of the system into consideration.

Most of the projects I was engaged in were web-based and available through the browser, so that is the platform I know best. But, I have also worked on native mobile apps; I even did some embedded development (though still in Java) for [the autonomous forklift project](#java-programmer-at-inovatica).

### Some systems I have worked on

* creating an invoicing & billing system from scratch for [Respect Energy](https://respect.energy/), a renewable energy company
* designing, implementing, maintaining and evolving an [advertising platform](https://advertising.modivo.com) for [Modivo](https://modivo.pl) and [eobuwie](https://eobuwie.com.pl)
* co-founding, architecting and implementing [Collybri - business speed dating app](#co-founder-at-collybri)
* co-founding, designing, implementing, maintaining and marketing [Hairo - social networking app](#co-founder-at-hairo)
* organizing, implementing, maintaining and evolving a data lake platform that collected, aggregated, analyzed and visualized electricity, water and heat data from various meters for [Fortum](https://www.fortum.pl), an energy company
* [developing software to make regular forklifts autonomous](#java-programmer-at-inovatica)

### Interesting problems I have solved

* seamlessly moving a production system - containing 15+ services and lots of dependencies - from one GCP infrastructure set up by developers into another one, company-wide and thought-through by the dedicated DevOps team
* simplifying architecture, reducing maintenance & infrastructure costs as well as development time by merging redundant microservices into fewer, more related modular services
* prototyping product search with image and/or text description as input, using vector embeddings
* implementing real-time video calls based on WebRTC - which worked globally, for participants all around the globe
* redesigning - and then reimplementing - CI/CD solution built on problematic Jenkins into a custom CLI, running locally and triggering various jobs and processes on the AWS infrastructure
* creating a safety system for the autonomous forklift that allowed it to firstly slow down and then stop, if the detected obstacle was too close - made possible by getting data from the mounted on a forklift [Lidar](https://en.wikipedia.org/wiki/Lidar), publishing point cloud over TCP/IP multiple times per second

### Major technologies I am familiar with

* Java/Kotlin, Python, Java/TypeScript and HTML/CSS
* Spring Boot, Node.js and React
* PostgreSQL, MySQL, SQLite, BigQuery and MongoDB
* WebRTC and WebSockets
* [Microservices and Modular Monoliths](/modularity-posts.html)
* Docker, Kubernetes, Grafana, Prometheus
* CI/CD solutions - GitLab, GitHub, Argo CD, Terraform, custom scripts & pipelines 
* managed services in the clouds: AWS, GCP and DigitalOcean
* [various types of tests](/unit-integration-e2e-contract-x-tests-what-should-we-focus-on.html) and the experience to know when to apply them (and in what proportions)

## Positions & Projects {#positions-and-projects}

Below is a more detailed description of my work, experience and projects I was/am involved in:
* [Senior Software Developer at Jit Team](#senior-software-developer-at-jit-team) (2026.02 - now)
* [Senior Software Developer at Respect Energy](#senior-software-developer-at-respect-energy) (2025.01 - 2025.11)
* [Senior Backend Developer at Modivo](#senior-backend-developer-at-modivo) (2022.10 - 2024.12)
* [Co-Founder at Collybri](#co-founder-at-collybri) (2023.04 - 2023.06)
* [Co-Founder at Hairo](#co-founder-at-hairo) (2022.04 - 2023.05)
* [Backend Developer at Uncapped](#backend-developer-at-uncapped) (2021.11 - 2022.03)
* [Java/Python Programmer at Hycom](#java-python-programmer-at-hycom) (2019.11 - 2021.10)
* [Java Programmer at Inovatica](#java-programmer-at-inovatica) (2017.09 - 2019.10)
* [Other projects](#other-projects)

### Senior Software Developer at Jit Team

Since **2026.02**, I have been working at [Jit Team](https://jit.team/), on a greenfield project for [Allegro](https://allegro.pl/), a major e-commerce player in Poland. I am also involved in recruiting new developers, veryfing their skills and knowledge.

[As of now](https://en.wikipedia.org/wiki/Non-disclosure_agreement), I am not allowed to describe what exactly the project is about, but my role is quite broad: including architecture design, refining requirements, technical implementation, as well as maintenance and development on production.

**Tech stack:** Microservices & Modular Monolith, Java, Spring Boot, MongoDB, Testcontainers, GitHub Actions, GCP, BigQuery, Kafka, Grafana and VictoriaMetrics (Prometheus-compatible).

### Senior Software Developer at Respect Energy

Through **2025.01 - 2025.11**, I was working on an internal invoicing & billing system for [Respect Energy](https://respect.energy), a renewable energy company. The software mainly calculated client receivables, payables and final balances; it also issued various accounting documents - invoices, accounting & interest notes, compensations and so on. The domain was remarkably complex, involving numerous interconnected business rules and edge cases.

**Major challenges:**
* migrating accounting and financial data from the legacy system, operating for many years on the external infrastructure and making it compatible with a new solution
* given a tight deadline, balancing out copying features from the previous system as is, compared to figuring out better ways and approaches to business processes and operations; especially given the limited availability of the system's end users and high domain complexity
* integrating with other external systems (and teams) - Data Warehouse, CRM, ERP and [KSeF](https://ksef.podatki.gov.pl/)
* generating a lot of PDFs - invoices and other accounting documents - of quite complex structure and styling requirements

As a senior developer, my responsibilities consisted of designing and proposing new solutions, aligning with other teams, specifying requirements more precisely, implementing them technically and guiding more junior team members. In this role, I have worked across the entire stack: backend, frontend and infrastructure (AWS). For some time, I was also involved in recruiting new developers and *running a company-wide technical guild*, which helped me to hone my soft skills.

**Tech stack:** Microservices, Spring Boot, Java, Hibernate, PostgreSQL, Apache Kafka and Avro, Testcontainers, Snowflake, Kubernetes, Argo CD, GitHub Actions, AWS, Microfrontends, TypeScript and React.

### Senior Backend Developer at Modivo

For the **2022.10 - 2024.12** period, I was involved in building a custom advertising system for the [Modivo e-commerce platform](https://modivo.pl/), operating in multiple European countries under two brands - Modivo & eobuwie. It allowed the creation of paid campaigns that were then emitted on websites and apps belonging to the Modivo brand. 

**Major challenges:**
* integrating our solution into the existing system, operating on a completely different infrastructure
* designing an auction engine robust enough to handle *tens and possible hundreds of advertising queries per second, with less than 150 milliseconds latency at the 99th percentile*; on top of that, making it both fair to paying advertisers and valuable for users
* preventing fraudulent views and clicks so that advertisers are not charged unfairly
* guaranteeing that ads are no longer emitted (as fast as possible) once sponsored products are no longer available or the campaign budget has run out

Working in a small team of a few people, I was responsible for delivering features end-to-end: from refining requirements, organizing work through tickets & tasks to designing technical solutions and the actual implementation. **It was one of the very best experiences of my career** - I got to be at the very start of the product & system design, be involved in the technical implementation and then maintenance and evolution on production.

**As a side quest**, at the end, I worked on an interesting proof of concept: *let's create a product search based on image and/or text description, using vector embeddings*. The results were very promising, but due to structural changes in the company, the project was unfortunately shut down. Nevertheless, at the time I became more interested in the topic of vector embeddings - [even making a YouTube video about it](https://www.youtube.com/watch?v=r7GNyEdizoc).

**Tech stack:** Microservices & Modular Monolith, Kotlin, Spring Boot, Spring Data JDBC, PostgreSQL, Testcontainers, GCP, Google Cloud SQL, BigQuery, Google Cloud Pub/Sub, Protocol Buffers, Apache Kafka, Kubernetes, Argo CD, Terraform, GitLab Pipelines, Grafana, Prometheus, Keycloak, TypeScript and Vue.js.

### Co-Founder at Collybri

In the short span of **2023.04 - 2023.06**, together with my brother, we designed and implemented *the idea of a third Co-Founder* - business speed dating app, allowing hosting online events for networking purposes.

**Major challenges:**
* devising - and then implementing - an algorithm to match people for video calls, in real time, on the event - taking their availability and meeting history into account
* designing - and then implementing - a frictionless *invite to the event & create account flow*

Sadly, due to personal problems of the third Co-Founder, the project was not fully launched - we only ran a few test events. But technically, it was ready to be used with the established date of the first official event.

A lot of technology that we - me and my brother - have designed and implemented while [creating Hairo](#co-founder-at-hairo) (especially around video calls) was reused here. **Tech stack:** Modular Monolith, Java, Spring Boot, PostgreSQL, Testcontainers, WebRTC, Coturn, Docker, Prometheus, Grafana, Python/Bash scripts, TypeScript and Vue.js.

### Co-Founder at Hairo

From **2022.04 - 2023.05** I was building - together with my brother - [Hairo: automated system for meeting new people](https://hairo.io/archive). 

**Major challenges:**
* designing easy to understand and at the same time useful and practical algorithm of matching users
* figuring out convenient ways for people to keep in touch and meet regularly
* marketing and *actually gathering active users* through all kinds of creative ways
* implementing real-time video calls from scratch, using WebRTC, that work all around the globe
* devising and then managing a user verification process to make sure that we have real, genuine people on the platform

There were only two of us, working on everything - design, marketing, technical implementation as well as customer support. This was truly a life-changing experience and the deepest form of learning: I got to be a marketer, product owner and customer assistant while being architect & developer at the same time.  *After a year of its publication and gathering close to 1500 users, we decided to archive Hairo on May 31, 2023.*

**Tech stack:** Modular Monolith, Java, Vert.x, PostgreSQL, Testcontainers, WebRTC, Coturn, WebSockets, RabbitMQ, Docker, Grafana, Python/Bash scripts, TypeScript and Vue.js.

### Backend Developer at Uncapped

Through **2021.11 - 2022.03**, I was working on [Uncapped](https://www.weareuncapped.com) products, both internal and client facing. They had/have a platform that allowed entrepreneurs to take loans without giving up equity and by repaying them proportionally to their revenue. I focused mostly on the backend and infrastructure, but from time to time I was also implementing some small UI changes.

**Major challenges:**
* understanding and maintaining integrations with lots of different third-party systems (mainly e-commerce and payments): Stripe, Klarna, Shopify, WooCommerce, Magento, HubSpot and so on
* implementing a factoring solution for merchants, based on Stripe: Uncapped acted as a proxy allowing getting cash for sold products immediately, instead of waiting for Stripe up to a few weeks to pay it out
* fixing data inconsistency bugs in a distributed environment

**Tech stack:** Microservices, Java, Spring Boot, jOOQ, Postgres, Testcontainers, GCP, Google Cloud Pub/Sub, BigQuery, Kubernetes, Flux CD, Terraform, Grafana, Prometheus and React with TypeScript.

### Java/Python Programmer at Hycom

In the **2019.11 - 2021.10** period I was a Java/Python programmer at [Hycom](https://hycom.digital). I mainly worked on a data lake platform for Fortum (energy company) that collected, aggregated, analyzed and visualized electricity, water and heat data from various meters.

**Major challenges:**
* decoding data from various meters despite scant documentation
* transforming raw data into other formats more suitable for analysis and visualization; keeping it all consistent and synchronized
* managing *a few million meter readings per day* with the use of [TimescaleDB, a postgres extension for time-series data](https://github.com/timescale/timescaledb)
* preparing and executing production releases of the system made up of several dozen services
* redesigning - and then reimplementing - legacy CI/CD solution built on Jenkins and Ansible to a lighter, CLI-based one

I was involved in a variety of things here: from implementing various Java and Python applications that were transforming and/or sending data to CI/CD improvements and then complete redesign of the process. Later on, I also became responsible for production releases, which I regularly carried out together with a DevOps engineer. On top of that, I participated in a project that made some of our data available through a dedicated REST API and UI.

**As a side quest**, together with a colleague I mentored a group of students for one semester. Under our wings, they were developing a real application that was later on presented at their university.

**Tech stack:** Java, Spring Boot, jOOQ, Postgres, TimescaleDB, Testcontainers, Python, Apache Parquet, Spark, Jenkins, Ansible, Grafana and lots of AWS services: ECS, S3, SNS, SQS, RDS, Secrets Manager, CloudWatch, CodeBuild, Athena, DynamoDB and CDK.

### Java Programmer at Inovatica

This was my first programming job, where I spent **2017.09 - 2019.10** period (from 2017.07, if internship is taken into account). At the time, it was [a small software house](https://inovatica.com) and it was a great first experience and opportunity to learn - I worked on a few completely unrelated projects throughout those two years.

Firstly, I delved into developing native android applications in Java and Kotlin - for private clients as well as government institutions. Then, I worked on REST APIs, in particular on a tool for finding/planning a route based on an address and/or stops for public transport carriers.
Later on, I was involved in developing algorithms for [the autonomous forklift project](https://agv.inovatica.com) - taking regular forklifts and making them autonomous by the use of our own software and custom hardware.

**Tech I worked with here:** native android development, Java/Kotlin, Spring Boot, SQLite, Postgres, Robot Operating System (ROS), network programming over UDP and TCP, Java Swing (GUI) as well as figuring out various new algorithms for the autonomous forklift project.

### Other projects

In a random order:
* Linkuro - it was a slight variation of [Collybri](#co-founder-at-collybri) that we launched again with my brother; unfortunately, we did not find an effective-enough way of promoting it
* [This blog]({{httpsDomain}}) and [related YouTube channel]({{youTubeChannelUrl}}) - sharing my knowledge, experience and insights, as well as having a platform for constant learning, improvement and exploration of various approaches & ideas
* [EventSQL](/events-over-sql.html) - events over SQL
* [Flexible Components](https://github.com/BinaryIgor/Flexible-Components) - configurable and flexible, framework-agnostic Web Components collection
* [Smart Query](https://github.com/BinaryIgor/Smart-Query) - SQL builder library for a more convenient application-database interactions
* [Bright Server](https://github.com/BinaryIgor/Bright-Server) - standalone Java HTTP server that I have implemented from scratch to learn more deeply about networking

<br>