---
{
    "title": "Kubernetes: maybe a few Bash/Python scripts is enough",
    "slug": "kubernetes-maybe-a-few-bash-python-scripts-is-enough",
    "publishedAt": "2024-03-09",
    "startedAt": "2024-02-24",
    "excerpt": "When it comes to the infrastructure of a software system, there are some features that are virtually always needed, independently of the project nature, and some that are additional, optional, or useful only in <em>some projects and contexts</em> ... Infrastructure is a crucial component of every software system: what do we need from it?",
    "researchLog": [ 5, 3, 3 ],
    "writingLog": [ 2, 1.5, 2, 2.5, 0.5, 4, 4, 3, 4.5, 3.5, 1, 2.5, 2, 1, 3 ]
}
---

## What do we need from Infrastructure?

When it comes to the infrastructure of a software system, there are some features that are virtually always needed, independently of the project nature, and some that are additional, optional, or useful only in *some projects and contexts*. Coming from a position of being aware of what we *actually need* and what our project is about, we can make more informed and rational decisions; hopefully reducing the complexity of our system, which is something that we should care about. Simplicity should be one of our most important goals, when designing software systems, because simple systems are easy to understand, debug, maintain and change. Infrastructure is a crucial component of every software system: what do we need from it?

### Required, must haves
1. **Fast and reliable builds** of our applications
2. **Fast and reliable deployments** of our applications to various environments (like dev, stage, prod) - preferably with zero downtime for some of them
3. **Ability to quickly rollback failed deployments** to the previous working version
4. Trace of at least recent deployments history -  what version are we currently running of a given app?
5. **Straightforward way of configuring our apps** - resources that they need (mostly memory and cpu), configuration parameters/environment variables, static files, secrets, number of instances and so on
6. **Possibility of scaling** - either through increasing the number of application instances or just scaling vertically, by increasing resources of a single instance. In most cases, it does not have to be automatic, can be manual, since usually it is not an application that is the bottleneck, but a database or other external storage/service
7. **Closed, private network** - so that applications can talk to each other in both more secure and performant way. Even if we have just a single app (modular monolith, highly recommended), we usually have a database deployed separately; unless we run everything on a single, big machine
8. Some kind of service discovery mechanism - if we have multiple applications, running on multiple machines and they communicate directly with each other - where we can call other services by their host/name rather that hardcoded private ip address (*some.service:8080*, not *10.114.0.1:8080*)
9. **Infrastructure as Code** - so we have up to date documentation (source code), there is no forgotten magic due to manual processes and most importantly - we are able to recreate our infrastructure from scratch, at any point in time. We do not necessarily need to use tools like <a href="https://www.terraform.io/">Terraform</a> to achieve this - we just need to have everything defined in the code, in scripts and config files
10. **Backups of important data and a way to restore them**
11. **Convenient access to logs** of our applications and components - both current and historical (for a reasonable time period)
11. **Metrics of all running applications, components and machines** - things like memory and cpu usage, system load average, used disk space and I/O operations, network usage etc.
12. **Metrics visualizations and alerts** - to know that something is about to go wrong, troubleshoot issues and to react as fast as possible

### Optional, nice to haves
1. **Automatic scaling of applications and machines** - to less/more instances based on the current application/system load. I find it rarely needed and when it is, it is only for a specific application and it is specific to this application (database or other external service being often a true bottleneck), so it must be customized anyways. Moreover, for applications that are really bursty in nature, their resource requirements *vary a lot*, we should probably delegate them to an external service of *Serverless Functions* kind (AWS Lambda, Google Cloud Functions or DigitalOcean Functions for example)
2. **Automated application deployment scheduling** - to machine/machines most suitable, least loaded or just available. In the majority of cases, with reasonable system architecture, having a limited number of services, specifying machine or machines explicitly is good enough; unless we have tens and tens of services and most of them need automatic, horizontal scaling, which is rarely the case
3. **Granular isolation of workspaces/resources per team/domain** - needed only if there are many, not a few, teams
4. **Canary releases/deployments** -  most of the time, we can just ship a new version of the code. In other cases, we can use *feature flags*, in the application layer, which are supported by the majority of programming languages and environments

