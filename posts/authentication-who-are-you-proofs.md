---
{
    "title": "Authentication: who are you? Proofs are passwords, codes and keys",
    "slug": "authentication-who-are-you-proofs",
    "startedAt": "2025-12-01",
    "publishedAt": "2025-12-14",
    "excerpt": "In many systems, various actions can only be performed as some kind of Identity. We must <em>authenticate</em> ourselves by proving <em>who we are</em>. Authentication fundamentally is just an answer to this question: <em>who are you and can you prove it is true?</em>",
    "researchLog": [ 1, 1.5, 1, 0.5, 1 ],
    "writingLog": [ 4, 1, 3, 2, 2, 1.5, 1, 1, 3, 3, 2.5, 4, 1, 6.5, 3.5 ],
    "tags": ["auth", "deep-dive"]
}
---

## Identity - who are you?

In many systems, various actions can only be performed as [some kind of Identity](/centralized-vs-decentralized-identity-tradeoffs.html). We must *authenticate* ourselves by proving *who we are*. **Authentication fundamentally is just an answer to this question: *who are you and can you prove it is true?***
* When we shop online, we do it as a user with an account or without one, but definitely with an identity - usually an email/phone number with associated address and accounting data so that the order might be paid and delivered
* When we read emails through our Gmail, iCloud, Outlook or Proton account - we do so as a specific user, proving our identity by signing in
* When we engage in social media, we likewise do so as a specific user
* When services/machines talk to each other:
    * when service A uses the API of service B, it usually proves its identity either by [presenting API Token/Key](#api-tokens-keys) or [through Mutual TLS (mTLS)](#keys)
    * when service A [publishes events to a Message Broker or Event Bus](events-over-sql.html), it has to authenticate as well
    * when services use databases - authentication is likewise required, since databases want to know exactly who is connecting to decide what they are allowed to do (authorization)

*Authentication is all about Identity*, it does not protect from unauthorized access to specific resources and actions on them. That is what *Authorization* is responsible for (link to future post will follow). **The main goal of authentication is to identify the entity that wants to use our system**, making sure that it is authentic as well. We are then able to associate all actions performed in the system with identities - it allows a few useful things:
 * **Rejecting actions/requests** - from unauthenticated entities
 * **Authorization** - what are you allowed to do? It is hard to answer without an established identity
 * **Auditing & Analytics** - each action may be linked to a particular identity; they might then be tracked and analyzed to increase transparency and understanding of the system: What users (identities) most often do and use? Is their complaint valid? What is worth investing our time? Who and how has modified this resource at a specific date and time? And so on
 * **Identity Lifecycle & Verification** - since there is an identity (account), more elaborate processes, statuses and state transitions can be implemented. We may make newly created accounts go through onboarding first, then require some additional verification and/or enable extra features for paid accounts (identities) and so on

That is what authentication is on a high level; a fundamental concept of proving one's identity without which many systems and functionalities simply could not be built. **There is a multitude of possible implementations, but fundamentally they are very similar and lead to the same place.** Let's now explore them and see - why it is the case and how it works exactly.

## Passwords

The simplest, first and still widely used authentication method. There is a `username:password` pair that proves we are the claimed `username`. To support it in service A, there must be a process of:
* creating an account (identity) as a `username` with `password`
* this action changes the state of service A - `username:password` now exists
* when we want to act as the `username`, the correct `username:password` combination must first be presented; it proves that we indeed are the `username`

From that point onward, there is no need to present a `username:password` pair with each action/request we make; that would be not only unsecure, requiring to input a password repeatedly everywhere, but also annoying and slow - [passwords are stored and compared as hashes, created with deliberately slow hash functions](https://en.wikipedia.org/wiki/Cryptographic_hash_function#Attacks_on_hashed_passwords). Instead, after providing the correct `username:password` combination, we are given something in return; something that basically is an equivalent, a substitute of expected `username:password` value. *What is it?*

## Temporary Identity Proofs: sessions and tokens

In exchange for providing the correct `username:password` pair, we get:

> Temporary Identity Proof - stateful session or stateless token.
>
> It essentially is a proof of proof - information stating that we have successfully gone through the authentication process, of any complexity and number of steps, and we have proven our Identity.

*Passwords* are just one instance of many possible *authentication methods* - as we are about to see, the underlying mechanism works more or less the same for all cases:
* **there is an authentication process** - of any complexity and numbers of steps (factors); requiring passwords, codes or keys
* **we go through the process** -  get a session or token linked to the proven identity in exchange
* **this session or token now serves as identity proof** - there is no need to repeat the authentication process on each action/request
* **session or token can be thus called a *Temporary Identity Proof*, a proof of proof** - it is a proof of successful authentication, which requires a proof or proofs to verify identity

But, why do we even need it? What are the benefits of having this additional indirection layer?
* **Authentication process details and all its complexity, applied methods and number of steps, are *completely decoupled* from the result - failure or proven identity.** We might change the process freely at any time, but it always results in either failure or proven identity - and the issuance of a session/token linked to it
* **It is faster and simpler** - on each action/request, only the validity of the received session/token is checked; the whole authentication process has already taken place and its details are of no concern anymore
* **It is more secure and flexible** - authentication process frequency is reduced, since we mostly operate on temporary proofs - sessions and tokens; security is improved because the primary authentication factors (like passwords) are used more rarely. When somebody steals a session or token, it is valid only for a certain time; the potential damage made by an attacker is thus limited (at least in time) - the identity is kept, it is not stolen. Furthermore, sessions and tokens may be revoked or blocked immediately, on the user request or suspicious activity, preventing any potential damage from happening

\
How different are sessions and tokens in this context?

**Sessions are stateful** - after successful authentication:
* **Session for the proven identity is created and saved** - in a database or some other persistent storage engine
* **Session ID is returned to the client** - depending on the environment, it usually is stored somewhere on the client side; most often in the [HttpOnly Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies#block_access_to_your_cookies), as instructed by the server  
* **Session ID is added to each action/request of the client** - it is linked to the proven identity and serves as its temporary proof
* **Session ID is checked by the server** - on each action/request, as it is stored for every successful authentication process
* **Session expires or is revoked** - after configured time or inactivity period; revocation might be triggered by the user request or on noticing suspicious activity

**Tokens are stateless (mostly)** - after successful authentication:
* **Tokens for the proven identity are created** - they are not stored anywhere and usually, two tokens are generated: *short-lived access token and long-lived refresh token*. Access token gives access to resources and actions, refresh token is used solely to generate new tokens. [Most likely, they are JSON Web Tokens](https://en.wikipedia.org/wiki/JSON_Web_Token) that are cryptographically signed by the server's secret/key, allowing for stateless verification
* **Tokens, access and refresh, are returned to the client** - depending on the environment, they usually are stored somewhere on the client side. Most often, refresh token is saved in the [HttpOnly Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies#block_access_to_your_cookies), as instructed by the server, and access token *in memory or [session/local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage)*  
* **Access token is added to each action/request of the client** - it is linked to the proven identity and serves as its temporary proof
* **Access token is checked by the server** - on each action/request, as it was cryptographically signed by the server's secret/key
* **Refresh token generates new tokens** - when an access token is about to expire or absent, and a valid refresh token is available, it is used to get a *new access-refresh tokens pair* from the server
* **Refresh token expires or is revoked** - after configured time; revocation might be triggered by the user request or on noticing suspicious activity - but to support this functionality, refresh tokens must be stored in some way; it makes them stateful

In summary, **sessions and tokens work in a slightly different fashion, but the end result is the same**: after successfully going through an authentication process, which proves the identity, we receive a session or token that is then used on each action/request as a *Temporary Identity Proof* - making the process faster, simpler, more flexible and secure.

Let's now get back to other than `username:password` authentication methods - there are a couple of them and each comes with different mechanics and tradeoffs.

{{ .js: newsletterSignUpPostMid() }}

## Codes

These are various techniques that generate random and time-limited codes of different lengths - usually numeric or alfanumeric. [They are often used as a second factor in Multi-Factor Authentication (MFA) setups](#factors-single-vs-multi), but not only - another popular application are *Magic Links*. How does it work there?

**To our identity (account), an email or phone number is linked (or any other external messaging platform) - no need for a password.** Then, signing in:
1. we enter an email or phone number
2. server checks whether associated identity exists; if it does:
    1. short-lived (few minutes) code is generated
    2. it is saved in the server's database
    3. magic link is constructed - it contains the code & email/phone number/username and redirects to a sign-in page; something like: `https://the-best-app.com/sign-in?email=<email>&code=<code>` 
    4. it is sent to the client (us)
3. we receive the magic link
4. we click on it and are redirected to the sign-in page
5. on the sign in page, `email` and `code` are extracted from query params and sent to the server 
6. [if valid, the server returns a Temporary Identity Proof: session or token](#temporary-identity-proofs-sessions-and-tokens)
7. we are authenticated and prove it on each action/request by presenting the received session or token

With magic links, there is no need to store and use passwords, which is very convenient - for both servers and users. **The solution as a whole is as secure as the access to the messaging platform (email, phone number, application) is - if somebody hacks it, they are able to take control over our account (identity).** Fortunately, generated codes are short-lived; if they get stolen, most likely they will already expire and no longer be valid for an attack to take place.

**In the two and multi factor authentication setups, codes are used in a likewise fashion.** The key difference is that they are generated and sent only after one or few other authentication factors are presented - more on this below.  

## Factors: Single vs Multi

In the authentication processes described so far - passwords and codes (magic links) - there was only a single factor (proof). We were supplying a password or temporary code sent to the messaging platform controlled by us: *are there any issues with this approach?*

Well, there is only one factor, a single proof of an identity. If this factor gets stolen, the thief can impersonate us and take control over the identity. 

**With Two-Factor Authentication (2FA), even if one authentication factor gets stolen, password for example, an attacker still cannot control our identity, since two factors must be presented in the right order to prove identity - it is much more secure.** The authentication process itself is similar to what we already know:
* we present the correct `username:password` combination
* only after this first factor is approved, [short-lived code is generated and sent to our email/phone number/other messaging platform](#codes) as described previously
* after inputting the correct temporary code (or it being extracted automatically from the magic link), [the server again returns a Temporary Identity Proof: session or token](#temporary-identity-proofs-sessions-and-tokens)
* our identity is proven - two independent proofs (factors) were required

There are many various second factor methods available. Some of the most popular ones include:
* **Email codes** - short-lived codes sent to our email; as safe as the access to our email account is
* **SMS codes** - short-lived codes sent to our phone number; as safe as the access to our mobile device and phone number are. Additionally, [SIM swap attacks are possible](https://en.wikipedia.org/wiki/SIM_swap_scam), although they are rather rare and hard to pull off
* **[TOTP (Time-based One-Time Password)](https://en.wikipedia.org/wiki/Time-based_one-time_password) authenticator apps** - short-lived codes generated offline, based on the current time and a shared secret (between client and server) - mostly supported and installed on mobile devices. Examples: Google Authenticator, Microsoft Authenticator, Aegis Authenticator
* **Push-based authentication apps** - just a prompt approved physically on the device, mobile phone usually. Examples: Microsoft Authenticator, Google Prompt, Duo Push
* **Hardware security keys** - arguably the most secure option but also the least user friendly. We must have an additional device which controls [cryptographic keys](/centralized-vs-decentralized-identity-tradeoffs.html#decentralized) that are generated and stored only on the device (offline). They work with protocols like [U2F](https://en.wikipedia.org/wiki/Universal_2nd_Factor) and [FIDO2](https://en.wikipedia.org/wiki/FIDO_Alliance); [WebAuthentication (WebAuthn)](https://en.wikipedia.org/wiki/WebAuthn) standard is involved as well. Popular options include YubiKey, Google Titan Key or Feitian
* **Biometric device-based factors** - verification based on some biological fact unique about us, such as face/iris scan, voice recognition or fingerprint. The process takes place on a device (commonly just our personal computer/mobile phone) and if successful, it unlocks a certain cryptographic secret; it then works like hardware security keys - including protocols and standards. Examples: Apple's Face ID, Windows Hello, Android Passkeys

\
With two or more authentication factors we have increased security, but a new problem arises:
> What if control over the second factor is lost? Without it, access to the identity is not possible - how to restore it?

**In Single-Factor Authentication (SFA) this problem does not exist - there is only one factor that represents control over identity and in most cases *passwords* are used**; *I forgot my password* procedure allows to reset them through a special link, sent by email. With Two-Factor Authentication (2FA), if the second factor is lost, most platforms support the following recovery methods:
* **Backup/recovery codes** -  list of one-time codes that might be applied instead of regularly used (and now lost) second factor. They should be stored in a safe spot and utilized only once
* **Backup authentication factors** - many systems allow adding more than one second factor method; when the first is lost, we can simply use another one
* **Trusted contacts & devices** - we might choose a set of trusted contacts who will receive recovery codes in case of problems with our own access; additionally, often *Trust this device* feature is supported, allowing us to skip second factor verification on devices we regularly use
* **Manual process** - custom and platform-specific processes that may include uploading documents, questions, proofs of knowledge and/or account history verification to confirm that we genuinely are who we claim to be

As we can see, there is much more complexity involved in supporting two (multi) factor authentication as compared to just a single one. There also is an additional learning curve for users, but the security benefits are in most cases more than worth it.

In conclusion, **Multi-Factor Authentication (MFA) requires providing multiple proofs of our identity (most commonly two), but in the end it works as the simplest, single factor process does: we go through the multi-step authentication process and get a session or token (temporary identity proof) linked to the proven identity in exchange**. It once again shows the benefits of separating the process from issuing a proof of its success - it is extremely flexible, details of this procedure may be changed at any time, but temporary identity proofs - sessions and tokens - remain the same.

## Keys

This is a slightly different approach, used mainly for machine-to-machine (M2M) authentication. Primarily, it can be found in:
* SSH protocol
* Mutual TLS (mTLS)

**In the SSH protocol, we exchange data between two machines - client and server.** Both of them use [public key cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography) to generate two mathematically related keys: public and private. A public key serves as identity here; control over related private key proofs it. If a private key gets stolen, the identity associated with its public key is lost as well. The server accepts connections only from clients identified by a preconfigured list of public keys, generally described in the `.ssh/authorized_keys` file. Then, after agreeing on the details like supported protocol versions and cryptographic algorithms, both server and client authenticate each other:
* there is some piece of data, related to the current SSH session
* server signs it using its private key
* client verifies server's signature by decrypting it, using server's public key - if it has expected value, server is authentic
* client also signs some piece of data, related to the current SSH session, using its private key
* server verifies client's signature by decrypting it, using client's public key - if it has expected value, client is authentic

If the exchange is successful, both client and server know they are talking with a genuine party. **Being connected, they generate a random, shared secret; used only by the current connection and its session. This *ephemeral secret* serves both as *Temporary Identity Proof* as well as symmetric key to encrypt and decrypt exchanged over the network data.**

**In Mutual TLS (mTLS), both client and server authenticate each other.** In classic TLS (used in HTTPS), only the server has a certificate that proves its identity by being related to a trustworthy public/private key pair - the certificate is commonly signed by a [certificate authority (CA)](https://en.wikipedia.org/wiki/Certificate_authority) or sometimes is [self-signed](https://en.wikipedia.org/wiki/Self-signed_certificate). For mutual authentication:
* client connects to the server
* server sends its certificate
* client verifies the certificate - format, data, signed by trusted CA (or self-signed) and so on 
* client sends its certificate
* server verifies the certificate

If the exchange is successful, both client and server know they are talking with a genuine party. Then, exactly as in the SSH protocol, a random, shared secret is generated and used only by the current connection and its session. This *ephemeral secret* likewise serves both as *Temporary Identity Proof* as well as symmetric key to encrypt and decrypt exchanged over the network data.

**In both cases, no passwords or other factors are involved - only [public/private key pairs](https://en.wikipedia.org/wiki/Public-key_cryptography) and a way to distribute and link them to identities.** Because of the latter, for more complex systems and use cases, [we might need to set up PKI - Public Key Infrastructure](https://en.wikipedia.org/wiki/Public_key_infrastructure). But for simpler ones, like a few machines exchanging data through SSH or mTLS between services running in an internal network, usually a script or scripts will do the job. After mutual server-client authentication, a random and shared *ephemeral secret* serves as *Temporary Identity Proof*, scoped to a single connection and its current session.

## API Tokens/Keys

Another approach mainly for machine-to-machine (M2M) authentication (and authorization, outside the scope of this post) - mostly used by various REST APIs to validate authenticity of the clients and their access rights. *Sometimes called API Tokens, sometimes API Keys; it is the same thing.*

Here, *Temporary Identity Proofs* are not involved. [We simply generate static API Token/Key](https://en.wikipedia.org/wiki/API_key) on the target platform - GitHub, DigitalOcean, OpenAI, Buttondown etc. It is a random, long string that is linked to our account and can be further identified by custom name or id and given a set of permissions to restrict what is allowed to do (authorization that is). Most often, it expires after a certain time for security reasons - 7 days, 30 days, 90 days and so on. It might be regenerated or revoked at any time, since it is centrally controlled through the platform we are integrating with. These tokens/keys are added to each HTTP (or other) request - usually as the `Authorization` header or sometimes a query parameter. Because they are static, included in each action/request and rather long-lived - making sure they are used in a secure context is crucial. If somebody steals this token/key, they can impersonate us and start using the given API at our cost.

## Delegated Authentication

Lastly, **service A may delegate authentication to service B, putting trust in its process**. The best example of this approach is *Sign In with X* feature: allowing signing in to a website/app using an existing account (identity) from Google, Apple, LinkedIn, Twitter/X, Facebook, GitHub, etc.

In this context, [OpenID Connect (OIDC) standard/protocol](https://en.wikipedia.org/wiki/OpenID#OpenID_Connect_(OIDC)) is often taken advantage of, but the principle is more universal:
* service A wants to use service B as [Identity Provider (IdP)](https://en.wikipedia.org/wiki/Identity_provider)
* user tries to sign in to service A - they choose to *Sign In with B* and are redirected to service B
* user signs in to service B or just approves the request  - if they already are signed in there
* user is redirected back to service A
* service A receives proven by service B user identity

Now, service A can either use tokens/sessions issued by service B or generate their own, based on the data received from service B. In either case, **after a successful and fully delegated authentication process, *Temporary Identity Proofs* as tokens or sessions are used again**.

## Closing thoughts

We went through pretty much all possible ways of resolving the authentication question: *who are you and can you prove it is true?* The question both humans and machines must repeatedly answer.

We saw that there are many different *authentication methods* based on which we might build every imaginable *authentication process* - from simple to complex, requiring single or multiple *authentication factors*.

[Excluding static API Tokens/Keys](#api-tokens-keys), a common pattern arises:
* there is an authentication process - of any complexity and numbers of steps (factors)
* we go through the process - [get a session, token](#temporary-identity-proofs-sessions-and-tokens) or [ephemeral secret](#keys) linked to the proven identity in exchange
* this session, token or ephemeral secret is a *Temporary Identity Proof*, a proof of proof

Which allows to decouple authentication process details and all its complexity from the result - failure or proven identity. Other benefits include improved performance, simplicity, more security and flexibility.

Let's then close by answering the authentication question - **we prove *who we are* by providing various factors: passwords, codes and keys; one, two and sometimes more even. In exchange, a session, token or ephemeral secret is created and sent; it serves as a more flexible and temporary proof of our identity, for every action/request we make**.

<div id="post-extras">

{{ .js: newsletterSignUpPostEnd() }}

### Notes and resources

1. [Various kinds of Identity](/centralized-vs-decentralized-identity-tradeoffs.html)
2. Basic Authentication - passwords in the HTTP protocol: https://en.wikipedia.org/wiki/Basic_access_authentication
3. Cryptographic hashes and why passwords ought to be stored as hashes produced by deliberately slow hash functions: https://en.wikipedia.org/wiki/Cryptographic_hash_function
4. Sessions in general: https://en.wikipedia.org/wiki/Session_(computer_science)
5. JSON Web Tokens (JWTs):
    1. https://en.wikipedia.org/wiki/JSON_Web_Token
    2. https://auth0.com/blog/demystifying-jose-jwt-family/
    3. https://www.jwt.io
6. Sessions and refresh tokens represent long-lived credentials; stealing them presents a major security risk, it is often very close to taking full control over the identity. That is why they must be stored in the most secure manner possible - it currently means *HttpOnly and Secure Cookie* (in the browser context). In this way, they are not accessible to any JavaScript code and transferred only when HTTPS is used: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies#block_access_to_your_cookies
7. JWTs were designed to be stateless and in many contexts they are - especially when it comes to short-lived access tokens. But to support revocation of long-lived refresh tokens as well as other increased security measures, for various stolen token cases, some form of state is unavoidable.
8. Public key cryptography, applied in virtually every authentication process:
    1. https://en.wikipedia.org/wiki/Public-key_cryptography
    2. https://en.wikipedia.org/wiki/Digital_signature
    3. https://www.youtube.com/watch?v=GSIDS_lvRv4
9. Multi-Factor Authentication (MFA), most often used with just two factors:
    1. https://en.wikipedia.org/wiki/Multi-factor_authentication
    2. https://en.wikipedia.org/wiki/Authentication#Authentication_factors
    3. https://en.wikipedia.org/wiki/One-time_password
    4. https://en.wikipedia.org/wiki/Time-based_one-time_password
    5. https://en.wikipedia.org/wiki/SIM_swap_scam
    6. https://en.wikipedia.org/wiki/Biometrics
    7. https://en.wikipedia.org/wiki/WebAuthn
10. Mutual authentication using cryptographic keys:
    1. https://en.wikipedia.org/wiki/Client_certificate
    2. https://en.wikipedia.org/wiki/Mutual_authentication
    3. https://www.cloudflare.com/learning/access-management/what-is-mutual-tls/
    4. https://en.wikipedia.org/wiki/Certificate_authority
    5. https://en.wikipedia.org/wiki/Public_key_infrastructure
11. API Key: https://en.wikipedia.org/wiki/API_key and the Authorization header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Authorization
12. Delegated Authentication concept:
    1. https://en.wikipedia.org/wiki/OpenID
    2. https://en.wikipedia.org/wiki/Identity_provider
    3. https://en.wikipedia.org/wiki/Single_sign-on


</div>