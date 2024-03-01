---
{
    "title": "Kubernetes: maybe a few Bash/Python scripts is enough",
    "slug": "kubernetes-maybe-a-few-bash-python-scripts-is-enough",
    "publishedAt": "2024-03-05",
    "startedAt": "2024-02-24",
    "timeToRead": "26 minutes",
    "wordsCount": 3240,
    "excerpt": "When it comes to the infrastructure of a software system, there are some features that are virtually always needed, independently of the project's nature, and some that are additional, optional, or useful only in <em>some projects and contexts</em>. Coming from a position of being aware what we <em>actually</em> need and what our project is about, we can make more informed, rational decisions and reduce the complexity of our system, which is something that we should care about a lot.",
    "researchLog": [ 5, 3, 3 ],
    "writingLog": [ 2, 1.5, 2, 2.5, 0.5, 4, 4, 3, 4.5, 3.5 ]
}
---

## What do we need from Infrastructure?

When it comes to the infrastructure of a software system, there are some features that are virtually always needed, independently of the project nature, and some that are additional, optional, or useful only in *some projects and contexts*. Coming from a position of being aware of what we *actually need* and what our project is about, we can make more informed and rational decisions, and hopefully reduce the complexity of our system, which is something that we should care about. Simplicity should be one of our highest goals, a top priority, when designing software systems; the simpler a system is, the easier it is to understand, debug, maintain and change. Infrastructure is a crucial component of every software system: what do we need from it?

### Required, must haves
1. **Fast and reliable builds** of our applications/artifacts/libraries
2. **Fast and reliable deployments** of our applications to various environments (like dev, stage, prod) - preferably with zero downtime for some of them, when and if it is needed
3. **Ability to quickly rollback failed deployment** to the previous working version
4. Trace of at least recent deployments history -  what version are we currently running of a given app?
5. **Straightforward way of configuring our apps** - resources that they need (mostly memory and cpu), configuration parameters/environment variables, static files, secrets, number of instances and so on
6. **Possibility of scaling our applications** - either through increasing the number of instances or just scaling vertically, by increasing resources of a single instance. In most cases, it does not have to be automatic, can be manual, since usually it is not our app that is a bottleneck, but database or other external storage/service
7. **Closed, private network** (often called *Virtual Private Cloud*) - so that applications can talk to each other in both more secure and performant way. Even if we have just a single app (modular monolith, highly recommended), we usually have a database deployed separately; unless we run everything on a single, big machine
8. If we have multiple applications, running on multiple machines and they communicate directly with each other a lot - we usually need to have some kind of service discovery, where we can call other services by their private host/name rather that hardcoded ip address (amazing.service.local:8080, not 10.114.0.1:8080)
9. **As much as possible Infrastructure as Code** - so there is no forgotten magic due to manual processes, we have up to date documentation (source code), and most importantly - we can recreate our infrastructure from scratch, at any point in time, with minimal effort, in a mostly automated way. We do not necessarily need to use tools like <a href="https://www.terraform.io/" target="_blank">Terraform</a> to achieve this - we just need to have everything described in our scripts/config files
10. **Backups of important data and a known way to restore them**
11. **Easy way to look up logs of our applications/components** - both current and historical (for a reasonable time period)
11. **Metrics of all running applications, components and machines** - things like memory and cpu usage, system load average, used disk space and I/O operations, network usage etc.
12. **Metrics visualizations and alerts** - to know that something is about to go wrong and to react as fast as possible

### Optional, nice to haves
1. **Automatic scaling of applications and machines** - to less/more instances based on the current application/system load or some other criteria. I find that it is rarely needed; when this is the case, it is only for a specific application, it is specific to this application (database/other external service being often a bottleneck), must be hand-coded anyways, or can be delegated to an external service of *Serverless Functions* type (AWS Lambda, GCP Cloud Functions or DigitalOcean Functions for example), if our application is really bursty in nature
2. **Automated application deployment scheduling** - to whatever machine is the most suitable, least loaded or just available. In 90%+ cases, with reasonable system architecture (limited number of services/deployment units), specifying dedicated machine/machines explicitly is good enough, unless we have tens and tens of services and each of them needs automatic, horizontal scaling which is rarely the case.
3. **Granular isolation of workspaces/resources per team/domain** - needed only if have many, not a few, teams
4. **Canary releases/deployments** - most of the time, we can just ship new version of the code; in other cases, we can use feature flags, supported by the majority of programming languages/environments, and implemented in the application layer

