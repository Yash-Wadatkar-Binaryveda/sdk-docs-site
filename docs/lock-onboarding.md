# 2. Lock Onboarding

**What it is.** Turning a factory fresh lock into a working one on the user's
account: choose a property → put the lock into configuration mode → scan for it
over BLE → name it → provision it → update the firmware if it is out of date →
set a master passcode → optionally add a fingerprint or an RFID card.

!!! warning "Key point"

    The **Config SDK** drives this flow from the scan onwards. The **Access
    SDK** is not used at all.

!!! info "Two of the eight steps below wait on Kafka, not on a REST response"

    **Step 1, Choose a property** and **step 4, Customise the lock** both end
    with the app waiting. What it is waiting for is not a slow Spintly call. It
    is a **Kafka message** coming back from Spintly, which is what creates the
    owner's accessor and sets the flags the app is polling for.

    | | What the app is waiting for | The message that provides it |
    |---|---|---|
    | Step 1, Choose a property | The property to become usable, so `addLock` will accept a lock on it | `resource_alive` for the organisation, then `site_create` |
    | Step 4, Customise the lock | `accessorId` on iOS, the status `ACCESS_POINT_CREATED` on Android | `access_point_create` |

    Those messages are named on the arrows in both diagrams. Their full shape,
    and everything else each one sets off, is in Binaryveda's Kafka events
    document rather than here.

    The other six steps are the app talking to the Config SDK and the lock over
    BLE, and no Kafka message is involved in any of them.

## Participants

This page uses User, App, Config SDK, Lock hardware, Binaryveda's backend,
Spintly's servers, and Kafka.

Each one is defined, with the colour it keeps across the site, in
[Reading these pages](conventions.md).

## The whole flow

Eight steps, one screen each. Each one has its own section below.

```mermaid
sequenceDiagram
    actor U as User
    participant A as App
    participant C as Config SDK
    participant L as Lock hardware
    participant B as Binaryveda's backend
    participant S as Spintly's servers
    participant K as Kafka

    Note over U,K: 1. Choose a property
    U->>A: Add a new lock, name the property
    A->>B: createSite(name:)
    B->>S: POST /organisations, or POST /organisations/{orgId}/sites
    S-->>K: resource_alive, then site_create
    K-->>B: The owner's accessor is created, the property is marked synced

    Note over U,K: 2. Put the lock into configuration mode
    U->>L: Long press on the lock

    Note over U,K: 3. Scan for the lock
    A->>C: Start the BLE scan
    C->>L: Look for locks nearby
    L-->>C: Serial number
    C-->>A: The locks it found
    A->>B: listLockData(lockSerialNumberList:)

    Note over U,K: 4. Customise the lock
    U->>A: Name, area and image
    A->>B: addLock(createLockInput:)
    B->>S: POST /accessPoints
    S-->>K: access_point_create
    K-->>B: Status ACCESS_POINT_CREATED, then the owner's permissions
    A->>B: getLock(lockId:), until that has happened

    Note over U,K: 5. Provisioning
    A->>C: Configure the lock
    C->>L: Provision it over BLE
    A->>B: updateLockConfigurationStatus(lockId:lockConfigurationStatus:)

    Note over U,K: 6. Firmware, only if the lock is behind
    A->>C: Read the installed version
    C->>L: Read it off the lock
    A->>B: getLockFirmwareUpdate(lockId:platform:)
    A->>C: Push the new firmware
    C->>L: Update it over BLE

    Note over U,K: 7. Master passcode
    U->>A: Choose a passcode
    A->>C: Replace the factory passcode
    C->>L: Write it over BLE
    A->>B: finalisePasscode(passcode:lockId:accessorId:)

    Note over U,K: 8. Fingerprint and RFID, both optional
    U->>A: Add a fingerprint or a card
    A->>C: Enrol it
    C->>L: Enrol it over BLE

    Note over U,K: The lock is ready to open
```

## 1. Choose a property

A lock has to live somewhere, so the first screen asks which property it belongs
to. A new user has none yet and creates one here.

