# SDK & Backend Calls — docs site

A [Zensical](https://zensical.org) site for the Spintly SDK / backend call
reference. Kept deliberately separate from the iOS and Android app repos.

Source content lives in `docs/`; the built site lands in `site/`.

## Pages

| File | Page |
|---|---|
| `docs/index.md` | Overview — the three SDKs and the order they run in |
| `docs/user-onboarding.md` | 1. User Onboarding — iOS / Android SDK members per phase, differences |
| `docs/lock-share-invites.md` | 2. Lock Share Invites — the four Spintly REST calls, the Config SDK write |

Page titles come from the `nav` in `zensical.toml`. Renaming a file changes the
page's URL, so keep the two in step when a title changes.

## Where the member names came from

The SDKs ship as closed binaries, so the member names were read off each
framework's own public interface rather than out of our source — for the Access
SDK on iOS, `SmartAccessFramework.swiftinterface`. None of them are declared
anywhere in our own code; we only call them. Worth re-checking against the
interface files whenever one of the three SDKs is upgraded.

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

## Publishing

`.github/workflows/docs.yml` builds the site and deploys it to GitHub Pages on
push. It only runs once this folder is a git repo with a GitHub remote — set
`site_url` in `zensical.toml` to the real Pages URL before relying on it.