### Reasoning and assumptions
Some of the choices might seem arbitrary, so a few words of comment will be helpful. Based on my experience of implementing various systems from scratch, and then maintaining, changing and extending them over the years - these are my observations, assumptions, thoughts and opinions:
* <a href="/modular-monolith-and-microservices-modularity-is-what-truly-matters.html" target="_blank">**Most systems can be built either as a modular monolith or a few (micro)services**</a> - this significantly simplifies our infrastructure, since we only have one or a few deployment units to deploy
* **Most systems can be built by a single team or just a few teams** - this also can simplify our infrastructure; we do not need to have elaborate resources and workspaces isolation for example
* **Most systems have quite predictable resource requirements** - they can vary, but not to a point that justifies a need to have automated horizontal scaling for example. Also, it often is known in advance; we can then increase or decrease resources in a manual or semi-automatic way: either by manually adding/removing instances or scheduling this fact for certain busy hours/periods
* **Single machine, and certainly a few machines, can handle a lot - do we really need more than 3 x 32 GB memory + 16 CPUs machine?** Do we need Kubernetes to manage one, three or five servers? Is Docker/other container engine not good enough? 
* Containers are an amazing abstraction: they improve security, system libraries and dependencies management, and processes isolation to a great degree - do we really need <a href="https://en.wikipedia.org/wiki/Fundamental_theorem_of_software_engineering" target="_blank">another two or three abstraction layers</a> built on top of them?
* **We should judge system complexity holistically - if applications are simple, but infrastructure is complex, we still have a complex system** that needs a lot of maintenance; we have just shifted this responsibility to a different person/team/departament/company
* **Kubernetes, besides being complex, requires many supplementary tools to make it usable** - custom scripts and tools can often be easier to write, understand and maintain. For honest assessment, we need to compare them with *Kubernetes cluster + plethora of additional tools* that we have to use to make it operational and usable by developers on a daily basis

\
In general, I would argue that many, if not most, systems that we create these days are highly over-engineered and can be greatly simplified without taking away any of their functionality or ability to handle load. I acknowledge that there are edge cases, when we do need nearly infinite scalability and resources, but the reality is that 99.99% of systems are neither Google nor Amazon or Netflix. Keeping that in mind, let's assess how Kubernetes aligns with our infrastructure requirements and needs.

## Kubernetes - why so much Complexity?

Before we can answer this question, let's try to define what Kubernetes is:
> Kubernetes is a container orchestration platform. It allows us to automatically deploy, scale and manage containerized applications. 
> 
> In essence, it is a sophisticated container scheduler. We need to set it up as a cluster, on a set of machines.
Once established, applications can be defined as collections of Kubernetes objects and Kubernetes will take care of the rest. The rest means lots and lots of details: deploying application to a single or many nodes (machines) that can satisfy its resource requirements, scaling it to required number of instances, restarting, if it is not healthy, and making it available to other applications in the cluster network or to the external world, if that is what we need.
>
> Virtually everything in Kubernetes is configurable, dynamic and extendable. It is possible to have variable numbers of nodes (machines) that make up a Kubernetes cluster; it is also possible to have dynamic number of replicas for some or all applications, depending on their cpu/memory usage or any other criteria. It has built-in service discovery and load balancing mechanisms and can handle practically all possible network communication use cases.
>
> In a nutshell: it handles basically all theoretically possible infrastructure problems in the most abstract and configurable way possible.

\
Kubernetes is a powerful beast, but as they say:
> No such thing as a free lunch.

