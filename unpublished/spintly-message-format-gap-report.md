# Differences between Spintly's message formats and the backend implementation

Spintly's message format files document the messages published to three Kafka
topics. The backend consumes all three, in `notification-service/src/kafka`.
Not every documented message is used, so the format files and the code do not
match one to one.

This report lists the differences, in three parts:

1. Messages that are documented but not used.
2. Fields inside used messages that are not read.
3. Points where the code and the documented format do not match.

## Summary

| Topic | Documented | Named in code | Acted on |
|---|---|---|---|
| Lock events (activity trail) | 57 | 21 | 20 |
| Resource events (resource CRUD) | 19 | 13 | 7 |
| Status events (online and offline) | 5 | 5 | 5 |
| **Total** | **81** | **39** | **32** |

Two further format files, `firemwareRelease.txt` and `inventory.txt`, have no
consumer. See section 5.

## 1. Lock events (activity trail topic)

Spintly documents 57 event types. The backend acts on 20.

### Used

| Event | Handling |
|---|---|
| `card_access` | Activity trail row, `Card` |
| `mobile_access` | Activity trail row, `Mobile` plus a mode suffix |
| `remote_access` | Activity trail row, `Remote` |
| `fingerprint_access` | Activity trail row, `Fingerprint` |
| `keypad_accessor_access` | Activity trail row, `Passcode` |
| `keypad_passcode_access` | Activity trail row, `OTP`, and the one time user is retired |
| `dual_auth_access` | Activity trail row, `2FA`, both access methods resolved |
| `web_remote_access` | Activity trail row, `Web Remote` |
| `deadbolt_event` | Lock state, plus an `autolock` trail row on the locked case |
| `door_open`, `door_close` | Door state, socket event, watch push, webhook |
| `door_mode_changed` | Privacy or passage mode, socket event, webhook |
| `doorbell` | Silent high priority push, webhook |
| `door_tamper` | Push, webhook |
| `door_tamper_reset` | Push |
| `door_open_too_long` | Push, webhook |
| `latch_locking_failure` | Push |
| `prank_alarm` | Push, webhook |
| `card_enrolled`, `card_unenrolled` | Card assignment row |

`mechanical_key_unlock` is recognised and then excluded, so it never reaches the
trail. That is intentional.

### Not used

36 event types. They reach the consumer, match nothing, and are dropped. There
is no unrecognised-event log line on this topic, unlike the resource topic.

| Group | Events |
|---|---|
| Denied access (10) | `mobile_access_denied`, `card_access_denied`, `fingerprint_access_denied`, `keypad_access_denied`, `mobile_remote_access_denied`, `web_remote_access_denied`, `qr_credential_access_denied`, `ble_beacon_access_denied`, `dual_auth_access_denied`, `access_denied` |
| Card problems (3) | `unrecognised_card`, `unassigned_card`, `no_permission_card` |
| Remote, no permission (2) | `no_permission_mobile_remote_access`, `no_permission_web_remote_access` |
| Other access methods (4) | `face_access`, `qr_credential_access`, `ble_beacon_access`, `handle_rotate` |
| Alarms and resets (6) | `door_open_too_long_reset`, `prank_alarm_reset`, `latch_open_too_long`, `latch_open_too_long_reset`, `door_breakin`, `door_breakin_reset` |
| Fire alarm (2) | `fire_occurred`, `fire_panel_reset` |
| 2FA (1) | `dual_auth_access_timeout` |
| Device and installer (7) | `manual_reboot_switch`, `local_factory_reset`, `temporary_mute_switch`, `registration_mode`, `deletion_mode`, `scramble_code_enable`, `scramble_code_disable` |
| Passcode (1) | `otp_expired` |

### Fields not read

| Field | Appears on |
|---|---|
| `hash` | Every event on this topic |
| `version` | Every event on this topic |
| `updateReason` | `door_mode_changed` v1 and v3. Values are `fireEmergency`, `cloudCommand`, `fireAlarmReset`, `schedule`, `mobileCommand` |
| `accessorId` | `door_mode_changed` v3, on a cloud or mobile command |
| `channelId` | `door_mode_changed`, on a fire emergency |
| `spintlyCard` | `card_enrolled`, `card_unenrolled` |
| `orgId` | `web_remote_access` |
| `customParameter` | `mobile_access` |
| `type` | `keypad_passcode_access`. Spintly sends `"otp"` |