```mermaid
sequenceDiagram
    actor U as User
    participant A as App
    participant B as Binaryveda's backend
    participant S as Spintly's servers
    participant K as Kafka

    Note over U,K: In the app
    U->>A: Add a new lock
    A->>B: listSites(limit:page:)<br/>Fetch the property list
    B-->>A: Empty, this is the first lock on the account
    U->>A: Name the property
    A->>B: createSite(name:)<br/>Create the property

    Note over U,K: On Binaryveda's backend, out of the app's sight
    alt If this is the first lock on the account
        B->>S: POST /infrastructureManagement/internal/v1/organisations<br/>Create the organisation
        Note right of S: One call creates all three:<br/>the organisation, the property inside it,<br/>and that property's network
        S-->>B: organisationId, siteId, networkId
        Note over B: The property is stored, but synced is false<br/>and the owner has no accessor yet
    else If the account already has an organisation
        B->>S: POST /infrastructureManagement/internal/v1/<br/>organisations/{orgId}/sites<br/>Create the property inside the existing organisation
        Note right of S: Creates that property's network too
        S-->>B: siteId, networkId
        B->>S: POST /credentialManagementV3/v1/accessors<br/>Create the accessor now, if the owner has none
    end
    B-->>A: Done
    A-->>U: Property created. Next, put the lock into configuration mode

    Note over U,K: Later, when Spintly has finished setting the property up
    S-->>K: msgType resource_alive<br/>data { resourceId, resourceName: "organisations" }
    K-->>B: Delivered to notification-service
    opt Only on the first branch, where the owner still has no accessor
        B->>S: POST /credentialManagementV3/v1/accessors<br/>Create the owner's accessor, up to three attempts
        S-->>B: accessorId
    end
    Note over B: organisations.synced becomes true
    S-->>K: msgType site_create, data { siteId }
    K-->>B: sites.synced becomes true
```

The app sends the same `createSite` whichever branch runs, and gets the same
answer back either way, so it never finds out which one it was. Choosing between
them is Binaryveda's backend's job.

!!! warning "The accessor is created in a different place on each branch"

    On the **first** property, the organisation does not exist inside Spintly
    yet when the REST call returns, so the accessor cannot be created there.
    It is created later, when the `resource_alive` message arrives.

    On **every property after that** the organisation is already live, so the
    accessor is created inline, in the same request.

    The difference matters because `addLock` in step 4 refuses a property whose
    `synced` flag is still false, answering *"The site has not synced yet"*.
    On the first property that flag is set by a Kafka message, so the user can
    reach the next screen before the backend will accept a lock on it.

No SDK is used in this step. The two operations live in `ListProperties.graphql`
and `CreateProperty.graphql`.

## 2. Put the lock into configuration mode

The app does nothing on this screen. A factory fresh lock stays silent over BLE
until someone puts it into configuration mode by hand: remove the back panel,
hold the button marked **R** for 3 seconds, and wait for the sound cue. Only
then will it answer a scan.

So this step is instructions and a **Scan** button. No SDK, no Binaryveda's
backend, no Spintly.

## 3. Scan for the lock

The app asks the Config SDK to scan, and the SDK reports back any locks
advertising nearby. Each result carries a serial number, which the app sends to
Binaryveda's backend to find out which model it is.

Gateways advertise on the same channel, so both platforms have to keep them out
of the list. They go about it differently.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        U->>A: Start the scan
        A->>C: configurableDeviceStopScan()<br/>Clear a scan left running from an earlier attempt
        A->>C: configurableDeviceStartScan(_:)<br/>Start looking for locks nearby
        C->>L: BLE scan, 40 second timeout
        L-->>C: Serial number and name
        C-->>A: ConfigurableDeviceListener → onDeviceListUpdated<br/>Hands back the devices found so far
        A->>A: Drop anything named Spintly_Gateway
        A->>B: listLockData(lockSerialNumberList:)<br/>Look the serial numbers up in the catalogue
        B-->>A: The model and display details for each one
        alt If at least one lock came back
            A-->>U: The list of locks. Pick one
        else If the list is empty
            A-->>U: Nothing nearby, scan again
        end
    ```

    **iOS filters gateways out by name**, before the catalogue lookup, because
    they advertise on the same channel as locks.

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        U->>A: Start the scan
        A->>C: configurableDeviceStartScan(ConfigurableDeviceListener)<br/>Start looking for locks nearby
        C->>L: BLE scan, 60 second timeout
        L-->>C: Serial number and name
        C-->>A: ConfigurableDeviceListener → onDeviceListUpdated<br/>Hands back the devices found so far
        A->>B: listLockData(lockSerialNumberList:)<br/>Look the serial numbers up in the catalogue
        B-->>A: Only known models come back, so gateways drop out here
        alt If at least one lock came back
            A-->>U: The list of locks. Pick one
        else If the list is empty
            A-->>U: Nothing nearby, scan again
        end
        A->>C: configurableDeviceStopScan()<br/>Stop the scan, once the app is finished with it
    ```

    **Android needs no gateway filter.** Gateways have no row in the catalogue,
    so they fall out of the `listLockData` lookup on their own.