**For all these features we pay a high price: Complexity**; Kubernetes is also a complex beast. It is mostly so, because it delivers so many features. There are numerous Kubernetes-specific concepts and abstractions that we need to learn. What is more, despite the fact that there are many managed Kubernetes services (Amazon EKS, Google GKE, DigitalOcean Kubernetes) that make setting up and operating a Kubernetes cluster significantly easier, it still needs to be learned and configured properly - **we are not freed from learning and understanding how Kubernetes works**.  By we, I mean mostly person/people/team who operate a cluster, but also to some extent developers, because they will be the ones who will configure and deploy applications (or at least they should be).

**Is the price of Kubernetes worth it?** As with everything, it depends. If we have multiple teams and dozens of (micro)services then probably yes, but I am biased towards simplicity, so in that case I would ask:
> Do we really need to have tens and tens of microservices?

Sometimes, the answer will be yes, but we do need to make sure that it is really a *resounding yes*, because it will bring lots of additional complexity that we are far better off avoiding.

Moreover, what is worth emphasizing, **Kubernetes itself is not enough to solve all our infrastructure-related problems**. We still need to have other tools and scripts to build, package and deploy our applications. Once we have a properly set up Kubernetes cluster, which itself is not an easy task, we are only able to deploy something. We then need to at least figure out:
* Where and how to store our Kubernetes objects? In most cases, the answer is: git repository
* How to synchronize the state of Kubernetes objects between git repo and a cluster? We need yet another tool for that
* In the Kubernetes context, an application is just a set of arbitrarily chosen Kubernetes objects (<a href="https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/" target="_blank">defined as manifests in yaml or json files</a>). We need to answer: how we are going to package and deploy those objects as a single unit? Unfortunately, we need yet another tool for that. At the time of writing this article, <a href="https://helm.sh" target="_blank">Helm</a> and <a href="https://kustomize.io" target="_blank">Kustomize</a> are the most popular solutions

Sadly, Kubernetes is not a complete platform; we need additional tools to make it usable and that means even more complexity. This is a very important factor to keep in mind when evaluating the complexity of a set of custom scripts and tools to build, deploy and manage containerized applications.

As said, most systems can be composed of one or a few services, each being deployed in one to several instances. If this is our case, Kubernetes is an overkill, it is not needed and we should not use it. The question then remains: what is the alternative?

## Simple Bash/Python scripts and tools approach

Before discussing *do-it-yourself (DIY)* approach, I wanted to mention a few **managed service alternatives from various Cloud Providers; most notably, there is Amazon Fargate, Google Cloud Run and Azure Container Instances**. They are all similar: they are based on *containers* and give most of the Kubernetes features for the price of vendor lock-in and the additional cost for the service. We give up some control and need to pay a little more for the price of speed and convenience. They run containers for us, *somewhere on their infrastructure* - we do not need to worry about servers; we do need to learn a few abstractions to define services/tasks in their service-specific config file format, but then it is mostly it, it just works. Compared to using Kubernetes, even as a managed service, most things are preconfigured and chosen for us with sensible defaults; we do not need to learn lots of new abstractions. We will still need to write a couple of scripts/pipelines to integrate our builds and deployments with these managed services, but significantly less than in the do-it-yourself approach, plus we do not need to care about infrastructure. Let's also keep in mind that these services have certain limitations and constraints - we do need to make sure that our chosen one covers all our needs; depending on the situation, it might be a tradeoff worth making. Nevertheless, even if we choose this path, I still recommend at least learning a do-it-yourself approach to have a better perspective on this decision and what the real tradeoffs are. Having this in mind, let's discuss a possible solution.

