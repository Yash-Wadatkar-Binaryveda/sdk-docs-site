# Reading these pages

Every flow page on this site is built the same way: numbered steps, one diagram
per step, read top to bottom. This page defines the participants those diagrams
use, so no flow page has to repeat them.

Each page names the participants it uses at the top and links back here.

## The participants

Eleven participants appear across the site. No page uses all of them.

**Each one keeps its colour in every diagram it appears in**, and every arrow is
drawn in the colour of the participant it leaves from, so an arrow can be traced
back to whatever sent it.

| Participant | What it is |
|---|---|
| <span class="p-key p-user"></span> **User** | The person holding the phone. Named by role where the role matters, such as **Owner or primary** and **Invited user** in [User Management](user-management.md) |
| <span class="p-key p-app"></span> **App** | The iOS or Android app |
| <span class="p-key p-keycloak"></span> **Keycloak** | The identity provider behind the app's own sign in, which issues the token everything else starts from |
| <span class="p-key p-backend"></span> **Binaryveda's backend** | Binaryveda's GraphQL API, with `user-service`, `lock-service` and `notification-service` behind it, plus the socket that carries live events |
| <span class="p-key p-spintly"></span> **Spintly's servers** | Spintly's REST APIs. Only Binaryveda's backend calls these. The app never does |
| <span class="p-key p-oauth"></span> **OAuth SDK** | Spintly's `oauthManager`. Trades the Keycloak token for a Spintly session token |
| <span class="p-key p-access"></span> **Access SDK** | Spintly's `serviceProvider`. Holds the credential and the lock permissions, and performs unlocks |
| <span class="p-key p-config"></span> **Config SDK** | Spintly's `configurationProvider`. The only SDK that writes to hardware |
| <span class="p-key p-hardware"></span> **Lock hardware** | The lock, an accessory, or a gateway, reached over BLE |
| <span class="p-key p-firebase"></span> **Firebase** | Firebase Cloud Messaging, which carries push notifications and issues the device token |
| <span class="p-key p-filestore"></span> **File store** | Wherever an export or download link points. The app fetches from it directly, not through the backend |

A few pages add a participant of their own, such as the accessory in
[Lock Settings](lock-settings.md) or the assistant's app in
[Profile and Account](profile-and-account.md). Those are named where they are
used and get their own colour on that page.

The three SDKs, what each is for, and the order they run in are covered on the
[Overview](index.md).

!!! note "Where the Spintly request bodies are"

    The arrows into Spintly's servers carry the method and the path only.
    Request bodies, headers, and the differences between the four backend
    services behind those paths are in Binaryveda's Spintly API usage document
    rather than here.

## Platform tabs

Diagrams that differ between platforms are split into **iOS** and **Android**
tabs. The tabs are linked across the whole site, so picking a platform once
makes every diagram on every page follow it.

Where the two platforms behave differently in ways that do not need a diagram,
each page ends with a **Differences between the two** table.