## 2. Resource events (resource CRUD topic)

Spintly documents 19 message types. The backend acts on 7.

| Message | Recognised | Handling |
|---|---|---|
| `resource_alive` | Yes, checked first | Accessor creation, and the `synced` flags on organisation, site and lock |
| `site_create` | Yes | Marks the site synced |
| `site_delete` | Yes | Marks the site synced and inactive |
| `access_point_create` | Yes | Marks the lock synced, then creates or extends the owner's accessor |
| `access_point_delete` | Yes | Marks the lock deleted and inactive |
| `gateway_create` | Yes | Sets the gateway config status |
| `gateway_delete` | Yes | Marks the gateway deleted and inactive |
| `organisation_create` | Yes | Nothing. Handled through `resource_alive` instead |
| `organisation_update` | Yes | Nothing |
| `organisation_delete` | Yes | Nothing |
| `site_update` | Yes | Nothing |
| `device_create` | Yes | Nothing. Lock rows are written by `lock-service` |
| `device_delete` | Yes | Nothing |
| `device_update` | No | Logged as unrecognised. See section 6 |
| `meshio_create` | No | Name mismatch. See section 6 |
| `meshio_delete` | No | Name mismatch. See section 6 |
| `network_create` | No | Logged as unrecognised |
| `network_update` | No | Logged as unrecognised |
| `network_delete` | No | Logged as unrecognised |

### Fields not read

Each handler reads only the identifier it needs.

| Message | Fields not read |
|---|---|
| `organisation_create` | `name`, `type`, `accountType`, `country`, `partnerId`, `integratorId`, `admins` |
| `organisation_update` | `updates`, `name`, `partnerId`, `admins` |
| `site_create` | `name`, `location`, `timezone`, `orgId` |
| `site_update` | All fields |
| `access_point_create` | `name`, `forAccess`, `forAttendance`, `siteId`, `networkId`, `installationMethod`, `configuration`, `channelNo`, `lockingMechanism`, `relayOnTime`, `invertRelayLogic`, `devices` |
| `access_point_delete` | `siteId`, `configuration`, `channelNo`, `devices` |
| `device_create` | All fields, including the `soc` block with MAC addresses and the six BLE RSSI calibration values |
| `gateway_create` | `networkId`, `siteId`, `pdSwId`, `hwId`, `soc` |
| `network_create`, `network_update`, `network_delete` | All fields |

## 3. Status events (online and offline topic)

Spintly documents 5 message types. All 5 are handled. The differences on this
topic are at field level, in section 6.

| Message | Handling |
|---|---|
| `device_status` | Lock online or offline, lock to gateway mapping, socket, watch push, webhook |
| `gateway_status` | Gateway online or offline, socket, watch push |
| `device_battery_status` | Battery row, level and status on the lock, push when critical |
| `beacon_attached` | Marks the BLE remote onboarded |
| `beacon_detached` | Marks the BLE remote reset |

### Fields not read

| Field | Appears on |
|---|---|
| `version`, `dataVersion` | All messages that carry them |
| `rtcBatteryVoltage`, `rtcBatteryPercentage`, `adcValue` | `device_battery_status` |
| `beaconId` | `beacon_attached`, `beacon_detached` |
| `gatewayTime`, `cloudTime` | All messages that carry them |

## 4. Version fields

Every message on all three topics carries a version. None are read.

| Topic | Version fields |
|---|---|
| Resource CRUD | `messageVersion`, and `dataVersion` inside `messageData` |
| Activity trail | `version` |
| Online and offline | `version`, and `dataVersion` on `device_status`, `beacon_attached`, `beacon_detached` |

On the activity trail topic three events exist in more than one version, and the
shape differs between them:

| Event | Versions | Difference |
|---|---|---|
| `door_mode_changed` | v1, v3 | v1 has no `oldDoorMode`. v3 adds `oldDoorMode`, `accessorId`, and two more `updateReason` values |
| `no_permission_card` | v2, v3 | v3 adds `credentialId` and `hash` |
| `mechanical_key_unlock` | v1, v2 | v2 adds `latchPosition` |