**Building our solution from scratch**, most, if not all, of our needs can be covered by:
* **One to a few virtual machines, where we can run containerized applications.** These machines need to have Docker/other container engine installed and configured + all other needed software/tools, configured *deploy user*, private network, firewalls, volumes and so on
* **Script or scripts that can create these machines and initialize them on their first start.** For most cloud providers, we can use their rest API or describe these things in a tool like *Terraform*. Even if we do not decide to use Terraform, our script/scripts should be written in a way that it is always reproducible, in case when we need to modify or recreate our infrastructure completely from scratch - it should be doable from the code
* **Build app script** that will:
    * Build our application and its container image. It can be stored on our local or a dedicated build machine; we can also push it to the private container registry
    * Package our containerized application into some self-contained, runnable format - *package/artifact*. It can be just a bash script that wraps *docker run --restart unless-stopped* with all necessary parameters, environment variables, runs pre/post scripts around it, stops previous version and so on. Running it would be just calling *bash run_app.bash* - the initialized docker container (our application) with all needed parameters will be then started
* **Deploy app script** that will:
    * *ssh* into the target virtual machine or machines
    * Copy our app's package from local/build machine or remote repository, if we have uploaded it there
    * Copy container image of our application from local/build machine or pull it from the private container registry
    * Once we have the app package + its container image available on the target vitual machine/machines; run this package, which basically means stopping the previous version of an app and starting a new one
    * If our app requires zero downtime deployment - we need to first run it in two instances, hidden behind some kind of reverse proxy, like Nginx. Once a new version is ready, we just need to update the reverse proxy config - so that it points to a new version of the app - and then kill the previous version
* **Scripts/tools to monitor our application/applications and have access to their metrics and logs.** For that we can use <a href="https://prometheus.io/" target="_blank">Prometheus</a> + a tool that runs on every machine and collects metrics/logs from all currently running containers. It should then expose collected metrics to Prometheus; logs can be saved in the local file system or a database (<a href="https://github.com/BinaryIgor/code-examples/tree/master/metrics-and-logs-collector" target="_blank">*Metrics and Logs Collector example*</a> does exactly that)
* **Scripts/tools to generate, store and distribute secrets.** We can store *encrypted* secrets in a git repository - there are ready to be used tools for this like <a href="https://github.com/getsops/sops" target="_blank">SOPS</a> or <a href="https://github.com/StackExchange/blackbox">BlackBox</a>; it is also pretty straightforward to create a script with this functionality in virtually any programming language. The idea here is that we have secrets encrypted in the git repo and then copy them to the machine/machines where our applications are deployed; they sit there *decrypted*, so applications can read them from files or environment variables
* **Scripts/tools for facilitate communication in the private network.** We can do the following:
    * Setup private network (VPC) available for all virtual machines that make up our system
    * Use Docker <a href="https://docs.docker.com/network/network-tutorial-host/" target="_blank">host</a> networking for hosts that need to be available outside a single machine and that need to communicate with containers not available locally; we can then also use a */etc/hosts* mechanism described below
    * We explicitly specify where each app is deployed, to which machine or machines. Using Linux machines, we can simply update */etc/hosts* file with our apps names and private ip adresses of the machines, where they run. For example, on every machine we would have entries like *10.114.0.1 app-1*, *10.114.0.2 app-2* and so on - that is our service discovery mechanism; we are then able to make requests to *app-1:8080* instead of *10.114.0.1:8080*. As long as the number of our machines and services is reasonable, it is perfectly valid solution
    * If we do have a larger number of services that can be deployed to any machine and they communicate directly a lot (maybe they do not have to?), we need to have a more generic *service discovery* solution. There are plenty ready to be used solutions; it is also not that hard to implement our own tool, based on simple files, where service name would be a key and the list of machines' private ip addresses would be the value
* **Scripts/tools for database and other important data backups.** If we use managed database service, which I highly recommend, that is taken care of for us. If we do not or we also have other data that need backing it up, we need to have a scheduled job/task. It should periodically run a set of commands that create a backup and send it to some remote storage/separate machine for future, potential use

