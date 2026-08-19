# Reading these pages

Every flow page on this site is built the same way: numbered steps, one diagram
per step, read top to bottom. This page defines the participants those diagrams
use and the shapes they are drawn with, so no flow page has to repeat them.

Each page names the participants it uses at the top and links back here.

## The participants

Eleven participants appear across the site. No page uses all of them.

| Participant | What it is |
|---|---|
| **User** | The person holding the phone. Named by role where the role matters, such as **Owner or primary** and **Invited user** in [User Management](user-management.md) |
| **App** | The iOS or Android app |
| **Keycloak** | The identity provider behind the app's own sign in, which issues the token everything else starts from |
| **Binaryveda's backend** | Binaryveda's GraphQL API, with `user-service`, `lock-service` and `notification-service` behind it, plus the socket that carries live events |
| **Spintly's servers** | Spintly's REST APIs. Only Binaryveda's backend calls these. The app never does |
| **OAuth SDK** | Spintly's `oauthManager`. Trades the Keycloak token for a Spintly session token |
| **Access SDK** | Spintly's `serviceProvider`. Holds the credential and the lock permissions, and performs unlocks |
| **Config SDK** | Spintly's `configurationProvider`. The only SDK that writes to hardware |
| **Lock hardware** | The lock, an accessory, or a gateway, reached over BLE |
| **Firebase** | Firebase Cloud Messaging, which carries push notifications and issues the device token |
| **File store** | Wherever an export or download link points. The app fetches from it directly, not through the backend |

The three SDKs, what each is for, and the order they run in are covered on the
[Overview](index.md).

## Diagram shapes

Every participant has a vertical line, and every arrow between two lines is one
call.

| What you see | What it means |
|---|---|
| **Solid arrow** | A call going out, from whoever it starts at to whoever it points at |
| **Dashed arrow** | The answer coming back. Also used when an SDK calls back into the app, or when Firebase or the socket delivers something on its own |
| **Arrow that loops back to its own line** | Work the app does by itself. Nothing leaves the app |
| **Two lines on an arrow** | The first line is the member, GraphQL field, or HTTP path being called. The second says what it does |
| **Grey banner across the whole diagram** | A heading, marking where one part of the flow ends and the next begins |
| **Box labelled `opt`** | Something that only sometimes happens. Its condition sits at the top of the box, and when that condition is false everything inside is skipped |
| **Box labelled `alt`** | A choice between two or more paths, split by dashed lines, each with its own condition above it. Exactly one of them happens |

## What the arrows carry

| Arrow points at | What is written on it |
|---|---|
| An SDK | The **member name** and its arguments |
| Binaryveda's backend | The **GraphQL field** and its arguments |
| Spintly's servers | The **HTTP method and path** that Binaryveda's backend uses |

Request bodies, headers, and the per-service differences behind the Spintly
paths are in Binaryveda's Spintly API usage document rather than here.

## Platform tabs

Diagrams that differ between platforms are split into **iOS** and **Android**
tabs. The tabs are linked across the whole site, so picking a platform once
makes every diagram on every page follow it.

Where the two platforms behave differently in ways that do not need a diagram,
each page ends with a **Differences between the two** table.
