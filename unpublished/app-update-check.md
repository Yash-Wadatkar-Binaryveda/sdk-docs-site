# App Update Check (Vave B2B)

The app checks for a newer version every time it starts, before the user reaches
any screen. Based on what the backend returns, it either lets the user through,
offers an update they can postpone, or blocks them until they update.

The same feature is already running in the Advantis Smartlocks B2C app. This
document describes the behaviour so it can be built the same way for Vave.

Two API calls are needed. One to save the details of a new app version, and one
for the app to read those details when it starts.

## Apps covered

Vave B2B ships four builds: a Staff app and a Guest app on Android, and the same
two on iOS. Each of them is versioned on its own, so both calls have to say
which platform and which of the two apps they refer to.

## The two dialogs

**Skippable.** Shown when a newer version exists but the installed one is still
allowed. Two options, *Update now* and *Maybe later*. Choosing *Maybe later*
dismisses the dialog and the app continues normally.

![Update Available dialog with Update now and Maybe later buttons](update-available.png)

**Non skippable.** Shown when the installed version is no longer allowed. Only
*Update now*. There is no *Maybe later* button and no back action, so the user
cannot reach the app until the new version is installed.

## 1. Save the new version details

Whenever a new version of an app goes out, its details are saved through this
call. This is what the app later reads from.

| Field | What it means |
| --- | --- |
| `version` | The app version being saved, as a string, for example `2.4.0`. |
| `platform` | Which platform it applies to: `android`, `ios` or `web`. |
| `appType` | Which of the two apps it applies to: `staff` or `guest`. |
| `isLatest` | `true` marks this version as the newest one available. Anyone below it is offered an update. |
| `isMinimum` | `true` marks this version as the minimum a user is allowed to run. Anyone below it has to update. |
| `releaseNotes` | Notes recorded against the release. Not displayed anywhere in the app. |

## 2. Check on app start

The app calls the read endpoint on every launch, logged in or logged out. It
sends the platform it is running on and its own app type, so the backend can
return the release information for that specific build.

Sent by the app:

| Field | What it means |
| --- | --- |
| `id` | The saved version entry to read. |
| `platform` | `android`, `ios` or `web`. |
| `appType` | `staff` or `guest`. |

Returned by the backend:

| Field | What it means |
| --- | --- |
| `id` | The saved version entry. |
| `version` | The app version these details describe. |
| `platform` | The platform it belongs to. |
| `appType` | The app it belongs to. |
| `isLatest` | `true` if this is the newest released version. |
| `isMinimum` | `true` if this is the minimum version a user is allowed to run. |
| `releaseNotes` | Notes recorded against the release. |

**This call has to work without an auth token.** It runs before the user reaches
the login screen, so it cannot sit behind authentication.

## 3. Decide what to show

Compare the version installed on the device against the response.

| Installed version | Dialog |
| --- | --- |
| Below the version marked `isMinimum` | Non skippable |
| At or above the minimum, but below the version marked `isLatest` | Skippable |
| Same as the version marked `isLatest` | None, the app continues |