### Reasoning and assumptions

Some of my choices might seem arbitrary, so a few words of comment might be helpful. Here are my observations, assumptions, thoughts and opinions - based on the experience of implementing various systems from scratch and then maintaining, changing and extending them over the years:
* **<a href="/modular-monolith-and-microservices-modularity-is-what-truly-matters.html">Most systems can be built either as a modular monolith or few (micro)services</a>** - this significantly simplifies our infrastructure, since we only have one or few deployment units
* **Most systems can be built by a single team or just a few teams** - this also simplifies our infrastructure; we do not need to have elaborate resource and workspace isolation schemas for example
* **Most systems have quite predictable resource requirements** - they can vary, but not to the point that justifies a need to have automated horizontal scaling. Also, it is often known in advance; we can increase or decrease resources in a manual or semi-automatic way: either by manually adding/removing instances or scheduling it for certain busy hours/periods
* **Single machine, and certainly a few machines, can handle a lot** - do we really need more than *3 x 32 GB memory + 16 CPUs machine*? Do we need Kubernetes to manage one, three or five servers?
* Containers are an amazing abstraction: they improve security, system libraries and dependencies management, and processes isolation to a great degree - do we really need <a href="https://en.wikipedia.org/wiki/Fundamental_theorem_of_software_engineering">another two or three abstraction layers</a> built on top of them?
* **We should judge system complexity holistically - if applications are simple, but infrastructure is complex, we still have a complex system** that needs a lot of maintenance; we just shift this responsibility to a different person, team or department
* **Kubernetes, besides being complex, requires many supplementary tools to make it usable** - custom scripts and tools can often be easier to write, understand and maintain. To make an honest assessment, we need to compare them with the *Kubernetes cluster + additional tools* that we have to use to make it operational and usable by developers on a daily basis

\
In general, I would argue that many, if not most, systems that we create these days are highly over-engineered and can be greatly simplified, without taking away any of their functionality or ability to handle load. I acknowledge that there are edge cases, when we do need nearly infinite scalability and resources, but the reality is that 99% of systems are neither Google nor Amazon or Netflix. Keeping this in mind, let's assess how Kubernetes aligns with our infrastructure requirements and needs.

## Kubernetes - why so much Complexity?

Before we can answer this question, let's try to define what Kubernetes is:
> Kubernetes is a container orchestration platform. It allows us to automatically deploy, scale and manage containerized applications. 
> 
> In essence, it is a sophisticated container scheduler. We need to set it up as a cluster, on a set of machines; once established, applications can be defined as collections of Kubernetes objects and Kubernetes will take care of the rest. The rest means lots and lots of details: deploying application to one or many nodes (machines) that can satisfy its resource requirements, scaling it to required number of instances, restarting, if it is not healthy, and making it available to other applications in the cluster network or to the external world, if that is what we need.
>
> Virtually everything in Kubernetes is configurable, dynamic and extendable. It is possible to have variable numbers of nodes (machines) that make up a Kubernetes cluster; it is also possible to have dynamic number of replicas for some or all applications, depending on their cpu/memory usage or any other criteria. It has built-in service discovery and load balancing mechanisms and can handle practically all network communication use cases.
>
> In a nutshell: it tries to handle basically all theoretically possible infrastructure problems in the most abstract and configurable way possible.

\
Kubernetes is a powerful beast, but as they say:
> No such thing as a free lunch.

**For all these features we pay a high price: Complexity**; Kubernetes is also a complex beast. It is mostly so, because it delivers so many features. There are numerous Kubernetes-specific concepts and abstractions that we need to learn. What is more, despite the fact that there are many managed Kubernetes services (Amazon EKS, Google GKE, DigitalOcean Kubernetes) that make setting up and operating a Kubernetes cluster significantly easier, it still needs to be learned and configured properly - **we are not freed from learning and understanding how Kubernetes works**.  By we, I mean mostly the person/people/team who operate a cluster, but also to some extent developers, because they will be the ones who will configure and deploy applications (or at least they should be).

