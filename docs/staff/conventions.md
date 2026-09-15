# Reading these pages

Every flow page on this site is built the same way: numbered steps, one diagram
per step, read top to bottom. This page defines the participants those diagrams
use. Each flow page lists the ones it needs at the top and links back here.

## The participants

Twelve participants appear across the site, and no page uses all of them.

**Each one keeps its colour in every diagram it appears in**, and every arrow is
drawn in the colour of the participant it leaves from, so an arrow can be traced
back to whatever sent it.

| Participant | What it is |
|---|---|
| <span class="p-key p-user"></span> **Staff member** | The person holding the phone |
| <span class="p-key p-app"></span> **App** | The iOS or Android staff app |
| <span class="p-key p-cognito"></span> **Cognito** | AWS Cognito, which issues the access token everything else starts from |
| <span class="p-key p-backend"></span> **Binaryveda's backend** | The AppSync GraphQL API, with `user-service`, `assistance-service` and `notification-service` behind it, plus the Socket.IO server in `subscription-service` that carries live events |
| <span class="p-key p-spintly"></span> **Spintly's servers** | Spintly's REST APIs. Only Binaryveda's backend calls these. The app never does |
| <span class="p-key p-kafka"></span> **Kafka** | Spintly's message bus. Spintly publishes to it, `notification-service` reads from it, and the app never touches it |
| <span class="p-key p-oauth"></span> **OAuth SDK** | Spintly's `oauthManager`. Trades the Cognito token for a Spintly session token |
| <span class="p-key p-access"></span> **Access SDK** | Spintly's `serviceProvider`. Holds the credential and the door permissions, and performs unlocks |
| <span class="p-key p-hardware"></span> **Lock hardware** | The lock on the door, reached over BLE |
| <span class="p-key p-firebase"></span> **Firebase** | Firebase Cloud Messaging, which carries push notifications and issues the device token |
| <span class="p-key p-guest"></span> **Guest** | The hotel guest a task was raised for. They never use this app, but the backend tells them when work starts and finishes |
| <span class="p-key p-admin"></span> **Admin** | Whoever changes a staff member's role, shift or floors from the admin console |

The two SDKs, what each is for, and the order they run in are on the
[Overview](index.md).

## What an arrow label says

An arrow that carries a call, an SDK member or an event is labelled on **two
lines**: the exact name on top, and what it actually does underneath.

```
A->>B: getAccessibleRoomsByStaff(staffId)
       Every door this person may open
```

The top line is what to search the codebase for, and the bottom line explains it
for anyone who does not know the API. Arrows that are already plain English,
such as "Tap Unlock" or "The login screen", are left as one line.

!!! note "What an arrow into the backend carries"

    Arrows into Binaryveda's backend are labelled with the **GraphQL operation**
    the app calls.

!!! note "What a Kafka arrow carries"

    An arrow into or out of Kafka is labelled with the topic and the field that
    says what kind of message it is.

## Platform tabs

Diagrams that differ between platforms are split into **iOS** and **Android**
tabs. The tabs are linked across the whole site, so picking a platform once
makes every diagram on every page follow it.

Where the two platforms behave differently in ways that do not need a diagram,
each page ends with a **Differences between the two** table.

## Two words with specific meanings

**Service request** is the backend's name for a unit of work. The app calls the
same thing a **task** and shows it as a card. This site uses "task" on the flow
pages and "service request" where the call name or the database does.

**Access point** is Spintly's name for a door. The backend stores its Spintly ID
on the lock record and passes it to the app as `spintlyId`, which is what the
unlock call takes.