\
That is a lot, but we have basically covered all infrastructure features and needs for 99% of systems. Additionally, that is really all - let's not forget that with Kubernetes we have to use extra, external tools to cover listed here needs; Kubernetes is not a complete solution. Another benefit of this approach is that **depending on our system's particular needs, we can have a various number of scripts of varying complexity - they will be perfectly tailored towards our requirements**. We will have minimal, essential complexity, there will only be things that we actually need; what is more, we have absolute control over the solution, so we can extend it to accommodate any arbitrary requirements.

## Final thoughts

We have gone over all possible requirements and expectations that a software infrastructure needs to meet. As it turns out, there are quite a lot of them; we need to think about and cover many things when designing our infrastructure.

We have found out that **we should evaluate infrastructure complexity similarly to how we judge code or software architecture complexity**. After all, infrastructure is also a part of our software system, arguably one of the most important ones. What is more, its complexity is tied up with our software architecture complexity. The more accidental complexity in our architecture we have, the more it leaks into the infrastructure, making it unnecessary complex also. Same as we do with code and architecture, we should tailor infrastructure to our needs; we should not blindly follow current trends. Always stop and ask: is this really what we need? What are the tradeoffs and hidden costs?

We have then learned that Kubernetes is a powerful beast, but also highly complex one; and as we know or will learn in the future: <a href="https://grugbrain.dev/#grug-on-complexity" target="_blank">**Complexity is our Eternal Enemy**</a>.
If we really, really need to use a complex solution, then yes, we should go for it, but if we can avoid it, we should work hard on avoiding it.

In conclusion: if we have a single or few teams, we should just build a modular monolith or few modular services. In that case, we do not need to use Kubernetes; we can just use managed services like AWS Fargate, Google Cloud Run or any other similar ones, or rollout a few Python/Bash scripts what will build, deploy and manage our containerized applications on a set of virtual private servers. We can also combine the two approaches, to whatever degree we want to be dependent on the particular cloud provider services and to what extent we want to have a provider-independent solution. Of course, **there are instances where it makes sense to use Kubernetes, but in the vast majority of cases, having a reasonable number of services and avoiding Kubernetes, we will greatly simplify our system, make it easier to understand, maintain and extend**. Then, we can focus on delivering next features and value to our users and customers rather and dealing with accidental complexity that we have created for ourselves. 

So forge ahead and keep simplifying!

<div class="article-delimiter">---</div>

### Related videos on my <a target="_blank" href="{{ youtubeChannelUrl }}">youtube channel</a>
1. <a href="https://www.youtube.com/watch?v=68PzQNsuSWc" target="_blank">Collecting metrics and logs from Docker containers</a>
2. <a href="https://www.youtube.com/watch?v=YGJN8lsiWvk" target="_blank">Visualizing containers metrics in Grafana</a> 

<div class="article-delimiter">---</div>

### Notes and resources

1. I plan to make a video or write an article where I will check out how much a single machine can handle. I think that a lot, but let's wait and see ;)
2. Highly valuable series on a need for simplification of our IT systems:
    1. https://www.ufried.com/blog/simplify_1/
    2. https://www.ufried.com/blog/simplify_15_summing_up/
3. The fallacies of microservices: https://www.ufried.com/blog/microservices_fallacy_1/
4. Virtues of a monolith: https://signalvnoise.com/svn3/the-majestic-monolith
5. Evergreen article on why you should prefer battle-tested technologies and simple stacks in general: https://boringtechnology.club/
6. Avoid complexity: https://www.youtube.com/watch?v=4MEKu2TcEHM
7. On Kubernetes networking:
    1. https://learncloudnative.com/blog/2023-05-31-kubeproxy-iptables
    2. https://whyk8s.substack.com/p/why-not-dns
8. Podman, Docker alternative: https://docs.podman.io
9. On Kubernetes complexity:
    1. https://amazic.com/kubernetes-the-most-complicated-simplification-ever/
    2. https://cloudplane.org/blog/why-kubernetes-is-so-complex
    3. https://home.robusta.dev/blog/kubernetes-is-complex-because-you-want-complex-things


### TODO
1. Coherent links/italics to external services 
2. Coherent names like private image registry - captialized/not capitalized? italics?