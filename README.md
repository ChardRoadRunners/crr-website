# Chard Road Runners

The website for Chard Road Runners, an England Athletics affiliated running club
in Chard, Somerset, established 1981. It replaces a Webador site that had not
been updated in years.

**Not launched yet.** See [Before you judge anything](#before-you-judge-anything).

---

## What it is for

Five jobs, in rough order of importance:

1. **Welcome newcomers** and explain how to join — the club's main recruitment route.
2. **Promote the two club races**, the Chard Flyer and Forde Abbey 10k.
3. **Publish race reports** written by members, as a proper archive rather than
   posts that vanish down a Facebook feed.
4. **Show championship and handicap results.**
5. **Host photos.**

The end goal is a **documented handover to the club as an organisation**, not to
an individual. That is why committee members edit through a CMS rather than
asking one person, why the two schemas are guarded by a script rather than by
memory, and why the reasoning is written into the files rather than left in chat.

---

## Stack

| | |
| :-- | :-- |
| **Astro 7** | Static site generator. No server, no runtime framework, no client-side router. |
| **Tailwind CSS 4** | Via `@tailwindcss/vite`. No `tailwind.config.js` — configuration lives in CSS. |
| **daisyUI 5** | Component layer on Tailwind, configured with `@plugin` in CSS. |
| **TypeScript** | Strict. |
| **Markdown** | All content. Frontmatter validated by Zod schemas. |
| **Sveltia CMS** | Git-backed editing at `/admin`. Commits to `main` through GitHub. |
| **Cloudflare Workers** | Static assets. Push to `main` and it builds and deploys itself. |

Node 22.12 or newer. Few dependencies on purpose; `package.json` is the list.
`sharp` resizes and converts every image at build time, on Cloudflare's builder
as well as locally.

Counts are left out of this file deliberately. It once said "five collections"
and "two scripts" for two months after both had changed; the folders are the
count.

---

## Getting it running

```
npm install
npm run dev          # localhost:4321
```

| Command | What it does |
| :------ | :----------- |
| `npm run dev` | Local preview with hot reload |
| `npm run build` | Runs the checks below, then builds to `dist/` |
| `npm run preview` | Serve the built output |
| `npm run check:cms` | The content files, their photos and the menus against the CMS and the pages |
| `npm run check:diary` | List race diary entries running on stale evidence (advisory) |
| `npm run check:calendar` | The club calendar rules: time zones, repeats, cancellations |
| `npm run check:championship` | Reading the championship sheet, and everything that should stop the build |
| `npm run check:handicap-results` | The same for the handicap results sheet |
| `npm run check:handicap` | The handicap rules in `sheets/handicap/`. **Not part of the build**: run it before pasting those files into the sheet |

`npm run build` runs the first five checks and **fails the build** if one
breaks. That is deliberate — see [The two schemas](#the-two-schemas).

**The build needs the internet.** It downloads the two fonts and reads the two
results sheets from Google every time (the calendars are saved copies and are
not fetched). With no connection, or behind a firewall that blocks Google, it
stops at the results sheets and says so.

`.claude/launch.json` is kept on purpose. It tells Claude Code's browser
preview how to start this project's dev server — `npm run dev` on port 4321 —
so a preview can be opened without a server being started by hand first. It
affects nothing about the site or the build, and deleting it only means
starting the server manually.

---

## Folder layout

```
src/
├── components/     Astro components
├── content/        all editable content, as Markdown
│   ├── race-reports/     members' race reports, with an images/ folder beside them
│   ├── news/             club notices, with images/
│   ├── races/            the two club races, with images/
│   ├── pages/            the wording for each one-off page
│   ├── legal/            the policy pages
│   ├── calendar-events/  race diary entries
│   └── navigation/       the top menu and the footer
├── data/calendars/ saved copies of the club's Google calendars, refreshed nightly
├── layouts/        Layout.astro (site shell), BlogPost.astro (race reports and news)
├── pages/          routes — file name becomes URL
├── styles/         app.css (theme + utilities), global.css (element defaults)
├── utils/          calendars, results sheets, the race diary, dates and distances
└── assets/         logo and contour SVGs, processed at build time

public/             served verbatim — favicons, logo, /admin, _redirects
scripts/            the build's checks, and the nightly calendar download
sheets/handicap/    the script and timing page that live inside the CRR Handicap
                    Google Sheet, kept here as the master copy, plus the finish tokens
workers/            two more Cloudflare Workers: the nightly rebuild, and CMS sign-in
.github/workflows/  the build alarm and the nightly calendar download
docs/               the reference documents listed at the end
```

---

## Content collections

Seven, all in `src/content/`, each with a Zod schema in `src/content.config.ts`.
[docs/content-model.md](docs/content-model.md) is the full account.

**`race-reports`** — reports on races members have run. One entry per race in
a `races` array, so a weekend round-up covering three races sorts and links
correctly. There is no top-level date field: posts sort by the **earliest**
`raceDate` in that array, so nothing can drift out of sync. `draft: true` hides a
post.

**`news`** — club notices: anything that is not a report on a race. Dated by
`posted`, because a notice has no race to take a date from.

**`races`** — the two club-hosted races. Entry links only render when
`entriesOpen` is true, which is what stops a dead entry link sitting on the page
for eleven months of the year.

**`pages`** — the wording for each one-off page: home, join us, calendar, pub
runs, contact, results and news. A discriminated union:
each page has its own shape, picked by the `page` field, so a validation error
names the field that is wrong rather than listing every page's fields at once.

**`legal`** — welfare, inclusion, privacy, rules and constitution. One shared
shape, and the only collection whose Markdown body becomes the page. A new file
gets a route automatically from `src/pages/[legal].astro`, but its footer link
still has to be added to the footer in the `navigation` collection.

**`navigation`** — the top menu and the footer, labels and addresses both, so
the committee can change them in the CMS. The build fails if an address is not
a page.

**`calendar-events`** — the race diary. The unusual one, and worth
reading [docs/race-diary.md](docs/race-diary.md) before judging it. Each entry
stores a **rule** for roughly when a race happens ("last Sunday in November"),
not a date, because every rule was derived from a single club race report. The
page renders those as approximate and **never as a specific day** unless a human
has confirmed the date with the organiser. A confirmed date that has already
passed counts as unconfirmed, because a stale date presented as fact is how
somebody ends up at a car park a week late.

---

## Pages

| Route | What it is |
| :---- | :--------- |
| `/` | Hero, "What's on!" (latest results, posts and what is coming up), club nights, handicap, pub runs, Couch to 5k, club races |
| `/join-us` | First visit, which night to pick, membership, Couch to 5k |
| `/race-reports` | Archive index, newest first, lead post spanning both columns |
| `/race-reports/[slug]` | A report: purple masthead, photo, body, gallery, share block |
| `/news` | Every handicap night, race report and club notice in one line, newest first |
| `/news/[slug]` | A club notice |
| `/our-races` | The Chard Flyer and Forde Abbey 10k, each with its details, start time and race director |
| `/calendar` | The club's Google calendars and the race diary |
| `/pub-runs` | The pub runs, with dates from the socials calendar |
| `/results` | Find your name, the monthly handicap, the championship, club records |
| `/results/handicap/[date]` | One handicap night's result |
| `/contact` | The committee, as roles with club email addresses, and who to email about what |
| `/welfare` `/inclusion` `/privacy` `/rules-and-constitution` | From the `legal` collection via `[legal].astro` |
| `/club-kit` | Placeholder |
| `/404` | Styled, with links back to the main pages |
| `/rss.xml` `/robots.txt` `/sitemap-index.xml` | Generated |

---

## External requests

**The site makes none in normal use.** Verified against the built output: the
only third-party hosts referenced are in link `href`s the reader chooses to
follow — Facebook, Instagram, Strava, England Athletics, the races' entry
pages, and `wa.me` for the share links.

**Fonts are self-hosted.** Outfit and Inter are downloaded **at build time** by
Astro's Fonts API and served from our own domain as two `.woff2` files. There is
no `fonts.googleapis.com` or `fonts.gstatic.com` request from any page — Google
sees the build machine, not the reader. This was deliberate: it removes a
third-party request that would otherwise need explaining on the privacy page.

Astro also generates metric-matched fallbacks (`size-adjust`, `ascent-override`
and the rest, tuned to Arial) so text does not shift when the real font swaps in.
**Do not replace this with `@fontsource`** — that ships the files and nothing
else.

**One CDN script exists, and only on `/admin`:**

```
https://unpkg.com/@sveltia/cms@0.205.1/dist/sveltia-cms.js
```

That is the CMS itself, pinned to an exact version, on a page no visitor sees and
which is `noindex` plus GitHub-authenticated. Worth knowing in a review: it is
the one place anything depends on a third party at runtime. If unpkg were
unavailable the CMS would not load; the published site would be unaffected.

**The build itself does talk to Google**, from the build machine and never from
a visitor's browser: the fonts, and the two results sheets, which are published
as CSV and read on every build. [docs/results.md](docs/results.md) has the
sheets and what happens when one cannot be read.

**JavaScript on the public site is a short, named list of small scripts**, all
progressive enhancement — every page works with JS off. CLAUDE.md lists them
and the rules for adding another.

---

## Deployment

**Push to `main` and it deploys.** Cloudflare Workers Builds watches the GitHub
repository, runs `npm run build`, and serves `dist/` as static assets. There is
no manual deploy step and no `wrangler deploy` in the normal flow.

Two consequences worth understanding:

- **A CMS save is a deploy.** Sveltia commits to `main`, which triggers a build.
  A committee member publishing a race report is doing the same thing a developer
  does with a push.
- **Promoting a deployment in the Cloudflare dashboard is not merging.** It
  changes what is served now; the next build still comes from `main` and will
  overwrite it.

`wrangler.jsonc` is assets-only with no `main` script, deliberately. Without the
file, Wrangler tries to detect a Worker, silently runs `astro add cloudflare`,
and bolts on the SSR adapter — which swaps the build-time Sharp pipeline for a
runtime one and breaks every image on the site.

**A second, separate Worker** lives in `workers/diary-rebuild/`. It runs on a
nightly cron and pings a deploy hook, so the race diary rolls forward — past
races drop off and the twelve-month window moves — and the results sheets and
the club's Google calendars stay current, without anyone touching it. It is
deployed independently and shares nothing with the site. See
[workers/diary-rebuild/README.md](workers/diary-rebuild/README.md).

**A third Worker** lives in `workers/cms-auth/`: it signs committee members in
to the CMS. Nothing on the public site touches it, and it is deployed by hand.
See [workers/cms-auth/README.md](workers/cms-auth/README.md).

**What keeps the site current overnight, and what says so when it breaks:**

| When (UTC) | What | Where |
| :-- | :-- | :-- |
| 02:17 | The club calendars are downloaded and committed if they changed | `.github/workflows/fetch-calendars.yml` |
| 04:00 | The site is rebuilt, reading the results sheets afresh | `workers/diary-rebuild/` |
| 04:45 | The build is checked, and an issue is opened and emailed if it fails | `.github/workflows/build-check.yml` |

GitHub often starts the first and third late, sometimes by hours. The build
check also runs on every save. [docs/handover.md](docs/handover.md) covers the
alerts and who receives them.

---

## The two schemas

`src/content.config.ts` and `public/admin/config.yml` describe the same fields
twice: once for Astro to validate against, once for the CMS to build a form from.
**A change to one is a change to the other, in the same commit.**

If they drift, the CMS accepts a post that the build then rejects, and the
failure lands on the committee member who wrote it — the exact thing the CMS
exists to prevent.

`npm run check:cms` guards this and fails the build. It checks three things:

1. **Every frontmatter key is declared by a CMS field.** An undeclared key is
   invisible in the editor, and Sveltia rebuilds each file from the fields it
   knows about — so editing such an entry **drops the key on save**.
2. **Every image path resolves on disk.** Deleting a race report through the CMS
   once removed every photo in a shared folder, orphaning paths in twenty other
   posts.
3. **Every menu link points at a real page.** The menus are content now, so an
   editor can mistype an address into the header of every page.

It checks one direction only: that the CMS knows about everything in the
content files. It does not check that everything the CMS will accept is
something the build will accept. The two were tested against each other by
hand on 15 November 2026 and agreed; keeping them that way is still the rule
above, not the script.

`npm run check:diary` is advisory and does not fail the build. It lists diary
entries whose newest published report is over three years old — the age that, in
the first review of the seed data, predicted being wrong almost perfectly.

---

## Known trade-offs

Things a reviewer will notice, and which are choices rather than oversights:

**Every imported image is built twice and one copy is never used.** Astro emits
the original alongside each derivative, and the HTML only ever points at the
derivative. That leaves roughly 7 MB of `dist/_astro` deployed and publicly
reachable but referenced by nothing. It costs no visitor bandwidth, and it is
the largest remaining item in the build.

This entry used to read "images are not resized", on the grounds that
Cloudflare's builder cannot run Sharp. That was tested on 12 September 2026 and
is false — see the comment in `astro.config.mjs`. The GitHub Actions plan that
depended on it has been dropped.

**`site` is `chardroadrunners.com`, which does not resolve yet.** DNS is not
pointed there, so canonical URLs, RSS items and share links name a domain that is
not live. Correct for a pre-launch site; resolves on launch day.

This is **held deliberately**, not outstanding. The domain stays unpointed
until the committee have given a green light and the maintainer is happy with
the site — so an unresolving domain is the current state working as intended,
not a job somebody has forgotten. Pointing it also publishes the domain in
public certificate transparency logs, which is its own reason not to do it
early.

**Empty sections and `TODO` markers in content.** Where a club fact has not
been decided yet, the content file leaves a clear gap rather than inventing
one: the project's rule. `grep -rn TODO src/content` lists what is left.
Anything still reading `TODO` is stripped from the rendered page rather than
shown to visitors.

---

## Before you judge anything

**`PRE_LAUNCH` in `src/consts.ts` is `true`.** While it is, every page carries
`noindex, nofollow` and `/robots.txt` disallows everything. The site is built,
deployed and readable by anyone with the address — it is simply not findable.
Setting it to `false` is the launch switch, and the build prints a reminder until
somebody does.

It is **not** security. This repository is public and nothing on the site is
private.

[docs/launch-checklist.md](docs/launch-checklist.md) is the full list of what has
to happen before launch, and the one thing that has to happen on the day.

---

## Accessibility and colour

The palette is three blues and a dark purple, and two of the blues fail on white.
This has caused real bugs — a button that shipped at 1:1 contrast, five body
links at 2.41:1 — so the rules in CLAUDE.md are firm and every number is measured
from rendered pixels rather than judged by eye.

The short version:

- Dark purple on white; chalk or white on purple. **Never pale blue as text on a
  light background.**
- Buttons carry an explicit foreground colour different from their fill.
- Links in body copy are underlined. Colour alone is not a signal, and a hover
  state does not exist on a phone.
- The contour motif sits at 0.25 opacity wherever text is on top of it. At the
  0.5 used for bare decoration, white text over the lightest stroke measures
  4.13:1 and fails.

If a change alters a colour, measure it.

**Which colour each section of a page gets is a rule too** — the colour rule
in CLAUDE.md, set 19 November 2026: purple banner first, then white and pale
purple taking turns through `Band.astro`, never two of the same touching.

---

## Where the detail lives

| | |
| :-- | :-- |
| [CLAUDE.md](CLAUDE.md) | How the project works, the rules that are not obvious from the code, and why. **The most useful single file.** |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Everything still to do before launch |
| [docs/content-model.md](docs/content-model.md) | The collections and their frontmatter rules |
| [docs/handover.md](docs/handover.md) | The CMS, the build alerts, and the things that have bitten us |
| [docs/results.md](docs/results.md) | The championship and handicap sheets, how they reach the site, and what stops the build |
| [docs/handicap.md](docs/handicap.md) | The handicap rules, the sheet and the timing page |
| [docs/race-diary.md](docs/race-diary.md) | How the race diary works, and why it is deliberately vague about dates |
| [docs/pub-runs.md](docs/pub-runs.md) | The pub runs page |
| [docs/old-site-urls.md](docs/old-site-urls.md) | The old Webador addresses and where each one redirects |
| [crr-sitemap.md](crr-sitemap.md) | Page structure and the content plan |
| [workers/diary-rebuild/README.md](workers/diary-rebuild/README.md) | The nightly rebuild, how to set it up again, and the four ways it can look set up when it is not |
| [workers/cms-auth/README.md](workers/cms-auth/README.md) | CMS sign-in: where it came from, how to deploy it, and the one setting nobody should "fix" |