## 4. Customise the lock

The user names the lock and picks where in the house it sits. `addLock` then
tells Binaryveda's backend to build it on Spintly's side.

Three things have to exist at Spintly for that: the **access point**, which is
the lock, the **accessor**, which is the owner, and the owner's **permissions**
on the lock.

Only the first is created by `addLock`. Spintly then publishes an
`access_point_create` message, and the second and third are done by
`notification-service` when that message arrives. So the work is split across a
Kafka round trip, `addLock` comes back before any of it has finished, and the
app polls until it has.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant B as Binaryveda's backend
        participant S as Spintly's servers
        participant K as Kafka

        Note over U,K: Fill in the lock's details
        U->>A: Pick the lock from the list
        A->>B: listAreaOfHouse<br/>Fetch the areas of the house
        U->>A: Name it, pick an area, choose an image
        opt If the user picked a custom image
            A->>B: getUploadPresignedUrl(fileType:)<br/>Ask for a presigned upload URL
            A->>A: PUT the image to that URL<br/>Straight to S3, not through Binaryveda's backend
        end

        Note over U,K: Create it, then wait for it to exist at Spintly
        A->>B: addLock(createLockInput:)<br/>Create the lock on Binaryveda's side and on Spintly's
        B->>S: POST /infrastructureManagement/internal/v2/<br/>networks/{networkId}/accessPoints<br/>Create the access point, which is the lock
        Note right of S: The serial number from the scan lands here
        B-->>A: Accepted, before any of the work below has run
        par Spintly tells Binaryveda the access point is there
            S-->>K: msgType access_point_create<br/>data { accessPointId }
            K-->>B: Delivered to notification-service
            Note over B: Status becomes ACCESS_POINT_CREATED
            alt If the owner has no accessor yet
                B->>S: POST /credentialManagementV3/v1/accessors<br/>Create the accessor, which is the owner
                Note right of S: Carries the owner Keycloak sub, the provider id,<br/>and this access point
            else If the owner already has one
                B->>S: PATCH /permissionManagementV3/v1/organisations/{orgId}/<br/>accessors/{accessorId}/permissions<br/>Give the owner access to the new lock
                Note right of S: Mobile, card, fingerprint, passcode and admin are on.<br/>Face and dual auth are off
            end
        and Meanwhile the app keeps asking whether it is ready
            loop Every 2 seconds, until all three ids arrive
                A->>B: getLock(lockId:)
                B-->>A: The ids so far
            end
        end
        A-->>U: All ids are in. Next, provisioning
    ```

    **iOS waits for all three ids** before it moves on: `organisationId`,
    `accessorId` and `accessPointId`.

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant B as Binaryveda's backend
        participant S as Spintly's servers
        participant K as Kafka

        Note over U,K: Fill in the lock's details
        U->>A: Pick the lock from the list
        A->>B: listAreaOfHouse<br/>Fetch the areas of the house
        U->>A: Name it, pick an area, choose an image
        opt If the user picked a custom image
            A->>B: getUploadPresignedUrl(fileType:)<br/>Ask for a presigned upload URL
            A->>A: PUT the image to that URL<br/>Straight to S3, not through Binaryveda's backend
        end

        Note over U,K: Create it, then wait for it to exist at Spintly
        A->>B: addLock(createLockInput:)<br/>Create the lock on Binaryveda's side and on Spintly's
        B->>S: POST /infrastructureManagement/internal/v2/<br/>networks/{networkId}/accessPoints<br/>Create the access point, which is the lock
        Note right of S: The serial number from the scan lands here
        B-->>A: Accepted, before any of the work below has run
        par Spintly tells Binaryveda the access point is there
            S-->>K: msgType access_point_create<br/>data { accessPointId }
            K-->>B: Delivered to notification-service
            Note over B: This message is what writes<br/>ACCESS_POINT_CREATED
            alt If the owner has no accessor yet
                B->>S: POST /credentialManagementV3/v1/accessors<br/>Create the accessor, which is the owner
                Note right of S: Carries the owner Keycloak sub, the provider id,<br/>and this access point
            else If the owner already has one
                B->>S: PATCH /permissionManagementV3/v1/organisations/{orgId}/<br/>accessors/{accessorId}/permissions<br/>Give the owner access to the new lock
                Note right of S: Mobile, card, fingerprint, passcode and admin are on.<br/>Face and dual auth are off
            end
        and Meanwhile the app keeps asking whether it is ready
            loop Every 5 seconds, until the status is right
                A->>B: getLock(lockId:)
                B-->>A: The status so far
            end
        end
        A-->>U: Status reached ACCESS_POINT_CREATED. Next, provisioning
    ```

    **Android waits on a status rather than on ids.** It walks
    `ACCESS_POINT_CREATE_PENDING` → `ACCESS_POINT_CREATED` → `MESH_CONFIGURED`,
    and the app moves on at `ACCESS_POINT_CREATED`.

