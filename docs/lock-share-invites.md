# 2. Lock Share Invites

**What it is.** Someone shares a lock with you. Push notification or deep link
carrying an invite ID → accept or decline → set a passcode on the lock → pick
any other access methods the inviter allowed.

**Not part of onboarding.** It happens to an already-logged-in user and can fire
at any time — days or months after they signed up, and as often as people share
locks with them. [User Onboarding](user-onboarding.md) runs once, up front; this
runs whenever an invite arrives.

!!! warning "Key point"

    The only flow that reaches **Spintly's backend** or writes to the **lock
    hardware**.

Three different systems do the work, in this order — the app, our backend, and
then the lock itself:

```mermaid
%%{init:{"flowchart":{"wrappingWidth":420,"nodeSpacing":24,"rankSpacing":30}}}%%
flowchart TD
    S(["Push notification or deep link<br/>carrying an invite ID"]) --> D{"Accept or<br/>decline?"}
    D -->|decline| X(["Invite dismissed — nothing else runs"])
    D -->|accept| A["<b>ProcessInvite</b><br/>Our own GraphQL mutation — the app never calls Spintly directly"]
    A --> B["<b>Our backend calls Spintly's REST APIs</b><br/>Four calls, in order — see below"]
    B --> C["<b>Set a passcode on the lock</b><br/>The Config SDK writes it over BLE"]
    C --> E["<b>Pick any other access methods</b><br/>Whichever ones the inviter allowed"]
    E --> F(["Lock ready to open"])

    classDef ours stroke:#3b82f6,stroke-width:2px
    classDef spintly stroke:#8b5cf6,stroke-width:2px
    classDef hw stroke:#f59e0b,stroke-width:2px
    classDef skip stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 3
    class A,E ours
    class B spintly
    class C hw
    class X skip
```

!!! info "Accessor"

    Spintly's word for a person who can open a door is an **accessor**. Three of
    Spintly's IDs matter here — `organisationId`, `accessorId` and
    `accessPointId`.

## What our backend calls at Spintly

`ProcessInvite` is **ours** — a GraphQL mutation the app fires when someone
accepts or declines an invite. The four calls below are **Spintly's**, made by
our backend, never by the app.

<p class="sdk-key">
  <span class="k-access">our own backend</span>
  <span class="k-oauth">Spintly's REST API</span>
  <span class="k-flow">start / result</span>
  <span class="k-fail">alternative path</span>
</p>

```mermaid
%%{init:{"flowchart":{"wrappingWidth":400,"nodeSpacing":26,"rankSpacing":30}}}%%
flowchart TD
    S(["The user accepted the invite"]) --> P
    P["<b>ProcessInvite</b><br/>Our GraphQL mutation — everything below happens inside it"]
    P --> N1["<b>1 · Get an OAuth token</b><br/>Our backend authenticates itself with a client id and secret — machine-to-machine, unrelated to the user's own login<br/><small>POST /identityManagement/v2/oauth/token</small>"]
    N1 --> D{"Already an<br/>accessor?"}
    D -->|no| N2["<b>2 · Create accessor</b><br/>Creates the person inside Spintly, carrying their Keycloak sub and the provider id<br/><small>POST /credentialManagementV3/v1/accessors</small>"]
    D -->|yes| N3["<b>3 · Add accessor to organisation</b><br/>Registers an existing accessor into the inviter's organisation instead of creating a duplicate<br/><small>POST /credentialManagementV3/v1/<br/>organisations/{orgId}/accessors/{accessorId}</small>"]
    N2 --> N4
    N3 --> N4["<b>4 · Update accessor permissions</b><br/>Grants what they can do at that lock — mobile, card, fingerprint, passcode, and admin rights if they're an owner<br/><small>PATCH /permissionManagementV3/v1/<br/>organisations/{orgId}/accessors/{accessorId}/permissions</small>"]
    N4 --> E(["Returns organisationId, accessorId and accessPointId"])

    classDef ours stroke:#3b82f6,stroke-width:2px
    classDef spintly stroke:#8b5cf6,stroke-width:2px
    classDef alt stroke:#ef4444,stroke-width:2px,stroke-dasharray:5 3
    class P ours
    class N1,N2,N4 spintly
    class N3 alt
```

!!! note "No token cache"

    Step 1 is re-fetched before **each** of the calls below it — there is no
    token cache anywhere in this flow.

Steps 2 and 3 are alternatives, not a sequence: a brand-new person is created,
an existing accessor is registered into the inviter's organisation. Either way
step 4 runs afterwards.

The three IDs that come back — `organisationId`, `accessorId` and
`accessPointId` — are Spintly's, and the app passes them straight into the
Config SDK below. Every other backend call in this flow stays inside our own
backend.

## Writing the passcode to the lock

One Config SDK member does the actual hardware write, and it is the same call
with the same arguments on both platforms. It needs a valid Spintly token first
— the OAuth exchange from
[User Onboarding](user-onboarding.md#3-after-login-trading-the-keycloak-token),
which both platforms re-run just before the write.

<p class="sdk-key">
  <span class="k-oauth">OAuth SDK</span>
  <span class="k-config">Config SDK</span>
  <span class="k-flow">app step</span>
</p>

=== "iOS"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":520,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["Invite accepted, passcode chosen"]) --> N0
        N0["<b>Re-run the OAuth exchange</b><br/>The Config SDK will not write without a valid Spintly token"]
        N0 --> N1["<b>1 · configurationProvider.addUserPasscode(serial, orgId, accessorId, passcode, completion)</b><br/>Write the passcode to the lock over BLE"]
        N1 --> E(["Passcode live on the lock"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkConfig stroke:#f59e0b,stroke-width:2px
        class N0 sdkOauth
        class N1 sdkConfig
    ```

=== "Android"

    ```mermaid
    %%{init:{"flowchart":{"wrappingWidth":520,"nodeSpacing":24,"rankSpacing":28}}}%%
    flowchart TD
        S(["Invite accepted, passcode chosen"]) --> N0
        N0["<b>Re-run the OAuth exchange</b><br/>The Config SDK will not write without a valid Spintly token"]
        N0 --> N1["<b>1 · configurationProvider.addUserPasscode(serial, orgId, accessorId, passcode, callback)</b><br/>Write the passcode to the lock over BLE"]
        N1 --> N2["<b>2 · SpintlyCompletionCallback&lt;Void&gt; → completed, failed</b><br/>How the Config SDK reports the result back — no iOS equivalent"]
        N2 --> E(["Passcode live on the lock"])

        classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
        classDef sdkConfig stroke:#f59e0b,stroke-width:2px
        class N0 sdkOauth
        class N1,N2 sdkConfig
    ```

The only difference between the platforms is the last argument and what comes
back through it: iOS takes a `completion` closure, Android takes a `callback`
and reports through `SpintlyCompletionCallback<Void>`.
