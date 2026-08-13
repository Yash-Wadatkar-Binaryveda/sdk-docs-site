# SDK &amp; Backend Calls

Every Spintly SDK member and backend endpoint the app touches — what calls it,
when it fires, and what it is for.

## What this reference is

The app depends on three separate Spintly SDKs, each shipped as a prebuilt
binary — an `.xcframework` on iOS, an `.aar` on Android. Because they are
closed binaries, the only reliable record of **what the app actually calls** is
the app's own source. This site is that record, written down once so the iOS
and Android sides can point at the same place instead of each keeping notes.

Read it to:

- see which SDK member runs at which moment in a flow, on iOS and on Android
- follow the order calls happen in, and what each one is for
- find where the two platforms diverge, and how
- tell which flows reach Spintly's servers and which never leave Keycloak

It is a **reference**, not a tutorial: it describes the integration as it
stands today rather than prescribing how to build a new one.

## The three SDKs

Three separate Spintly SDKs ship inside the app. They version independently and
share nothing with each other except one thing: the **session token** the OAuth
SDK produces. Everything on this site is tagged with which of the three it
belongs to.

### OAuth SDK — the gatekeeper

Exchanges the Keycloak token our own login issues for a Spintly **session
token**. Nothing else in the app can talk to Spintly until this succeeds, which
makes it the first SDK to do real work and the single point of failure for
everything downstream.

The exchange is a callback conversation, not one call: the app asks for a
session, the SDK asks the app how to authenticate, the app hands back a
token-exchange request, and the SDK returns the session.

### Access SDK — the credential

Holds the logged-in credential and the user's lock permissions. `logIn` seats
the Spintly token inside the SDK; `pollData` pulls down which doors the user is
allowed to open. It also calls back into the app when it needs a fresh token or
when the login state changes, so the app registers handlers for both at launch.

### Config SDK — the hardware

The only SDK that talks to the **lock hardware**, over BLE — passcodes, lock
onboarding, wifi, firmware. It needs the same session token the Access SDK gets,
handed to it through `setAuthToken`, before it can write anything.

Of everything it can do, this app uses one member:
[writing a user's passcode to a lock](lock-share-invites.md#writing-the-passcode-to-the-lock).

### Versions shipped

| Short name | iOS | Android |
|---|---|---|
| **OAuth** | `SpintlyOauth 1.2.1.0.xcframework` | `oauth-sdk-0.2.4.aar` (`com.mrinq.oauthsdk`) |
| **Access** | `SmartAccessFramework 0.11.0.0.xcframework` | `smartaccesssdk-1.10.0.1.aar` (`com.mrinq.smartaccesssdk`) |
| **Config** | `SpintlyConfigurationFramework 0.13.0.0.xcframework` | `configurationsdk-0.8.3.1.aar` (`com.spintly.configurationsdk`) |

## The order they run in

```mermaid
%%{init:{"flowchart":{"wrappingWidth":320,"rankSpacing":34}}}%%
flowchart TD
    K(["Keycloak token<br/>from our own login"]) --> O
    O["<b>OAuth SDK</b><br/>getOrCreateSession<br/><small>trades it for a Spintly session token</small>"]
    O -->|Spintly token| A["<b>Access SDK</b><br/>logIn, then pollData<br/><small>seats the credential, pulls lock permissions</small>"]
    O -->|Spintly token| C["<b>Config SDK</b><br/>setAuthToken<br/><small>authorises hardware writes</small>"]
    C --> L(["Write to the lock<br/>over BLE"])

    classDef sdkOauth stroke:#8b5cf6,stroke-width:2px
    classDef sdkAccess stroke:#3b82f6,stroke-width:2px
    classDef sdkConfig stroke:#f59e0b,stroke-width:2px
    class O sdkOauth
    class A sdkAccess
    class C sdkConfig
```

**OAuth** produces the token → handed to **Access** (`logIn`) and **Config**
(`setAuthToken`) → only then can Config write to a lock.

!!! note "Also at app launch"

    All three must be constructed and pointed at an environment at app launch,
    before any of the above can happen. That start-up work is
    [step 1 of User Onboarding](user-onboarding.md#1-app-launch).

## How to read these pages

Each flow page walks through the SDK work as a series of **moments in the app's
life** — app launch, login starts, after login, and so on — with one diagram
per moment.

<p class="sdk-key">
  <span class="k-oauth">OAuth SDK</span>
  <span class="k-access">Access SDK</span>
  <span class="k-config">Config SDK</span>
  <span class="k-flow">app / platform step</span>
  <span class="k-fail">failure path</span>
</p>

- **A box's outline colour** says which SDK the member belongs to, per the key
  above.
- **The number** is a reading order within that diagram, not a guarantee about
  thread scheduling.
- **A dashed edge or box** marks a conditional path — an optional step, a
  shortcut, or a failure.
- **iOS / Android tabs** are linked across the whole page — pick your platform
  once at the top and every diagram below follows.

!!! info "Accessor"

    Spintly's word for a person who can open a door is an **accessor**. Their
    IDs (`accessorId`, `organisationId`, `accessPointId`) show up throughout
    [Lock Share Invites](lock-share-invites.md).
