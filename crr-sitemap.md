# Chard Road Runners — Sitemap & Page Structure

Draft v1. Built from the existing Webador site content. Dates and details carried over as-is and flagged where they need checking.

---

## Navigation

**The menus are content, not code.** They live in
`src/content/navigation/navigation.md` and are editable in the CMS, so this
section describes the intent — the file is what the site actually renders. The
build fails if a menu item points at a page that does not exist.

Six top-level items. Anything more and the mobile menu becomes a list nobody
reads.

```
Join us         (how to turn up, membership, Couch to 5k)
Our races       (Chard Flyer, Forde Abbey 10k)
Calendar        (club nights, socials, races, race diary)
Results         (championship, handicap, records)
Race reports    (race reports + club news)
Contact
```

Ordered by what a newcomer wants first: joining, then the club's own races,
then when things happen, then how we did, then the writing, then how to ask.

**No Home item.** The logo links to `/` from every page, which is where people
look for it, and a menu item saying the same thing spent a slot. The 404 page
writes its own Home button rather than picking one out of the menu.

Calendar and Results were one item to begin with. They answer different
questions — "when is the next race" and "how did we do" — and a single page
doing both buried the calendar under standings tables.

**Join us is also a button in the header,** shown on every page at every width.
The menu hides behind a hamburger below 1024px, and joining is the one thing
the site is actually asking a visitor to do. Pale blue fill, dark purple text,
measured 6.34:1 — a placeholder until the accent colour is settled, at which
point it may become the sky blue's 8.67:1.

### Footer

Three columns, wrapped in one `<nav aria-label="Footer">`:

| Looking after you | The Club | Connect |
|---|---|---|
| Welfare | Rules & constitution | Facebook |
| Inclusion | Club kit | Strava |
| Privacy | Pub runs | England Athletics |

Moving "Boring legal stuff" to the footer frees a nav slot without hiding
anything. Welfare stays first in the first column — it should be findable in
one click from any page.

Race Calendar is deliberately gone: it pointed at `/calendar#race-calendar`
while the top menu already carries Calendar.

The column headings are styled text rather than `<h3>`, because as headings
they would put a 1 → 3 skip into the outline of every page — `/club-kit` has an
h1 and nothing else. Each list is named by its heading through
`aria-labelledby` instead, so the groups are announced without that cost.

---

## 1. Home

The job: a first-time visitor understands the club in 10 seconds and knows how to turn up.

| Section | Content |
|---|---|
| Hero | Club name, LIDAR contour backdrop, one line: "Sociable England Athletics affiliated running club in Chard, Somerset. Established 1981." Primary button: **Join Us**. Secondary: **Club Nights** |
| Club nights | Tuesday 7pm and Thursday 7pm, Chard Cricket Club. Tuesday: up to three pace groups, 5–6 miles slowest to ~10 miles fastest, showers and bar after. Thursday: shorter and slower, suits beginners and improvers. Everyone welcome |
| What makes us different | Monthly handicap race and bake off on the last Tuesday of the month |
| Couch to 5k | Next course dates, venue, cost, target race. **Needs current dates — the live site still shows 9th April** |
| Latest news | Three most recent race reports, auto-pulled |
| Next events | Three next entries from the race calendar, auto-pulled |
| Our races | Chard Flyer and Forde Abbey 10k cards |

---

## 2. Join Us

Merges the current Home-page joining instructions with the membership form page.

- Who the club is for — all paces and abilities, no minimum speed
- What to expect on a first visit: where to park, what time to arrive, who to look for, that you don't need to be a member to try it
- Membership: Connect My Club, code `67a1c8f4`
- What membership includes — England Athletics affiliation, race discounts, championship entry, club kit access
- Fees and renewal date
- Couch to 5k: 18+, free to join, one-hour weekly sessions, medal at the end
- Contact: chardroadrunners@hotmail.com

---

## 3. Race Reports

The blog. This is the piece the current site is missing entirely and the reason members will come back.

- **Index**: card grid, newest first, image + title + date + two-line excerpt
- **Filters**: Race Report · Club News · Couch to 5k · Social
- **Post page**: title, date, author, hero image, body, photo gallery, results table if relevant, links to the next and previous posts
- Each post gets its own image and description tags so it looks right when shared to Facebook

**Content model** — every post carries: title, date, author, category, race name, distance, hero image, gallery, excerpt.

---

## 4. Our Races

Landing page covering both club-hosted races, then one page each.

**Chard Flyer** — 1st January, 10k, first race in the Somerset Series, route around Chaffcombe, Knowle St Giles and Chard Reservoir.

**Forde Abbey 10k** — usually a Wednesday evening in June.

Each race page: date, distance, entry link, route map and elevation, start time, parking, facilities, prizes and categories, previous years' results, photos, volunteer sign-up.

---

## 5. Calendar

Two calendars, in this order, kept visibly separate so nobody has to guess
which is which.

- **Club calendars** — five public Google calendars (club nights, socials,
  races, championship, club races), read at build time and rendered as ordinary
  HTML. No iframe and no third-party request: the only fetch happens on the
  build machine. IDs are `CALENDAR_IDS` in `src/consts.ts`. A feed that stops
  being public fails the build rather than emptying a page quietly.
- **Race diary** — from the `calendar-events` collection. Twelve months rolling,
  grouped by month, each entry linked to the race reports that mention it.
  Dates worked out from a rule are shown as approximate and never as a specific
  day. See `docs/race-diary.md`.

---

## 6. Results

Everything here reads from Google Sheets, so you keep editing where you already edit.

- **Club Championship** — current standings table, sortable, plus the scoring rules and which races count
- **Monthly Handicap** — latest month's results and the running standings
- **Club Records** — by distance and age category

---

## 7. Contact

- General enquiries email
- Committee list with roles
- **Welfare Officer** — name and contact, given its own visible block
- Where we meet, with a map
- Facebook and Strava links
- New members: a short "just turn up" note so nobody feels they have to email first

---

## Footer pages

- **Welfare** — policy plus the welfare officer's contact
- **Inclusion** — carried over as-is
- **Rules and Constitution** — carried over as-is
- **Privacy** — needed once you have any form or photo of a member
- **Club Kit** — photos, sizes, prices, Pantone-correct colours, order by email
- **Pub Runs** — the monthly summer pub runs and the annual Pubs Run. Kept at
  `/pub-runs`, the slug the old Webador site used. Dates come from the socials
  calendar; see `docs/pub-runs.md`.

---

## Content types to set up

These are the collections you'll define once and reuse:

1. `post` — race reports and news
2. `race` — the two club-hosted races
3. `calendar-event` — dated entries for the race calendar
4. `committee` — name, role, contact
5. `kit-item` — photo, name, sizes, price

Everything else is a static page you edit directly.

---

## Open questions

- Couch to 5k: current dates and next course
- Membership fee and renewal date
- Committee list and roles
- Does the club want a members-only area, or is everything public?
- Photo consent — worth a line in the privacy page before publishing galleries
