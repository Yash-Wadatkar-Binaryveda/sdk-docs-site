# Reading these pages

Every flow page in this section is built the same way: numbered steps, one
diagram per step, read top to bottom. This page defines the participants those
diagrams use. Each flow page lists the ones it needs at the top and links back
here.

## The participants

Twelve participants appear across the section, and no page uses all of them.

**Each one keeps its colour in every diagram it appears in**, and every arrow is
drawn in the colour of the participant it leaves from, so an arrow can be traced
back to whatever sent it.

| Participant | What it is |
|---|---|
| <span class="p-key p-guest"></span> **Guest** | The person holding the phone |
| <span class="p-key p-app"></span> **App** | The iOS or Android guest app |
| <span class="p-key p-cognito"></span> **Cognito** | AWS Cognito's guest user pool, which issues the access token everything else starts from |
| <span class="p-key p-backend"></span> **Binaryveda's backend** | The AppSync GraphQL API, with `user-service`, `booking-service`, `assistance-service` and `notification-service` behind it, plus the Socket.IO server in `subscription-service` that carries live events |
| <span class="p-key p-spintly"></span> **Spintly's servers** | Spintly's REST APIs. Only Binaryveda's backend calls these. The app never does |
| <span class="p-key p-kafka"></span> **Kafka** | Spintly's message bus. Spintly publishes unlocks and door modes to it, `notification-service` reads them, and the app never touches it |
| <span class="p-key p-oauth"></span> **OAuth SDK** | Spintly's `oauthManager`. Trades the Cognito token for a Spintly session token |
| <span class="p-key p-access"></span> **Access SDK** | Spintly's `serviceProvider`. Holds the credential and the door permissions, and performs unlocks |
| <span class="p-key p-hardware"></span> **Lock hardware** | The lock on the door, reached over BLE, or through Spintly for a remote unlock |
| <span class="p-key p-firebase"></span> **Firebase** | Firebase Cloud Messaging, which carries push notifications and issues the device token |
| <span class="p-key p-user"></span> **Staff member** | The hotel staff member who works a request, in the staff app |
| <span class="p-key p-admin"></span> **Front desk** | Whoever checks the guest in and out, or changes the site's settings, from the admin console |

The two SDKs, what each is for, and the order they run in are on the
[Overview](index.md).

## What an arrow label says

An arrow that carries a call, an SDK member or an event is labelled on **two
lines**: the exact name on top, and what it actually does underneath.

```
A->>B: getGuestDetails(cognitoId)
       The room, the doors and the stay dates
```

The top line is what to search the codebase for, and the bottom line explains it
for anyone who does not know the API. Arrows that are already plain English,
such as "Tap Unlock" or "The login screen", are left as one line.

!!! note "What an arrow into the backend carries"

    Arrows into Binaryveda's backend are labelled with the **GraphQL operation**
    the app calls. The guest app makes no REST calls.

## Platform tabs

Diagrams that differ between platforms are split into **iOS** and **Android**
tabs. The tabs are linked across the whole site, so picking a platform once
makes every diagram on every page follow it.

Where the two platforms behave differently in ways that do not need a diagram,
each page ends with a **Differences between the two** table.

## Words with specific meanings

**Service request** is the backend's name for anything the guest asks staff to
do. The app calls it a **request**. This section uses "request" on the flow pages
and "service request" where the call name or the database does.

**Access point** is Spintly's name for a door. The backend stores its Spintly ID
on the lock record and passes it to the app as `spintlyId`, which is what the
unlock calls take.

**Shared access** is a door the guest may open that is not their room, such as a
floor or block entrance. It arrives in `getGuestDetails` as `sharedAccess`, and
the app shows it as a card of its own.
