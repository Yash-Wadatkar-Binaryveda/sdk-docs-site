# SDK & Backend Calls docs site

A [Zensical](https://zensical.org) site for the Spintly SDK and backend call
reference. Kept separate from the iOS and Android app repos.

Source content lives in `docs/`, and the built site lands in `site/`.
`unpublished/` holds pages that are kept but not built into the site.

## Pages

| File | Page |
|---|---|
| `docs/index.md` | Overview of the three SDKs and the order they run in |
| `docs/conventions.md` | Reading these pages: the participants, the diagram shapes, and what each arrow carries. Defined once so no flow page repeats them |
| `docs/user-onboarding.md` | 1. User Onboarding: iOS and Android SDK members per phase, plus the differences |
| `docs/lock-onboarding.md` | 2. Lock Onboarding: a fresh user's first lock, as sequence diagrams, with the GraphQL and Spintly REST calls on the arrows |
| `docs/home.md` | 3. Home: the lock list, live updates, and unlocking over BLE with the internet as fallback |
| `docs/lock-control-panel.md` | 4. Lock Control Panel: the screen for one lock, its privacy mode write, and where its three buttons lead |
| `docs/user-management.md` | 5. User Management: inviting someone to a lock, the four kinds of user, accepting an invite, and setting the passcode |
| `docs/activity-trail.md` | 6. Activity Trail: the global and per lock logs, how a row is built, filtering, paging, live updates, and export |
| `docs/lock-settings.md` | 7. Lock Settings: the menu and its role gating, hardware settings written over BLE, accessories, firmware, factory reset and removal, plus the gateway |
| `docs/notifications.md` | 8. Notifications: push topics and how each one routes, plus the notification centre behind the bell |
| `docs/profile-and-account.md` | 9. Profile and Account: the profile menu, updating the name and photo, changing the phone number or email, properties, voice assistants, integrators, support, and deleting the account |

Page titles come from the `nav` in `zensical.toml`. Renaming a file changes the
page's URL, so keep the two in step when a title changes.

## The diagram colours

Mermaid draws every participant in one colour and every arrow in one stroke,
which turns a six participant diagram into a grey mesh, and it offers no per
participant hook to change that. `docs/javascripts/diagrams.js` adds one, and
also writes the short legend that appears under any diagram using an `opt`,
`alt`, `par` or `loop` block.

Two files, and they have to agree:

| File | Holds |
|---|---|
| `docs/stylesheets/extra.css` | The colours themselves, as `--seq-*` properties, one set for the light palette and one for the dark |
| `docs/javascripts/diagrams.js` | The map from a participant's label to its colour, and the legend wording |

**To add a participant**, add a `--seq-` property to the stylesheet and an entry
to `SLOT` in the script, keyed on the label exactly as it appears after `as` in
the `participant` line. Miss the `SLOT` entry and it takes a spare colour rather
than breaking.

The script works by wrapping `mermaid.render`, because the theme seals each
finished diagram inside a closed shadow root that nothing else can reach. That
is a workaround for how Zensical renders mermaid today, so it is worth a glance
after a Zensical upgrade. If it ever stops matching, the diagrams fall back to
mermaid's own colours rather than breaking.

> [!IMPORTANT]
> **Bump the `?v=` on both files in `zensical.toml` whenever you change either
> of them.** Zensical fingerprints its own bundles, so a theme change reaches
> readers on its own, but `extra_css` and `extra_javascript` are copied under
> fixed names. Without a new version marker a browser keeps serving the copy it
> already has, and the change looks like it never deployed.

> [!NOTE]
> Zensical fetches mermaid from `unpkg.com` when a page with a diagram opens, so
> the diagrams need the reader to have internet access. That is Zensical's
> behaviour, not something this site sets up.

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