The two platforms wait differently, but the same three ids come out either way:
`organisationId`, `accessorId` and `accessPointId`. Every Config SDK call from
provisioning onwards needs them.

!!! warning "The accessor call and the permission call are alternatives"

    Only one of the two runs. A user onboarding their **first** lock has no
    accessor, so one is created, and it carries the access point with it, which
    grants the permission at the same time. A user adding a **second** lock
    already has an accessor, so only the permission call runs.

    Neither is made by the service that handled `addLock`. Both are made by
    `notification-service`, off the Kafka message.

**What the app is polling for is written by the Kafka consumer.** Android's
`ACCESS_POINT_CREATED` and the `accessorId` iOS waits for are both set when the
`access_point_create` message is handled, not when the access point REST call
returns. If the message never arrives, the poll never finishes, and neither
platform will show an error: they will simply keep asking.

**Screens reached later look the three ids up again** with
`spintlyDetails(lockSerialNumber:)`, which returns exactly those and nothing
else. It is how [My Access](lock-settings.md#2-my-access), a user's detail
screen in [User Management](user-management.md), and an invited user setting up
their own access all get what a Config SDK call needs, without carrying the ids
across from here.

Whichever of the two runs, it has to run after the access point exists, because
it names the access point. That ordering is what the Kafka message provides:
Spintly does not publish `access_point_create` until the access point is there.

!!! note "Resuming an interrupted onboarding"

    A lock left half onboarded is picked up again with a different query,
    `resumeOnboarding`, polled every 2 seconds until Spintly confirms the three
    ids and reports the site, access point and organisation as synced. Android
    gives up after 15 tries and iOS keeps going. iOS only takes this path in
    non-production builds and stays on `getLock` everywhere else.

    **`resumeOnboarding` is a state machine over those same synced flags**, and
    every one of them is set by a Kafka message. Each step refuses to run until
    the flag the previous step waits on has arrived: the property is only
    created once the organisation is synced, the access point only once the
    property is synced, and the accessor or permission only once the access
    point is synced. Repeating the query is how it walks forward as each message
    lands.

    The diagrams above are the normal path, for a lock being added for the first
    time.

## 5. Provisioning

The lock now exists on Spintly's side and the app has its ids. Provisioning
writes that same setup onto the lock itself, over BLE.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        A-->>U: Provisioning screen, please wait
        A->>C: startDeviceMeshConfiguration(_:)<br/>Write the lock's setup onto the lock
        C->>L: Provision the lock over BLE
        L-->>C: Configured
        C-->>A: completion<br/>Done, or failed with an error
        A->>B: updateLockConfigurationStatus(lockId:lockConfigurationStatus:)<br/>Record that the lock is provisioned, status MESH_CONFIGURED
        A-->>U: Provisioned. Next, the firmware check
    ```

    **iOS never calls `meshConfigurationClose()`** and waits no settle time
    afterwards.

    **If the lock turns out to be configured already**, the SDK error is shown
    to the user.

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        A-->>U: Provisioning screen, please wait
        A->>C: startDeviceMeshConfiguration(serial, callback)<br/>Write the lock's setup onto the lock
        C->>L: Provision the lock over BLE
        L-->>C: Configured
        C-->>A: SpintlyCompletionCallback → completed or failed<br/>How the SDK reports the result
        A->>C: meshConfigurationClose()<br/>Close the session, whether it worked or not
        A->>A: Wait 5 seconds for the lock to settle
        A->>B: updateLockConfigurationStatus(lockId:lockConfigurationStatus:)<br/>Record that the lock is provisioned, status MESH_CONFIGURED
        A-->>U: Provisioned. Next, the firmware check
    ```

    **If the lock turns out to be configured already**, the SDK reports
    `domain 2` and `code 24`. Android ignores it and carries on.

## 6. Firmware

The app reads the version off the lock and compares it against the version
Binaryveda's backend says it should be running. The update screen has no skip
button, so cancelling there leaves the lock unfinished on Home.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        Note over U,B: Compare the two versions
        A->>C: getListOfFirmwareForSerialNumber(_:)<br/>Ask which firmware the lock is running
        C->>L: Read the installed firmware
        L-->>C: ProdSwVersionsWithBleDeviceInfo
        C-->>A: bleDeviceInfo.prodSwVersion<br/>The version number on the lock
        A->>B: getLockFirmwareUpdate(lockId:platform:)<br/>What should this lock be running?
        B-->>A: updateFirmware.nordicVersion<br/>The target version

        Note over U,B: Update only if they differ
        alt If the lock is out of date
            A-->>U: Firmware update screen, with no skip
            A->>C: firmwareUpdateToSelectedVersion(_:)<br/>Send the new firmware to the lock
            C->>L: Push the new firmware over BLE
            L-->>C: Updated
            A->>B: updateLockInformation(currentFirmwareVersion:id:)<br/>or updateLockFirmwareStatus(lockId:firmwareType:), see below
            A->>A: Re-enter the flow and read the version again
        else If it is already up to date
            A-->>U: Next, the master passcode
        end
    ```

    **iOS checks the firmware after the access point, the accessor and the
    permission are all in place**, because step 4 waits for all three ids.

    **The new version is recorded afterwards**, through
    `updateLockInformation(currentFirmwareVersion:id:)` when the lock has no
    pending actions, and `updateLockFirmwareStatus(lockId:firmwareType:)` when
    it does. Both stop at Binaryveda's backend.

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        Note over U,B: Compare the two versions
        A->>C: getListOfFirmwareForSerialNumber(...)<br/>Ask which firmware the lock is running
        C->>L: Read the installed firmware
        L-->>C: ProdSwVersionsWithBleDeviceInfo
        C-->>A: bleDeviceInfo.prodSwVersion<br/>The version number on the lock
        A->>B: getLockFirmwareUpdate(lockId:platform:)<br/>What should this lock be running?
        B-->>A: The target version

        Note over U,B: Update only if they differ
        alt If the lock is out of date
            A-->>U: Firmware update screen, with no skip
            A->>C: firmwareUpdateToSelectedVersion(...)<br/>Send the new firmware to the lock
            C->>L: Push the new firmware over BLE
            L-->>C: Updated
            A->>A: onboardLock(force = true) reads both versions again
        else If it is already up to date
            A-->>U: Next, the master passcode
        end
    ```

    **Android checks the firmware before that work has necessarily finished**,
    because step 4 moves on at `ACCESS_POINT_CREATED`, which is written before
    the accessor or permission call is made.

    **The new version is recorded too**, through the same two mutations as iOS,
    but from a different place. `LockOnboardingViewModel` only reads the two
    versions. `FirmwareUpdateViewModel`, the screen the flow hands off to, is
    what calls `updateLockFirmwareStatus` and `updateLockInformation` once the
    push finishes.

Nothing in this step reaches Spintly. The target version comes from Binaryveda's
backend, through `getLockFirmwareUpdate(lockId:platform:)`.

## 7. Master passcode

The lock ships with a factory passcode and this step replaces it. The Config SDK
writes the new one onto the lock, and Binaryveda's backend saves it afterwards.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        U->>A: Choose a new master passcode
        A->>C: updateMasterPasscode(serial, orgId, accessorId, old, new, completion)<br/>Replace the passcode held on the lock
        Note right of C: old is the factory passcode.<br/>orgId and accessorId are the ids Spintly returned<br/>when the lock was created
        C->>L: Write the master passcode over BLE
        L-->>C: Written
        C-->>A: completion<br/>Done, or failed with an error
        A->>B: finalisePasscode(passcode:lockId:accessorId:)<br/>Save the passcode on Binaryveda's backend
        A-->>U: Passcode set. Add a fingerprint or a card, or finish here
    ```

    **If the passcode is already in use**, the SDK returns code
    `1_899_102_215`. iOS treats that as a success, but only when the error
    message also contains `duplicate key value violates unique constraint`.
    The same code with any other message is shown to the user.

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Binaryveda's backend

        U->>A: Choose a new master passcode
        A->>C: generateMasterPasscode(serial, orgId, accessorId, old, new, callback)<br/>Replace the passcode held on the lock
        Note right of C: Same arguments as iOS, different member.<br/>old is the factory passcode
        C->>L: Write the master passcode over BLE
        L-->>C: Written
        C-->>A: SpintlyCompletionCallback → completed or failed<br/>How the SDK reports the result
        A->>B: finalisePasscode(passcode, lockId, accessorId)<br/>Save the passcode on Binaryveda's backend
        A-->>U: Passcode set. Add a fingerprint or a card, or finish here
    ```

    **If the passcode is already in use**, Android shows the SDK error to the
    user.

## 8. Fingerprint and RFID

Both are optional and both can be added later from the lock's settings instead.

### Fingerprint

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware

        U->>A: Add a fingerprint
        A->>C: fingerprintClose()<br/>Close any fingerprint session left open
        A->>C: scanAndConnectFingerprintDevice(orgId, accessPointId, 1)<br/>Connect to the lock's fingerprint reader
        C->>L: Open a BLE connection
        A->>C: performFPEnrollmentOnDevice(orgId, accessPointId, 1, accessorId, name, 60, delegate)<br/>Record the finger, 60 second timeout
        loop Once for each press of the finger
            U->>L: Press a finger on the reader
            L-->>C: Scan captured
            C-->>A: EnrollmentPromptStatus<br/>Progress after each press
            A-->>U: Press again, or lift and press again
        end
        C-->>A: Enrolment complete
        A->>C: fingerprintClose()<br/>Close the session
        A-->>U: The lock is ready
    ```

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware

        U->>A: Add a fingerprint
        A->>C: scanAndConnectFingerprintDevice(orgId, accessPointId, 1)<br/>Connect to the lock's fingerprint reader
        C->>L: Open a BLE connection
        A->>C: performFPEnrollmentOnDevice(orgId, accessPointId, 1, accessorId, templateName, 60, FPEnrollCallback)<br/>Record the finger, 60 second timeout
        loop Once for each press of the finger
            U->>L: Press a finger on the reader
            L-->>C: Scan captured
            C-->>A: FPEnrollCallback → onPrompt<br/>Progress after each press
            A-->>U: Press again, or lift and press again
        end
        C-->>A: FPEnrollCallback → onComplete or onFailure<br/>How the SDK reports the result
        A->>C: fingerprintClose()<br/>Close the session, whether it worked or not
        A-->>U: The lock is ready
    ```

### RFID

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware

        U->>A: Add a card
        A->>C: nfcEnrollmentStopScan()<br/>Clear an NFC scan left running
        A->>C: scanAndConnectCardDevice(orgId, accessPointId, 1)<br/>Connect to the lock's card reader
        C->>L: Open a BLE connection
        C-->>A: NFCProcessState CONNECTED<br/>The reader is ready
        A->>C: assignCardToAccessorWithPermissionOnDevice(true, orgId, accessorId, 1, 1, true, delegate)<br/>Record the card and give it access
        Note right of C: accessorId is the current user's,<br/>falling back to the lock's
        A-->>U: Hold the card against the reader
        U->>L: Card presented
        C-->>A: NFCProcessState CARD_PLACED<br/>The card has been read
        C-->>A: AssignAndEnrollListener → onAssignedSuccess or onFailure<br/>How the SDK reports the result
        A->>C: nfcEnrollmentClose()<br/>Close the session, whether it worked or not
        A-->>U: The lock is ready
    ```

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware

        U->>A: Add a card
        A->>C: scanAndConnectCardDevice(orgId, accessPointId, 1)<br/>Connect to the lock's card reader
        C->>L: Open a BLE connection
        C-->>A: RFIDPromptStatus.CONNECTED<br/>The reader is ready
        A->>C: nfcEnrollmentStopScan()<br/>Stop scanning, after connecting rather than before
        A->>C: assignCardToAccessorWithPermissionOnDevice(...)<br/>Record the card and give it access
        Note right of C: accessorId is always the lock's
        A-->>U: Hold the card against the reader
        U->>L: Card presented
        C-->>A: RFIDPromptStatus.CARD_PLACED<br/>The card has been read
        C-->>A: Enrolled
        A->>C: nfcEnrollmentClose()<br/>Close the session
        A-->>U: The lock is ready
    ```

### Where each access method ends up

| Access method | On the lock | Saved on Binaryveda's backend |
|---|---|---|
| Master passcode | Yes | Yes, through `finalisePasscode` |
| Fingerprint | Yes | No |
| RFID card | Yes | No |

A fingerprint or a card added during setup exists only on the lock itself.
Binaryveda's backend is never told about it. There is no mutation for
fingerprints at all, and the one that exists for cards, `assignRfid`, is never
sent: the iOS call site is commented out, and Android's `AssignRfidUseCase` has
no caller.

## Differences between the two

| | iOS | Android |
|---|---|---|
| Config SDK environment | Set once at app launch | Re-applied before every call |
| BLE scan timeout | 40 seconds | 60 seconds |
| Keeping gateways out | Filters on `ConfigurableDevice.name == "Spintly_Gateway"` | No filter. Gateways have no catalogue row and drop out of the lookup |
| Waiting for the Spintly ids | `getLock` every 2 seconds, waits for all ids | `getLock` every 5 seconds, waits for `ACCESS_POINT_CREATED` |
| When the firmware is checked | After the Spintly calls have finished | Before they have |
| Firmware retry after an update | Re-enters the flow and reads both versions again | `onboardLock(force = true)` reads both versions again |
| `meshConfigurationClose()` | Not called | Called on success and on failure |
| Settle delay after configuring | None | 5 seconds |
| A lock that is already configured | The SDK error is shown | `domain 2` and `code 24` ignored |
| **Master passcode SDK member** | **`updateMasterPasscode`** | **`generateMasterPasscode`** |
| Duplicate passcode SDK error | Treated as success, but only when the message also mentions a duplicate key | Shown to the user |
| `nfcEnrollmentStopScan` position | Before connecting to the reader | After connecting |
| RFID `accessorId` argument | The current user's, falling back to the lock's | Always the lock's |

## Every SDK member this flow uses

Apart from the first row of each table, every call below is the Config SDK, on
`configurationProvider`. iOS reaches them through `SpintlyHelper` and
`DefaultSpintlyViewModel`, Android through `SpintlySDKManager`.

??? note "iOS"

    | SDK | Member | When | What it is for |
    |---|---|---|---|
    | OAuth | `SpintlyHelper.login` → `setConfigSDKToken(token:)` | Before every call below | A fresh Spintly token per call, with no cache |
    | Config | `configurableDeviceStopScan()` | Before scanning | Clear a scan left running |
    | Config | `configurableDeviceStartScan(_:)` | Scan | Start the BLE scan, 40 second timeout |
    | Config | `ConfigurableDeviceListener` → `onDeviceListUpdated`, `onFailure` | Scan | How discovered devices arrive |
    | Config | `ConfigurableDevice.serialNumber`, `.name` | Scan | Serial for the catalogue lookup, `name` filters out `Spintly_Gateway` |
    | Config | `getListOfFirmwareForSerialNumber(_:)` | Firmware check | Read installed firmware off the lock |
    | Config | `ProdSwVersionsWithBleDeviceInfo.bleDeviceInfo.prodSwVersion` | Firmware check | The installed version number |
    | Config | `firmwareUpdateToSelectedVersion(_:)` | Firmware update | Push the new firmware |
    | Config | `startDeviceMeshConfiguration(_:)` | Provisioning | Provision the lock over BLE |
    | Config | `updateMasterPasscode(serial, orgId, accessorId, old, new, completion)` | Master passcode | Write the master passcode to the lock |
    | Config | `fingerprintClose()` | Before and after fingerprint | Close any open fingerprint session |
    | Config | `scanAndConnectFingerprintDevice(orgId, accessPointId, 1)` | Fingerprint | Connect to the fingerprint reader |
    | Config | `performFPEnrollmentOnDevice(orgId, accessPointId, 1, accessorId, name, 60, delegate)` | Fingerprint | Enrol the finger, 60 second timeout |
    | Config | `EnrollmentPromptStatus` | Fingerprint | Progress on each scan |
    | Config | `nfcEnrollmentStopScan()` | Before RFID | Stop a stale NFC scan |
    | Config | `scanAndConnectCardDevice(orgId, accessPointId, 1)` | RFID | Connect to the card reader |
    | Config | `assignCardToAccessorWithPermissionOnDevice(true, orgId, accessorId, 1, 1, true, delegate)` | RFID | Enrol the card and assign it to the accessor |
    | Config | `AssignAndEnrollListener` → `onAssignedSuccess`, `onStatusUpdate`, `onFailure` | RFID | How card enrolment reports back |
    | Config | `nfcEnrollmentClose()` | After RFID | Close the NFC session, on success and on failure |
    | Config | `NFCProcessState` | RFID | `CONNECTED` and `CARD_PLACED` progress |

??? note "Android"

    | SDK | Member | When | What it is for |
    |---|---|---|---|
    | OAuth | `loginWithOauthAndConfigurationSDK()` → `setEnvironment` + `setAuthToken` | Before every call below | A fresh token and environment per call |
    | Config | `configurableDeviceStartScan(ConfigurableDeviceListener)` | Scan | Start the BLE scan, exposed as a `Flow`, 60 second timeout |
    | Config | `ConfigurableDeviceListener` → `onDeviceListUpdated`, `onFailure` | Scan | How discovered devices arrive |
    | Config | `configurableDeviceStopScan()` | Scan | Stop the scan when the flow closes |
    | Config | `getListOfFirmwareForSerialNumber(...)` | Firmware check | Read installed firmware off the lock |
    | Config | `ProdSwVersionsWithBleDeviceInfo.bleDeviceInfo.prodSwVersion` | Firmware check | The installed version number |
    | Config | `firmwareUpdateToSelectedVersion(...)` | Firmware update | Push the new firmware |
    | Config | `startDeviceMeshConfiguration(serial, SpintlyCompletionCallback<Void>)` | Provisioning | Provision the lock over BLE |
    | Config | `meshConfigurationClose()` | Provisioning | Close the mesh session, on success and on failure |
    | Config | `SpintlyCFServiceException.domain` / `.code` | Provisioning | `2 / 24` means already configured, ignored |
    | Config | `generateMasterPasscode(serial, orgId, accessorId, old, new, callback)` | Master passcode | Write the master passcode to the lock |
    | Config | `scanAndConnectFingerprintDevice(orgId, accessPointId, 1)` | Fingerprint | Connect to the fingerprint reader |
    | Config | `performFPEnrollmentOnDevice(orgId, accessPointId, 1, accessorId, templateName, 60, FPEnrollCallback)` | Fingerprint | Enrol the finger, 60 second timeout |
    | Config | `FPEnrollCallback` → `onComplete`, `onPrompt`, `onFailure` | Fingerprint | Result and progress on each scan |
    | Config | `fingerprintClose()` | After fingerprint | Close the session, on completion and on failure |
    | Config | `scanAndConnectCardDevice(orgId, accessPointId, 1)` | RFID | Connect to the card reader |
    | Config | `nfcEnrollmentStopScan()` | RFID | Stop scanning once connected |
    | Config | `assignCardToAccessorWithPermissionOnDevice(...)` | RFID | Enrol the card and assign it to the accessor |
    | Config | `nfcEnrollmentClose()` | After RFID | Close the NFC session |
    | Config | `NFCProcessState` → `RFIDPromptStatus.CONNECTED` / `CARD_PLACED` | RFID | Progress |
    | Config | `SpintlyCompletionCallback<T>` → `completed`, `failed` | All | How the Config SDK reports back |
