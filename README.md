# SDK & Backend Calls docs site

A [Zensical](https://zensical.org) site for the Spintly SDK and backend call
reference. Kept separate from the iOS and Android app repos.

Source content lives in `docs/`, and the built site lands in `site/`.
`unpublished/` holds pages that are kept but not built into the site.

## Pages

| File | Page |
|---|---|
| `docs/index.md` | Overview of the three SDKs and the order they run in |
| `docs/user-onboarding.md` | 1. User Onboarding: iOS and Android SDK members per phase, plus the differences |
| `docs/lock-onboarding.md` | 2. Lock Onboarding: a fresh user's first lock, as sequence diagrams, with the GraphQL and Spintly REST calls on the arrows |
| `docs/home.md` | 3. Home: the lock list, live updates, and unlocking over BLE with the internet as fallback |
| `docs/lock-control-panel.md` | 4. Lock Control Panel: the screen for one lock, its privacy mode write, and where its three buttons lead |
| `docs/user-management.md` | 5. User Management: inviting someone to a lock, the four kinds of user, accepting an invite, and setting the passcode |
| `docs/notifications.md` | 6. Notifications: push topics and how each one routes, plus the notification centre behind the bell |

Page titles come from the `nav` in `zensical.toml`. Renaming a file changes the
page's URL, so keep the two in step when a title changes.

## Where the member names came from

The SDKs ship as closed binaries, so the member names were read off each
framework's own public interface rather than out of our source. For the Access
SDK on iOS that file is `SmartAccessFramework.swiftinterface`. None of the
members are declared anywhere in our own code. We only call them, so it is worth
re-checking against the interface files whenever one of the three SDKs is
upgraded.

## Working on it

Python and Zensical are already installed into `.venv/`.

```powershell
# live preview at http://localhost:8000, rebuilds on save
.\.venv\Scripts\zensical serve

# one-off build into site/
.\.venv\Scripts\zensical build
```

If `.venv/` ever goes missing, recreate it:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" -m venv .venv
.\.venv\Scripts\python -m pip install zensical
```

## Published site

<https://yash-wadatkar-binaryveda.github.io/sdk-docs-site/>

> [!WARNING]
> **This URL is public.** A GitHub Pages site is readable by anyone who has the
> link, even though this repository is private, and search engines can index it.
> Nothing added to `docs/` should be anything you would not put on the open
> internet, including credentials, customer data, and unreleased plans.

`.github/workflows/docs.yml` deploys on every push to `main`:

1. builds with `--strict`, which **fails on warnings**. Broken internal links
   and missing heading anchors both count, so a bad cross-reference cannot reach
   the live site.
2. uploads the result and publishes it to Pages.

Pull requests run the build but stop before deploying, so you get the link check
without publishing.

### Requirements

- **Settings → Pages → Source** must be set to **GitHub Actions**.
- Pages on a **private** repo needs a paid plan (Pro, Team, or Enterprise). On
  the Free plan the repo has to be public for Pages to work.

### Taking it back down

Delete the `deploy` job from the workflow, then go to **Settings → Pages** and
unpublish the site. Anything already published may sit in search engine and
archive caches afterwards.