**Is the price of Kubernetes worth it?** As with everything, it depends. If we have multiple teams and dozens of (micro)services then probably yes, but I am biased towards simplicity, so in that case I would ask:
> Do we really need to have tens and hundreds of microservices?

Sometimes, the answer will be yes, but we have to make sure that it is really *a resounding yes*, because it will bring lots of additional complexity that we are far better off avoiding.

Moreover, what is worth emphasizing, **Kubernetes itself is not enough to solve all our infrastructure-related problems**. We still need to have other tools and scripts to build, package and deploy our applications. Once we have a properly set up Kubernetes cluster, which itself is not an easy task, we are only able to *deploy something*. We then need to at least figure out:
* Where and how to store definitions of Kubernetes objects? In most cases, the answer is: git repository
* How to synchronize the state of Kubernetes objects between git repo and a cluster? We need a tool for that
* In the Kubernetes context, an application is just a set of arbitrarily chosen Kubernetes objects (<a href="https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/">defined as manifests in yaml or json files</a>). We need to answer: how we are going to package and deploy those objects as a single unit? Unfortunately, we need yet another tool for that. At the time of writing, <a href="https://helm.sh">Helm</a> and <a href="https://kustomize.io">Kustomize</a> are the most popular solutions

Sadly, to make Kubernetes a complete platform, we need to use additional tools and that means even more complexity. This is a very important factor to keep in mind when evaluating the complexity of a set of custom scripts and tools to build, deploy and manage containerized applications.

As said, most systems can be implemented as just one or a few services, each deployed in one to several instances. **If this is the case, Kubernetes is an overkill, it is not needed, and we should not use it.** The question then remains: what is the alternative?

## Simple Bash/Python scripts and tools approach

Before discussing the *do-it-yourself (DIY)* approach, I wanted to mention a few **managed alternatives from various Cloud Service Providers; most notably, there is Amazon Fargate, Google Cloud Run and Azure Container Instances**. They are all similar: they are based on *containers* and give most of the Kubernetes features for the price of vendor lock-in and additional cost for service. We give up control and need to pay more, but we get speed and convenience. They run containers for us, *somewhere on their infrastructure*, we do not have to worry about servers; we just need to learn a few abstractions to define services/tasks in their service-specific config file format, but then this is it, it just works. Compared to using Kubernetes, even as a managed service, most things are preconfigured and chosen for us with sensible defaults; we do not need to worry about the details, most of the time. We will still have to write a couple of scripts/pipelines to integrate our builds and deployments with these managed services, but significantly less than in the do-it-yourself approach, plus we are free not to care about infrastructure. However, it is important to note that these services have certain limitations and constraints - we have to make sure that they cover all our needs; depending on the situation, this dependency might be a tradeoff worth making. Nevertheless, even if we choose this path, I still recommend at least learning a do-it-yourself approach to have a better perspective on this decision and to know what the real tradeoffs are. Having this in mind, let's discuss a possible solution.

**Building a solution from scratch**, most, if not all, of our needs can be covered by:
1. **One to few virtual machines, where we can run containerized applications.** These machines need to have Docker or alternative container engine installed and configured + other required software/tools, set up deploy user, private network, firewalls, volumes and so on
2. **Script or scripts that would create these machines and initialize them on the first start.** For most cloud providers, we can use their rest API or describe those details in a tool like Terraform. Even if we decide not to use Terraform, our script/scripts should be written in a way that our infrastructure is always reproducible; in case we need to modify or recreate it completely from scratch - it should always be doable from code
4. **Build app script** that will:
    * Build application and its container image. It can be stored on our local or a dedicated build machine; we can also push it to the *private container registry*
    * Package our containerized application into some self-contained, runnable format - *package/artifact*. It can be just a bash script that wraps `docker run` with all necessary parameters (like *--restart unless-stopped*), environment variables, runs pre/post scripts around it, stops previous version and so on. Running it would be just calling `bash run_app.bash` - the initialized docker container of our app with all required parameters will be then started
    * This package could be pushed to some kind of custom <a href="https://docs.gitlab.com/ee/user/packages/generic_packages/">package registry</a> (*not container registry*) or remote storage; it might also be good enough to just store and deploy it from a local/build machine