No handler branches on a version.

## 5. Format files with no consumer

| File | Contents | Where the data comes from instead |
|---|---|---|
| `firemwareRelease.txt` | Firmware release announcement: version numbers, release notes, model number, release date, criticality, minimum iOS and Android SDK versions. No message type field, not on any of the three topics | `lock-service` owns the `firmwares` and `firmware_releases` tables. Releases are entered through GraphQL |
| `inventory.txt` | Per device record: serial number, model number, firmware versions | The app reads the firmware version over BLE and sends it up through the `updateLockInformation` mutation in `lock-service` |

## 6. Where the code and the format do not match

| What Spintly sends | What the code does | Result |
|---|---|---|
| `meshio_create`, `meshio_delete` | Looks for `mesh_io_create`, `mesh_io_delete` in `MESSAGE_TYPES` | Never matches. Logged as unrecognised |
| `device_update`, with `configurationStatus` 1, 2, 3 or 5 | Not in `MESSAGE_TYPES`, so never dispatched. A complete handler for it exists in `updateResource()` (`resourceCrud.ts:339`) covering status 1 and 2 | Logged as unrecognised. The handler is unreachable |
| `deviceSerialNumber` on `beacon_attached` and `beacon_detached` | Reads `data.serialNumber` | Always `undefined`. Not used today, the only line that consumed it is commented out |
| `mobileAccessMode` with four values: `clickToAccess`, `mobileNfcAccess`, `tapToAccess`, `proximity` | `MOBILE_ACCESS_MODES` maps two (`constants.ts:75`), and the lookup is unguarded | `tapToAccess` and `proximity` write `Mobile_undefined` to the trail, and the push body reads "using undefined" |
| Timestamps inside `data` on the online and offline topic | Three push payloads read a top level `eventTime`, which does not exist on this topic (`message-handler.service.ts:1419, 1565, 1806`) | `INVENTORY_STATUS` and `LOCK_BATTERY` pushes carry `Invalid Date`. Database writes and webhooks read the correct fields |
| `device_battery_status` may carry only `rtcBatteryVoltage` and `rtcBatteryPercentage` | Requires `deviceBatteryVoltage` and `deviceBatteryPercentage` to be present and truthy | An RTC-only message is dropped in full. A `deviceBatteryVoltage` of `0` also fails the check |
| `door_mode_changed` v1, which has no `oldDoorMode` | `updateDoorMode()` branches on `oldDoorMode` | On a v1 message returning to `accessControl`, no socket event or webhook is sent. The database is still updated |
| `door_mode_changed` where `oldDoorMode` equals `updatedDoorMode` | `updateDoorMode()` returns nothing on that path (`updateDoorMode.ts:60`), and the caller reads `doorModeData.lockId` (`message-handler.service.ts:189`) | `TypeError`. The consumer crashes and the offset is stepped past the message |
| `handle_rotate` | Has a display name in `UNLOCK_EVENT_TYPES` (`constants.ts:67`) but is missing from `KAFKA_UNLOCK_EVENT_TYPES`, which is the list that is checked | The mapping is unreachable |
| No `gateway_update` message is documented | `updateResource()` has a gateway branch for it | Dead code |

## Appendix: issues found that are not format differences

These came up while tracing the differences above. They are consumer defects
rather than mismatches with the message format.

| Issue | Where | Effect |
|---|---|---|
| The battery change socket event and watch push send `LOCK_STATUS[batteryStatus]` as `status`, and `lock.battery_status` from before the update | `message-handler.service.ts:1699, 1726` | `status` is always `undefined`, and the client receives the previous battery status |
| Several handlers use the lock without a null check | `message-handler.service.ts:252`, `updateDoorMode.ts:83, 108, 135` | An event for a lock that is inactive or not stored throws and crashes the consumer |
| The OTP handler uses the one time user without a null check | `activity-trail.service.ts:834` | An OTP unlock with no matching row throws |
| `updateDoorMode()` queries `spintly_id` without the numeric conversion used elsewhere | `updateDoorMode.ts:46, 66, 76, 90, 100, 116, 127` | Works while Spintly sends a number |
| Offsets are seeked on partition 0 only, and stored one row per topic | `kafka.service.ts:99, 170, 240` | Correct for single partition topics only |
