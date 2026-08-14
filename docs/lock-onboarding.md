# 3. Lock Onboarding

**What it is.** Turning a factory fresh lock into a working one on the user's
account: choose a property → put the lock into configuration mode → scan for it
over BLE → name it → provision it → update the firmware if it is out of date →
set a master passcode → optionally add a fingerprint or an RFID card.

!!! warning "Key point"

    The **Config SDK** drives this flow from the scan onwards. The **Access
    SDK** is not used at all.

## Who does what

Six participants appear in the diagrams, in the same order every time.

| Participant | What it is |
|---|---|
| **User** | The person setting the lock up, standing next to it |
| **App** | The iOS or Android app |
| **Config SDK** | Spintly's `configurationProvider`, the only SDK this flow uses and the only one that can talk to the lock |
| **Lock hardware** | The lock itself, over BLE, in configuration mode |
| **Our backend** | Our GraphQL API, with `lock-service` behind it |
| **Spintly's servers** | Spintly's REST APIs, which only our backend calls |

!!! tip "Reading the diagrams"

    - Each diagram reads top to bottom, and each arrow is one call.
    - A solid arrow is a call going out. A dashed arrow is the answer coming
      back.
    - Where an arrow carries an SDK call, the **first line is the member name**
      and the second line says what it does.
    - `#1` to `#7` on the arrows into Spintly are the numbers used in [the
      Spintly chain](#the-spintly-chain) below.
    - A **labelled box** groups the arrows inside it. `alt` means only one of
      its halves happens, and the condition is in brackets. `opt` means the
      arrows inside may not happen at all. `loop` means they repeat. `par`
      means the two halves are happening at the same time.
    - The iOS and Android tabs are linked across the site. Pick a platform once
      and every diagram follows.

## The whole flow

Eight steps, one screen each. Each one has its own section below.

```mermaid
sequenceDiagram
    actor U as User
    participant A as App
    participant C as Config SDK
    participant L as Lock hardware
    participant B as Our backend
    participant S as Spintly's servers

    Note over U,S: 1. Choose a property
    U->>A: Add a new lock, name the property
    A->>B: createSite
    B->>S: Create the account on Spintly's side

    Note over U,S: 2. Put the lock into configuration mode
    U->>L: Long press on the lock

    Note over U,S: 3. Scan for the lock
    A->>C: Start the BLE scan
    C->>L: Look for locks nearby
    L-->>C: Serial number
    C-->>A: The locks it found

    Note over U,S: 4. Customise the lock
    U->>A: Name, area and image
    A->>B: addLock
    B->>S: Create the lock, the owner and their permissions
    A->>B: Poll until Spintly returns the ids

    Note over U,S: 5. Provisioning
    A->>C: Configure the lock
    C->>L: Provision it over BLE

    Note over U,S: 6. Firmware, only if the lock is behind
    A->>C: Read the installed version
    C->>L: Read it off the lock
    A->>C: Push the new firmware
    C->>L: Update it over BLE

    Note over U,S: 7. Master passcode
    U->>A: Choose a passcode
    A->>C: Replace the factory passcode
    C->>L: Write it over BLE
    A->>B: Record it

    Note over U,S: 8. Fingerprint and RFID, both optional
    U->>A: Add a fingerprint or a card
    A->>C: Enrol it
    C->>L: Enrol it over BLE

    Note over U,S: The lock is ready to open
```

## 1. Choose a property

A lock has to live somewhere, so the first screen asks which property it belongs
to. A new user has none yet and creates one here.

```mermaid
sequenceDiagram
    actor U as User
    participant A as App
    participant B as Our backend
    participant S as Spintly's servers

    U->>A: Add a new lock
    A->>B: Fetch the property list
    B-->>A: Empty, this is the first lock on the account
    U->>A: Name the property
    A->>B: createSite(name:)
    B->>S: #1 Fetch an OAuth token
    S-->>B: Token
    B->>S: #2 Create the organisation
    Note right of S: One call, three things created:<br/>the organisation, the property inside it,<br/>and that property's network
    S-->>B: organisationId, siteId, networkId
    B-->>A: Done
    A-->>U: Property created. Next, put the lock into configuration mode
```

The mutation file is `CreateProperty.graphql` and the field it calls is
`createSite`. No SDK is involved. On an account that already has an organisation
our backend runs #3 create site instead, and the app cannot tell the difference.

## 2. Put the lock into configuration mode

A screen of instructions, no calls. The lock only answers a scan while it is in
configuration mode, which the user triggers with a long press on the lock itself.

## 3. Scan for the lock

The app asks the Config SDK to scan, and the SDK reports back any locks
advertising nearby. Each result carries a serial number, which the app sends to
our backend to find out which model it is.

Gateways advertise on the same channel, so both platforms have to keep them out
of the list. iOS filters them out by name. Android does nothing, because gateways
have no row in the catalogue and drop out of the lookup on their own.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Our backend

        U->>A: Start the scan
        A->>C: configurableDeviceStopScan()<br/>Clear a scan left running from an earlier attempt
        A->>C: configurableDeviceStartScan(_:)<br/>Start looking for locks nearby
        C->>L: BLE scan, 40 second timeout
        L-->>C: Serial number and name
        C-->>A: ConfigurableDeviceListener → onDeviceListUpdated<br/>Hands back the devices found so far
        A->>A: Drop anything named Spintly_Gateway
        A->>B: Look the serial numbers up in the catalogue
        B-->>A: The model and display details for each one
        alt Locks found
            A-->>U: The list of locks. Pick one
        else Nothing found
            A-->>U: Nothing nearby, scan again
        end
    ```

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Our backend

        U->>A: Start the scan
        A->>C: configurableDeviceStartScan(ConfigurableDeviceListener)<br/>Start looking for locks nearby
        C->>L: BLE scan, 60 second timeout
        L-->>C: Serial number and name
        C-->>A: ConfigurableDeviceListener → onDeviceListUpdated<br/>Hands back the devices found so far
        A->>B: Look the serial numbers up in the catalogue
        B-->>A: Only known models come back, so gateways drop out here
        alt Locks found
            A-->>U: The list of locks. Pick one
        else Nothing found
            A-->>U: Nothing nearby, scan again
        end
        A->>C: configurableDeviceStopScan()<br/>Stop the scan, once the app is finished with it
    ```

## 4. Customise the lock

The user names the lock and picks where in the house it sits. `addLock` then
tells our backend to build it on Spintly's side.

That takes three calls to Spintly and they run in the background, so `addLock`
returns straight away. The app polls until the ids come back, because every
Config SDK call after this needs them.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant B as Our backend
        participant S as Spintly's servers

        U->>A: Pick the lock from the list
        A->>B: Fetch the areas of the house
        U->>A: Name it, pick an area, choose an image
        opt Custom image
            A->>B: Ask for a presigned upload URL
            A->>B: Upload the image
        end
        A->>B: addLock(createLockInput:)
        B-->>A: Accepted
        par On our backend
            B->>S: #1 OAuth token
            B->>S: #4 Create the access point
            Note right of S: The serial number from the scan lands here
            B->>S: #1 OAuth token again
            B->>S: #5 Create the accessor
            Note right of S: The owner, carrying their Keycloak sub
            B->>S: #1 OAuth token again
            B->>S: #7 Update the accessor's permissions
            Note right of S: Everything at the new lock
        and In the app, meanwhile
            loop Every 2 seconds
                A->>B: getLock
                B-->>A: The ids so far
            end
        end
        A-->>U: All ids are in. Next, provisioning
    ```

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant B as Our backend
        participant S as Spintly's servers

        U->>A: Pick the lock from the list
        A->>B: Fetch the areas of the house
        U->>A: Name it, pick an area, choose an image
        opt Custom image
            A->>B: Ask for a presigned upload URL
            A->>B: Upload the image
        end
        A->>B: addLock(createLockInput:)
        B-->>A: Accepted
        par On our backend
            B->>S: #1 OAuth token
            B->>S: #4 Create the access point
            Note right of S: The serial number from the scan lands here
            B->>S: #1 OAuth token again
            B->>S: #5 Create the accessor
            Note right of S: The owner, carrying their Keycloak sub
            B->>S: #1 OAuth token again
            B->>S: #7 Update the accessor's permissions
            Note right of S: Everything at the new lock
        and In the app, meanwhile
            loop Every 5 seconds
                A->>B: getLock
                B-->>A: The status so far
            end
        end
        A-->>U: Status reached ACCESS_POINT_CREATED. Next, provisioning
    ```

Three ids come back and the rest of the flow depends on them:
`organisationId`, `accessorId` and `accessPointId`. iOS waits for all three.
Android waits for the status to reach `ACCESS_POINT_CREATED`, which walks
`ACCESS_POINT_CREATE_PENDING` → `ACCESS_POINT_CREATED` → `MESH_CONFIGURED`.

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
        participant B as Our backend

        A-->>U: Provisioning screen, please wait
        A->>C: startDeviceMeshConfiguration(_:)<br/>Write the lock's setup onto the lock
        C->>L: Provision the lock over BLE
        L-->>C: Configured
        C-->>A: completion<br/>Done, or failed with an error
        A->>B: updateLockConfigurationStatus<br/>Record that the lock is provisioned
        A-->>U: Provisioned. Next, the firmware check
    ```

    iOS never calls `meshConfigurationClose()` and waits no settle time
    afterwards. If the lock turns out to be configured already, the SDK error is
    shown to the user.

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Our backend

        A-->>U: Provisioning screen, please wait
        A->>C: startDeviceMeshConfiguration(serial, callback)<br/>Write the lock's setup onto the lock
        C->>L: Provision the lock over BLE
        L-->>C: Configured
        C-->>A: SpintlyCompletionCallback → completed or failed<br/>How the SDK reports the result
        A->>C: meshConfigurationClose()<br/>Close the session, whether it worked or not
        A->>A: Wait 5 seconds for the lock to settle
        A->>B: updateLockConfigurationStatus<br/>Record that the lock is provisioned
        A-->>U: Provisioned. Next, the firmware check
    ```

    If the lock turns out to be configured already, the SDK reports `domain 2`
    and `code 24`. Android ignores it and carries on.

## 6. Firmware

The app reads the version off the lock and compares it against the version our
backend says it should be running. The update screen has no skip button, so
cancelling there leaves the lock unfinished on Home.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Our backend

        Note over A,B: iOS checks after the Spintly calls in step 4 have finished
        A->>C: getListOfFirmwareForSerialNumber(_:)<br/>Ask which firmware the lock is running
        C->>L: Read the installed firmware
        L-->>C: ProdSwVersionsWithBleDeviceInfo
        C-->>A: bleDeviceInfo.prodSwVersion<br/>The version number on the lock
        A->>B: What should this lock be running?
        B-->>A: The target version
        alt Out of date
            A-->>U: Firmware update screen, with no skip
            A->>C: firmwareUpdateToSelectedVersion(_:)<br/>Send the new firmware to the lock
            C->>L: Push the new firmware over BLE
            L-->>C: Updated
            A->>A: Re-enter the flow and read the version again
        else Up to date
            A-->>U: Next, the master passcode
        end
    ```

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Our backend

        Note over A,B: Android checks before the Spintly calls in step 4 have finished
        A->>C: getListOfFirmwareForSerialNumber(...)<br/>Ask which firmware the lock is running
        C->>L: Read the installed firmware
        L-->>C: ProdSwVersionsWithBleDeviceInfo
        C-->>A: bleDeviceInfo.prodSwVersion<br/>The version number on the lock
        A->>B: What should this lock be running?
        B-->>A: The target version
        alt Out of date
            A-->>U: Firmware update screen, with no skip
            A->>C: firmwareUpdateToSelectedVersion(...)<br/>Send the new firmware to the lock
            C->>L: Push the new firmware over BLE
            L-->>C: Updated
            A->>A: onboardLock(force = true) reads both versions again
        else Up to date
            A-->>U: Next, the master passcode
        end
    ```

Nothing here reaches Spintly. The target version comes from our own backend.

## 7. Master passcode

The lock ships with a factory passcode and this step replaces it. The Config SDK
writes the new one onto the lock, and our backend saves it afterwards.

=== "iOS"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Our backend

        U->>A: Choose a new master passcode
        A->>C: updateMasterPasscode(serial, orgId, accessorId, old, new, completion)<br/>Replace the passcode held on the lock
        Note right of C: old is the factory passcode.<br/>orgId and accessorId came from step 4
        C->>L: Write the master passcode over BLE
        L-->>C: Written
        C-->>A: completion<br/>Done, or failed with an error
        A->>B: finalisePasscode(passcode:lockId:accessorId:)<br/>Save the passcode on our backend
        A-->>U: Passcode set. Add a fingerprint or a card, or finish here
    ```

    If the passcode is already in use the SDK returns code `1_899_102_215`. iOS
    treats that as a success.

=== "Android"

    ```mermaid
    sequenceDiagram
        actor U as User
        participant A as App
        participant C as Config SDK
        participant L as Lock hardware
        participant B as Our backend

        U->>A: Choose a new master passcode
        A->>C: generateMasterPasscode(serial, orgId, accessorId, old, new, callback)<br/>Replace the passcode held on the lock
        Note right of C: Same arguments as iOS, different member.<br/>old is the factory passcode
        C->>L: Write the master passcode over BLE
        L-->>C: Written
        C-->>A: SpintlyCompletionCallback → completed or failed<br/>How the SDK reports the result
        A->>B: finalisePasscode(passcode, lockId, accessorId)<br/>Save the passcode on our backend
        A-->>U: Passcode set. Add a fingerprint or a card, or finish here
    ```

    If the passcode is already in use, Android shows the error to the user.

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
        loop Each press of the finger
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
        loop Each press of the finger
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

| Access method | On the lock | Saved on our backend |
|---|---|---|
| Master passcode | Yes | Yes, through `finalisePasscode` |
| Fingerprint | Yes | No |
| RFID card | Yes | No |

A fingerprint or a card added during setup lives on the lock and nowhere else.
There is no mutation for fingerprints at all. `assignRfid` exists for cards, but
the iOS call site is commented out and Android's `AssignRfidUsecase` has no
caller, so neither platform ever sends it.

## Which calls reach Spintly

Two of the app's calls reach Spintly, and both go through our backend on the way.
Both platforms behave the same.

| Step | Our GraphQL operation | What our backend does at Spintly |
|---|---|---|
| 1 | `createSite(name:)` | #2 create organisation, or #3 create site |
| 4 | `addLock(createLockInput:)` | #4 create access point, then #5 create accessor, then #7 permissions |

Everything else stops at our own backend: the property list, the catalogue
lookup, the areas of the house, the image upload URL, the polling in step 4,
`updateLockConfigurationStatus`, and both firmware calls.

## The Spintly chain

Seven calls exist. A first lock uses five of them: #1, #2, #4, #5 and #7. On an
account that already has an organisation, #3 runs in place of #2. Nothing in this
flow uses #6.

| # | Spintly API | Method | Endpoint | What it does |
|---|---|---|---|---|
| 1 | OAuth token | `POST` | `/identityManagement/v2/oauth/token` | Our backend authenticates itself with a client id and secret. Fetched again before every call below, as there is no token cache |
| 2 | Create organisation | `POST` | `/infrastructureManagement/internal/v1/organisations` | The first lock on the account. The payload carries `sites[]` and `networks[]` inline, so this call also produces the first site and network |
| 3 | Create site | `POST` | `/infrastructureManagement/internal/v1/organisations/{orgId}/sites` | A new property inside an existing organisation. Creates that property's network too |
| 4 | Create access point (v2) | `POST` | `/infrastructureManagement/internal/v2/networks/{networkId}/accessPoints` | The lock itself, and where the serial number from the scan lands |
| 5 | Create accessor | `POST` | `/credentialManagementV3/v1/accessors` | Creates the owner inside Spintly, carrying their Keycloak `sub` and the provider id |
| 6 | Add accessor to organisation | `POST` | `/credentialManagementV3/v1/organisations/{orgId}/accessors/{accessorId}` | `graphql-gateway`, `user-service` and `notification-service` use this. `lock-service` does not, so an owner who is already an accessor elsewhere still goes through #5 |
| 7 | Update accessor permissions | `PATCH` | `/permissionManagementV3/v1/organisations/{orgId}/accessors/{accessorId}/permissions` | Grants the owner everything at the new lock: mobile, card, fingerprint, passcode and admin |

The order within the chain is taken from the fields the app polls, since we do
not have the backend source.

## Differences between the two

| | iOS | Android |
|---|---|---|
| Config SDK environment | Set once at app launch | Re-applied before every call |
| BLE scan timeout | 40 seconds | 60 seconds |
| Keeping gateways out | Filters on `ConfigurableDevice.name == "Spintly_Gateway"` | No filter. Gateways have no catalogue row and drop out of the lookup |
| Waiting in step 4 | `getLock` every 2 seconds, waits for all ids | `getLock` every 5 seconds, waits for `ACCESS_POINT_CREATED` |
| When the firmware is checked | After the Spintly calls have finished | Before they have |
| Firmware retry after an update | Re-enters the flow | `onboardLock(force = true)` reads both versions again |
| `meshConfigurationClose()` | Not called | Called on success and on failure |
| Settle delay after configuring | None | 5 seconds |
| A lock that is already configured | The SDK error is shown | `domain 2` and `code 24` ignored |
| **Master passcode SDK member** | **`updateMasterPasscode`** | **`generateMasterPasscode`** |
| Duplicate passcode SDK error | Code `1_899_102_215` treated as success | Shown to the user |
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