5. **Deploy app script** that will:
    * *SSH* into the target virtual machine or machines
    * Copy our app's package from a local/build machine or remote repository/registry, if we have uploaded it there
    * Copy our app's container image from a local/build machine or pull it from the private container registry
    * Once we have the app package + its container image available on the target virtual machine/machines - run this package, which basically means stopping the previous version of the app and starting a new one
    * If the app requires zero downtime deployment - we need to first run it in two instances, hidden behind some kind of reverse proxy, like Nginx. Once a new version is ready and healthy, we just need to update the reverse proxy config - so that it points to a new version of the app - and only then kill the previous one
6. **Scripts/tools to monitor our application/applications and have access to their metrics and logs.** For that we can use <a href="https://prometheus.io/">Prometheus</a> + a tool that runs on every machine and collects metrics/logs from all currently running containers. It should then expose collected metrics to Prometheus; logs can be saved in the local file system or a database (<a href="https://github.com/BinaryIgor/code-examples/tree/master/metrics-and-logs-collector">*Metrics and Logs Collector example*</a> does exactly that)
7. **Scripts/tools to generate, store and distribute secrets.** We can store encrypted secrets in a git repository - there are ready to be used tools for this like <a href="https://github.com/getsops/sops">SOPS</a> or <a href="https://github.com/StackExchange/blackbox">BlackBox</a>; it is also pretty straightforward to create a script with this functionality in virtually any programming language. The idea here is: we have secrets *encrypted* in the git repo and then copy them to the machine/machines where our applications are deployed; they sit there *decrypted*, so applications can read them from files or environment variables
8. **Scripts/tools for facilitating communication in the private network.** We might do the following:
    * Setup private network, *VPC - Virtual Private Cloud*, available for all virtual machines that make up our system
    * Use Docker <a href="https://docs.docker.com/network/network-tutorial-host/">host</a> networking for containers that need to be available outside a single machine and that need to communicate with containers not available locally; we can then use a `/etc/hosts` mechanism described below
    * We explicitly specify where each app is deployed, to which machine or machines. Using Linux machines, we can simply update the `/etc/hosts` file with our app names and private ip addresses of the machines, where they run. For example, on every machine we would have entries like `10.114.0.1 app-1`, `10.114.0.2 app-2` and so on - that is our *service discovery* mechanism; we are then able to make requests to *app-1:8080* instead of *10.114.0.1:8080*. As long as the number of machines and services is reasonable, it is a perfectly valid solution
    * If we have a larger number of services that can be deployed to any machine and they communicate directly a lot (maybe they do not have to), we probably should have a more generic *service discovery* solution. There are plenty ready to be used solutions; again, it is also not that hard to implement our own tool, based on simple files, where service name would be a key and the list of machines' private ip addresses, a value
9. **Scripts/tools for database and other important data backups.** If we use a managed database service, which I highly recommend, it is mostly taken care of for us. If we do not, or we have other data that need backing up, we need to have a scheduled job/task. It should periodically run a set of commands that create a backup and send it to some remote storage or another machine for future, potential use

\
That is a lot, but we have basically covered all infrastructure features and needs for 99% of systems. Additionally, that is really all - let's not forget that with Kubernetes we have to use extra, external tools to cover these requirements; Kubernetes is not a complete solution. Another benefit of this approach is that **depending on our system specificity, we can have a various number of scripts of varying complexity - they will be perfectly tailored towards our requirements**. We will have minimal, *essential complexity*, there will only be things that we actually need; what is more, we have absolute control over the solution, so we can extend it to meet any arbitrary requirements.

