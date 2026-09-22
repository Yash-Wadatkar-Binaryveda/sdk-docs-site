# Reading these pages

Every flow page on this site is built the same way: numbered steps, one diagram
per step, read top to bottom. This page defines the participants those diagrams
use. Each flow page lists the ones it needs at the top and links back here.

## The participants

Nine participants appear across the web app pages, and no page uses all of them.

**Each one keeps its colour in every diagram it appears in**, and every arrow is
drawn in the colour of the participant it leaves from, so an arrow can be traced
back to whatever sent it.

| Participant | What it is |
|---|---|
| <span class="p-key p-user"></span> **Hotel staff** | Whoever is signed in at a single site: front desk, site admin, site manager, housekeeping manager, restaurant manager or engineering |
| <span class="p-key p-admin"></span> **Admin** | A hotel admin or super admin, used on pages where the tier matters |
| <span class="p-key p-app"></span> **Web app** | The browser app itself |
| <span class="p-key p-cognito"></span> **Cognito** | AWS Cognito, which holds the account and issues the tokens everything else starts from |
| <span class="p-key p-backend"></span> **Binaryveda's backend** | The AppSync GraphQL API, with `user-service`, `inventory-service`, `booking-service` and `assistance-service` behind it, plus the Socket.IO server in `subscription-service` and the Kafka consumer in `notification-service` |
| <span class="p-key p-spintly"></span> **Spintly's servers** | Spintly's REST APIs. Only Binaryveda's backend calls these. The web app never does |
| <span class="p-key p-kafka"></span> **Kafka** | Spintly's message bus. Spintly publishes to it, `notification-service` reads from it, and the web app never touches it |
| <span class="p-key p-guest"></span> **Guest** | The hotel guest. They are checked in from this app and then use the guest app |
| <span class="p-key p-filestore"></span> **File store** | Amazon S3, which holds photo IDs, room images, restaurant menus and generated reports |

Why there is no OAuth, Access or Config SDK participant is on the
[Overview](index.md#there-is-no-spintly-sdk-in-the-browser).

## What an arrow label says

An arrow that carries a call or an event is labelled on **two lines**: the exact
name on top, and what it actually does underneath.

```
A->>B: grantAccessPermissionGuest(roomBookingId, permissionList)
       Issue the card and the mobile key for this room
```

The top line is what to search the codebase for, and the bottom line explains it
for anyone who does not know the API. Arrows that are already plain English,
such as "Tap Check In" or "The sign in screen", are left as one line.

!!! note "What an arrow into the backend carries"

    Arrows into Binaryveda's backend are labelled with the **GraphQL operation**
    the app calls. Which service ends up handling it is in the table on the
    [Overview](index.md#the-services-behind-the-api).

!!! note "What an arrow into Spintly carries"

    Spintly is only ever reached from the backend, so an arrow into it starts at
    Binaryveda's backend and is labelled with the Spintly call, such as
    `createAccessor` or `updateAccessorPermissions`.

## There are no platform tabs

The staff and guest pages split diagrams into iOS and Android tabs. This app
runs in one place, so its pages have neither the tabs nor the **Differences
between the two** table that closes a mobile page.

## Site scope

Almost every call carries a **site**. When someone signs in, the app reads their
staff record and stores their hotel and site for the session, and that site is
sent with each query from then on.

A hotel admin or super admin has no site of their own. They pick one by opening
a site card, which puts the site in the address and scopes the rest of the app
to it. This is what makes a super admin able to read a site dashboard without
belonging to that site. See
[Administration, step 4](administration.md#4-opening-a-site).

## Four words with specific meanings

**Service request** is the backend's name for a unit of guest work. This app
shows it on a screen called **Requests**, and the staff app calls the same thing
a task. These pages use "request" on the flow pages and "service request" where
the call name or the database does.

**Room booking** is one room within a booking. A booking can hold several, each
with its own status, its own guests and its own room number. Most actions during
a stay act on a room booking rather than on the booking.

**Access point** is Spintly's name for a door. A lock record carries its Spintly
ID, and that is what the backend sends when it writes a permission.

**Accessor** is Spintly's name for someone who can open a door. Guests and staff
each get one, created by the backend.
