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

Node 22.12 or newer. Eight runtime dependencies, one dev dependency (`yaml`, used
by the schema-drift check). `sharp` resizes and converts every image at build
time, on Cloudflare's builder as well as locally.

---

## Getting it running

```
npm install
npm run dev          # localhost:4321
```

| Command | What it does |
| :------ | :----------- |
| `npm run dev` | Local preview with hot reload |
| `npm run build` | Runs both checks, then builds to `dist/` |
| `npm run preview` | Serve the built output |
| `npm run check:cms` | Assert the two schemas still describe the same fields |
| `npm run check:diary` | List race diary entries running on stale evidence |

`npm run build` runs the checks first and **fails the build** on schema drift.
That is deliberate — see [The two schemas](#the-two-schemas).

`.claude/launch.json` is kept on purpose. It tells Claude Code's browser
preview how to start this project's dev server — `npm run dev` on port 4321 —
so a preview can be opened without a server being started by hand first. It
affects nothing about the site or the build, and deleting it only means
starting the server manually.

---

## Folder layout

```
src/
├── components/     19 Astro components
├── content/        all editable content, as Markdown
│   ├── race-reports/     22 posts, with an images/ folder beside them
│   ├── races/             2 club races, with images/
│   ├── pages/             3 one-off page copy files
│   ├── legal/             4 policy pages
│   └── calendar-events/  29 race diary entries
├── layouts/        Layout.astro (site shell), BlogPost.astro (race reports)
├── pages/          routes — file name becomes URL
├── styles/         app.css (theme + utilities), global.css (element defaults)
├── utils/          date, distance, markdown and race-report helpers
└── assets/         logo and contour SVGs, processed at build time

public/             served verbatim — favicons, logo, /admin
scripts/            two build-time guards, described below
workers/            a second, separate Cloudflare Worker (nightly rebuild)
docs/               the reference documents listed at the end
```

---

## Content collections

Five, all in `src/content/`, each with a Zod schema in `src/content.config.ts`.

**`race-reports`** — race reports and club news, 22 posts. One entry per race in
a `races` array, so a weekend round-up covering three races sorts and links
correctly. There is no top-level date field: posts sort by the **earliest**
`raceDate` in that array, so nothing can drift out of sync. `draft: true` hides a
post.

**`races`** — the two club-hosted races. Entry links only render when
`entriesOpen` is true, which is what stops a dead entry link sitting on the page
for eleven months of the year.

**`pages`** — copy for `home`, `join-us` and `contact`. A discriminated union:
each page has its own shape, picked by the `page` field, so a validation error
names the field that is wrong rather than listing every page's fields at once.

**`legal`** — welfare, inclusion, privacy, rules and constitution. One shared
shape, and the only collection whose Markdown body becomes the page. A new file
gets a route automatically from `src/pages/[legal].astro`, but its footer link
still has to be added to `FOOTER_PAGE_LINKS` in `consts.ts`.

**`calendar-events`** — the race diary, 29 entries. The unusual one, and worth
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
| `/` | Hero, club nights, handicap, Couch to 5k, latest reports, next races, club races |
| `/join-us` | First visit, which night to pick, membership, Couch to 5k |
| `/race-reports` | Archive index, newest first, lead post spanning both columns |
| `/race-reports/[slug]` | A report: purple masthead, photo, body, gallery, share block |
| `/our-races` | The Chard Flyer and Forde Abbey 10k |
| `/calendar` | Club calendar (not yet connected) and the race diary |
| `/results` | Championship, handicap, records — all placeholders so far |
| `/contact` | Who to email and what about |
| `/welfare` `/inclusion` `/privacy` `/rules-and-constitution` | From the `legal` collection via `[legal].astro` |
| `/club-kit` | Placeholder |
| `/404` | Styled, with links back to the main pages |
| `/rss.xml` `/robots.txt` `/sitemap-index.xml` | Generated |

---

## External requests

**The site makes none in normal use.** Verified against the built output: the
only third-party hosts referenced are in link `href`s the reader chooses to
follow — Facebook, Strava, England Athletics, and `wa.me` for the share links.

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

**JavaScript on the public site is two small scripts**, both progressive
enhancement — every page works with JS off. CLAUDE.md lists them and the rules
for adding a third.

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
races drop off and the twelve-month window moves — and the club's Google
calendars stay current, without anyone touching it. It is deployed
independently and shares nothing with the site. See
[workers/diary-rebuild/README.md](workers/diary-rebuild/README.md).

---

## The two schemas

`src/content.config.ts` and `public/admin/config.yml` describe the same fields
twice: once for Astro to validate against, once for the CMS to build a form from.
**A change to one is a change to the other, in the same commit.**

If they drift, the CMS accepts a post that the build then rejects, and the
failure lands on the committee member who wrote it — the exact thing the CMS
exists to prevent.

`npm run check:cms` enforces this and fails the build. It checks three things:

1. **Every frontmatter key is declared by a CMS field.** An undeclared key is
   invisible in the editor, and Sveltia rebuilds each file from the fields it
   knows about — so editing such an entry **drops the key on save**.
2. **Every image path resolves on disk.** Deleting a race report through the CMS
   once removed every photo in a shared folder, orphaning paths in twenty other
   posts.
3. **Every content file is covered by a CMS collection.** A file nobody can edit
   is the failure this whole arrangement exists to avoid.

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

**Empty sections and `TODO` markers in content.** Three sections on the privacy
page, a committee list, several race details. All deliberate: the project's rule
is to leave a clear gap rather than invent club facts. Anything still reading
`TODO` is stripped from the rendered page rather than shown to visitors.

**The results page is placeholders.** Championship and handicap data will be read
from Google Sheets at build time; the sheet does not exist yet.

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

---

## Where the detail lives

| | |
| :-- | :-- |
| [CLAUDE.md](CLAUDE.md) | How the project works, the rules that are not obvious from the code, and why. **The most useful single file.** |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Everything still to do before launch |
| [docs/content-model.md](docs/content-model.md) | The five collections and their frontmatter rules |
| [docs/handover.md](docs/handover.md) | The CMS, and the things about it that have bitten us |
| [docs/race-diary.md](docs/race-diary.md) | How the race diary works, and why it is deliberately vague about dates |
| [crr-sitemap.md](crr-sitemap.md) | Page structure and the content plan |
| [workers/diary-rebuild/README.md](workers/diary-rebuild/README.md) | The nightly rebuild, how to set it up again, and the four ways it can look set up when it is not |