## Final thoughts

We have gone over all possible requirements and expectations that a software infrastructure needs to meet. As it turns out, there are quite a lot of them; we need to think about and cover many things when designing our infrastructure.

We have found out that **we should evaluate infrastructure complexity similarly to how we judge code or software architecture complexity**. After all, infrastructure is also a part of our software system, arguably one of the most important ones. What is more, its complexity is tied up with our software architecture complexity. The more *accidental complexity* in our software architecture we have, the more it leaks into the infrastructure, making it unnecessary complex too. Same as we do with code and architecture, we should tailor infrastructure to our needs. We should not blindly follow current trends, but always stop and ask: 
> Is this really what we need? What are the tradeoffs and hidden costs?

\
We have then learned that Kubernetes is a powerful beast, but also highly complex one - and as we know or will learn in the future: <a href="https://grugbrain.dev/#grug-on-complexity">**Complexity is our Eternal Enemy**</a>.
If we really, really need to use a complex solution, then yes, we should go for it, but if we *can* avoid it, we should work hard to avoid it.

In conclusion: if we have a single or few teams, we should just build a modular monolith or few modular services. In that case, we do not need to use Kubernetes; we can just use managed services like AWS Fargate, Google Cloud Run or Azure Container Instances, or rollout a few Python/Bash scripts what will build, deploy and manage our containerized applications on a set of virtual private servers. We can also combine these two approaches, to whatever degree we want to be dependent on the cloud service providers or to be independent from them. Of course, **there are instances where it makes sense to use Kubernetes; in the vast majority of cases however, by sticking to a reasonable number of services and avoiding Kubernetes, we will greatly simplify our system and make it easier to understand, maintain and extend**. Then, rather than dealing with accidental complexity that we ourselves have created, we can focus on delivering next features and value to our users and customers.

So, let's forge ahead and keep simplifying!

<div id="post-extras">
<div class="post-delimiter">---</div>

### Related videos on my [YouTube channel]({{ youtubeChannelUrl }})
1. [Collecting metrics and logs from Docker containers](https://www.youtube.com/watch?v=68PzQNsuSWc)
2. [Visualizing container metrics in Grafana](https://www.youtube.com/watch?v=YGJN8lsiWvk)
3. [How many HTTP requests can a Single Machine handle?](https://www.youtube.com/watch?v=NsdDIBll-Lw)

<div class="post-delimiter">---</div>

### Notes and resources

1. I plan to make a video or write an article where I will check out how much a single machine can handle. I think that a lot, but let's wait and see ;) *Update 2024-03-28: [truly a lot](/how-many-http-requests-can-a-single-machine-handle.html)*
2. Highly valuable series on a need for simplification of our IT systems:
    1. https://www.ufried.com/blog/simplify_1/
    2. https://www.ufried.com/blog/simplify_15_summing_up/
3. The fallacies of microservices: https://www.ufried.com/blog/microservices_fallacy_1/
4. Virtues of a monolith: https://signalvnoise.com/svn3/the-majestic-monolith
5. Evergreen article on why we should prefer battle-tested technologies and simple tech stacks in general: https://boringtechnology.club
6. Avoid complexity: https://www.youtube.com/watch?v=4MEKu2TcEHM
7. On Kubernetes networking:
    1. https://learncloudnative.com/blog/2023-05-31-kubeproxy-iptables
    2. https://whyk8s.substack.com/p/why-not-dns
8. On Kubernetes complexity:
    1. https://amazic.com/kubernetes-the-most-complicated-simplification-ever/
    2. https://cloudplane.org/blog/why-kubernetes-is-so-complex
    3. https://home.robusta.dev/blog/kubernetes-is-complex-because-you-want-complex-things
9. Podman, Docker alternative: https://docs.podman.io    
10. Being addicted to the Cloud: https://www.youtube.com/watch?v=4Wa5DivljOM

</div>