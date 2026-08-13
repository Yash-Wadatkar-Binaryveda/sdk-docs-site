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

## Not published — on purpose

This is an internal reference, so there is no public site. GitHub Pages serves
publicly **even from a private repository** (private Pages needs GitHub
Enterprise Cloud), so publishing it there would put the app's auth architecture
and Spintly's endpoints on the open internet.

`site_url` in `zensical.toml` is therefore left unset, and
`.github/workflows/docs.yml` does not deploy anywhere. On every push and pull
request it instead:

1. builds the site with `--strict`, which **fails on warnings** — including
   broken internal links and missing heading anchors, so a bad cross-reference
   cannot reach `main`;
2. attaches the built site as an artifact named `sdk-docs-site`.

### Reading it without installing anything

Open the latest run under the repo's **Actions** tab, download the
`sdk-docs-site` artifact, unzip it, and open `index.html`. Artifacts are kept
for 30 days.

### Reading it with live reload

Clone the repo and follow **Working on it** above — `zensical serve` gives the
full experience, including search.

### If it ever does need real hosting

Options that keep it behind a login: Cloudflare Pages or Azure Static Web Apps
with access control, or GitHub Pages on a GitHub Enterprise Cloud plan. Whatever
you pick, set `site_url` to the real URL so canonical links and the sitemap come
out right.
