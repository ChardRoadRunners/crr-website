# Results — the club championship on the website

How the championship standings get from a runner's phone to the results page,
and what to do when they stop.

The scoring backend is a Google Sheet the committee owns. The website reads the
finished table and renders it. **Nothing on the website works out any points.**
That is deliberate: two places calculating the same table is two answers to
"how many points have I got", and the sheet is the one the committee can open
and see working.

---

## The chain, end to end

1. A runner finishes a championship race and fills in the **Google Form**.
   No form, no points — that is the club's rule, not the website's.
2. The form drops a row into the sheet's `Form responses` tab.
3. Formulas on `Scored` rank the Chard runners in each race and award points.
4. `Standings` assembles the table: a row per runner, a column per race.
5. **Standings is published to the web as CSV.** One address, one tab.
6. The site build fetches that CSV, parses it, and renders two tables.
7. The nightly rebuild runs the build again, so yesterday's results appear.

Steps 1 to 4 are somebody else's documentation — the sheet's own `Start here`
tab explains them to the committee. This file covers 5 to 7.

---

## The sheet

- Google Drive, club account `chardrunners@gmail.com`, folder **Results**
- **CRR Championship 2026** —
  <https://docs.google.com/spreadsheets/d/16gfBYYzjsqyFVzjYG8Q1VZjSnAZusGnUMV4FtvQjqGU/edit>

| Tab | Who edits | The website |
|---|---|---|
| Start here | — | ignores |
| **Standings** | formulas | **reads this one** |
| Races | committee | ignores |
| Runners | committee | ignores |
| Points (manual) | committee | ignores |
| Form responses | the form | ignores |
| Scored | formulas | ignores |
| Settings | committee | ignores |

---

## Publishing the Standings tab

**This is the one step that turns the section on.** Until it is done the page
says the standings are not ready yet, which is true and is not an error.

1. Open the sheet.
2. **File → Share → Publish to web.**
3. In the first dropdown pick **Standings** — *not* "Entire document".
4. In the second pick **Comma-separated values (.csv)**.
5. Open **Published content & settings** and set it to **Standings** too.
6. Leave **Automatically republish when changes are made** ticked.
7. **Publish**, and copy the address Google gives you. It looks like
   `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=…&single=true&output=csv`
8. Paste it into `CHAMPIONSHIP_CSV_URL` in `src/consts.ts`, commit, push.

**Publish the Standings tab and nothing else.** "Entire document" would also
publish `Form responses`, which is every submission exactly as it was typed.
The tidied, checked names on `Standings` are what belongs on a public page.

**The dialog has two settings, and the second one is what protects you.** The
first dropdown only picks which tab the link points at. **Published content &
settings**, further down, decides what is published. Left on "All sheets",
every tab is readable by anyone who changes the `gid=` number at the end of
the link, even though the link itself shows only one. Set it to the one tab.
Found while publishing the handicap on 28 Oct 2026.

Publishing makes that one tab readable by anyone who has the address. That is
fine here — it is names and points that are going on a public web page anyway —
but it is worth knowing it is not a private link.

### Why publish-to-web rather than the Sheets API

The API needs a key, the key needs somewhere to live that is not a public
repository, and somebody has to rotate it when it leaks. Publish-to-web needs a
URL. For a table that is already going to be public, the API buys nothing and
costs a secret to look after.

---

## What the website expects of the Standings tab

Read by `src/utils/championship.ts`, pinned by `scripts/check-championship.mjs`.

- Row 1 is headers. **Columns are found by their heading, never by position**,
  so adding the sixteenth race does not break anything. Rename a heading and
  the build fails, naming the heading — that is on purpose.
- `Name` and `M or F` come first.
- Then one column per race, headed with the race name from the `Races` tab.
  Unused slots have blank headings and are ignored.
- Then `Bonus`, `Races run`, `Points so far`, `Position`,
  `Championship score`.
- Rows run to 1000 and go blank after the last runner. Blank names are dropped.
- **A blank race cell means "did not run". A `0` means "ran, and finished
  eleventh or lower among the Chard runners".** Those are different facts and
  the page shows them differently — a dash and a nought.
- `Position` is the rank within gender on `Points so far`. Ties share a
  position, and the page keeps them both.

### What fails the build, and why

Everything below stops the deploy rather than rendering a half-right table. A
standings page that quietly loses runners is worse than a red build: it is
wrong in a way that looks right, and the people it is wrong about are named
on it.

| What happened | What you see |
|---|---|
| The tab was un-published | "the tab is no longer published", with the menu path |
| Google served a sign-in page with a 200 | "returned an HTML page rather than CSV" |
| A summary heading was renamed | the heading it wanted, by name |
| A different tab got published | "that usually means a different tab got published" |
| A runner has no M or F | the runner's name, and where to fix it |
| A formula is erroring in a cell | the runner and the race |
| Google rate-limited the build | retried five times with backoff, then says so |

The one thing that does **not** fail the build is `CHAMPIONSHIP_CSV_URL` being
empty. That is the not-published-yet state, and it has its own wording on the
page.

---

## How it looks on the page

Two tables per gender, because the championship ranks men and women separately
and always has.

- A **summary** table — position, name, races run, points. Four columns, so it
  fits a 320px phone without scrolling. This is what almost everybody came for.
- The **race-by-race grid** underneath, which is the table the club has always
  published. Twenty-two columns will not fit a phone at any useful size, so it
  sits in a region that scrolls sideways, with the name column pinned and the
  region announced to screen readers as scrollable and keyboard-focusable.

### Not sortable, and why

`crr-sitemap.md` says "sortable". It is not, and that was a decision rather
than an omission.

Sorting needs client-side JavaScript, and CLAUDE.md keeps a list of exactly two
scripts that have earned their place. A third would have to beat the question
"who wants this table in a different order?" — and a championship table has one
order anybody has ever asked for, which is the one it is already in. The
alphabetical order lives on the sheet for anybody who needs it.

If somebody does ask for it, it has to be progressive enhancement: the table
server-rendered and sorted first, the buttons `hidden` in the HTML and revealed
by the script. And it goes on the list in CLAUDE.md in the same commit.

---

## When results appear

The site is static. A page only knows what was true when it was last built, so
a result submitted at lunchtime does not appear until the next build. The
nightly rebuild in `workers/diary-rebuild/` is what makes that "tomorrow"
rather than "whenever somebody next pushes a commit". The page says so, under
the date.

---

## Open questions — not the website's to answer

These came over from the backend notes and are still open. None of them stops
the page working; all of them are things a committee member has to decide.

- **What "2 points for every race more than the 7" means.** The sheet assumes
  two points per race beyond the best seven, and the `Championship score`
  column rests on that reading. The page carries a note saying the column is
  provisional — clear `championship.scoreNote` in
  `src/content/pages/results.md` once it is confirmed, and the note disappears.
- ~~**Haselbury Trail Race (5 Aug)** was run but is not entered.~~ **Done** —
  entered 27 September 2026, through the form.
- **Two gaps in the 2026 PDF.** Men's Ilminster has two 8s and no 7; women's
  Crewkerne goes 10, then 8, with no 9. Both are loaded exactly as published
  and flagged in the `Note` column on `Points (manual)`.
- **Spellings.** Checked against the committee on 28 September 2026. Three
  looked wrong; one was not:

  | On the sheet | Verdict |
  |---|---|
  | `Mathew Glastonvill` | **Correct as it stands.** No `e` — the name comes from Aston and Glanvill, also without one. Leave it alone. |
  | `Marek Wegrzyowski` | Typo. Should be **Wegrzynowski** — an `n` is missing. |
  | `Aga Maslikiewizc` | Typo. Should be **Maslikiewicz** — the `zc` is the wrong way round. |

  The two typos are still to be fixed, and **fixing a name is a two-tab job** —
  see below.

---

## Why the form is not linked from the website

**A decision, not an oversight.** `championship.formUrl` in
`src/content/pages/results.md` is deliberately empty, so no "Submit a result"
button renders. **Members get the form's address from the club's WhatsApp
community, in the `Championships Chat` group.**

The website is public and the form accepts a submission from anybody who
opens it, so a button would put a one-click path to it in front of the whole
internet. Where the link lives now is a closed group of club members, which is
a real difference and not just a quieter one: to post a fake result you would
first have to be in the community. A button on the results page would remove
that step for everybody.

It is still not access control — the form itself lets anyone who has the
address post to it, and a link pasted out of a WhatsApp group travels like any
other. But the set of people holding it is small and known, which is about as
good as a Google Form gets without collecting sign-ins.

### What a bad submission could actually do

Worth knowing, because it is sharper than "somebody types nonsense":

- **Nonsense mostly bounces.** Both the name and the race are dropdowns built
  from the `Runners` and `Races` tabs, so a stranger cannot invent a runner or
  a race. `Scored` marks an entry `Counts? FALSE` if the name is not on
  `Runners`, or the time or age grade is missing.
- **Impersonation is the real risk.** Somebody can pick a real member's name
  off the dropdown and submit a time. That scores points for them and pushes
  every genuine runner behind them down a place.
- **And it can overwrite.** The latest submission for a name and race wins, by
  design, so a fake entry replaces that member's real result rather than
  sitting beside it.

### What actually protects the results

Not the missing button — every submission is kept, timestamped, in
`Form responses`, and **deleting the row puts everything back**. The standings
recalculate, and the site catches up at the next nightly rebuild. That is why
this is a nuisance rather than a disaster, and why it is worth a glance down
`Form responses` after a race rather than any heavier defence.

Things deliberately NOT done, and why:

- **Requiring a Google sign-in** (Form settings > "Limit to 1 response") would
  stop casual impersonation, but it collects the respondent's email address
  into the sheet. `CLAUDE.md` says only names and finishing times go in that
  sheet, and it shuts out any member without a Google account.
- **Collecting email addresses** for an audit trail: same objection.

If the form ever does get abused, deleting the rows is the first move and
turning on sign-in is the second — accepting the privacy cost knowingly rather
than by default.

---

## Renaming a runner — read this first

A runner's name is the join between three tabs, so **correcting a spelling in
one place silently deletes their points.**

`Standings` has one row per name on `Runners`. `Points (manual)` and
`Form responses` are matched to that row **by the name as typed**. Change
`Runners` on its own and the old rows match nobody: they do not error, they
just stop counting, and the runner's total quietly drops.

Both of the misspellings above are the worst case for this, because almost all
of what they have came in by hand rather than through the form:

- `Aga Maslikiewizc` — one bonus point, from `Points (manual)`. Fix `Runners`
  alone and she goes from 1 point to 0.
- `Marek Wegrzyowski` — Yeovil Half Marathon 10, plus a bonus point, both from
  `Points (manual)`. Fix `Runners` alone and he goes from 11 points to 0.

Neither has submitted anything through the form, so `Form responses` does not
need touching for these two. That will not be true of the next one.

### The order to do it in

1. Change the name on **`Runners`**.
2. Change **every** row for that person on **`Points (manual)`** — use
   Edit > Find and replace, scoped to that sheet, so none is missed.
3. Change **every** row for that person on **`Form responses`**, if they have
   submitted anything. Editing the tab is safe; the form writes new rows below.
4. Run **Championship menu → Update form lists**, or the form keeps offering
   the old spelling and the next submission will not match.
5. Check the **`Scored`** tab for `?`, which is what it shows when a name or
   race does not match the lists. None means every row still found its runner.
6. Confirm the runner's `Points so far` on `Standings` is what it was before.

The website needs no change at all: it reads `Standings`, so a corrected name
appears on the site at the next nightly rebuild.

---

## Handicap and records

Neither has a backend yet. Both sections say so in their own words, from
`src/content/pages/results.md`.

When they get one, `src/utils/sheet.ts` is the part worth reusing — it reads
any published tab as CSV, with the retries and the failure messages already
written. The championship-specific shaping is all in `championship.ts`.

---

## Where everything is

| What | Where |
|---|---|
| The published CSV address | `CHAMPIONSHIP_CSV_URL` in `src/consts.ts` |
| The season shown in the heading | `CHAMPIONSHIP_SEASON` in `src/consts.ts` |
| Reading a published tab | `src/utils/sheet.ts` |
| CSV parsing | `src/utils/csv.ts` |
| Turning Standings into tables | `src/utils/championship.ts` |
| The tables themselves | `src/components/ChampionshipStandings.astro` |
| The page | `src/pages/results.astro` |
| All the wording | `src/content/pages/results.md`, editable at `/admin` |
| The checks | `scripts/check-championship.mjs` (`npm run check:championship`) |

---

## The monthly handicap

The same arrangement, from a different sheet. The handicap is timed on the
night with the timing page in **CRR Handicap** (club Drive, Results > Handicap),
and saving a race writes it to that sheet's History tab. See docs/handicap.md.

| Tab | The website |
|---|---|
| **Results** | **reads this one** |
| everything else (Runners, History, Timing, Settings with the PIN…) | ignores |

**Results** is the public slice of History, worked out by a formula: one row
per runner per handicap that has a position or a winner, newest first. Its
columns are `Date` (YYYY-MM-DD), `Race`, `Position`, `Name`, `Run time`,
`Start time`, `Winner` and `First handicap`. Simon's notes are deliberately not
on it.

### Switching it on

**Done 28 Oct 2026.** The Results tab is published and its address is in
`HANDICAP_CSV_URL`. The steps, for setting it up again:

1. Open CRR Handicap. **File → Share → Publish to web.**
2. First dropdown: **Results**, *not* "Entire document" — the Settings tab has
   the timing page PIN on it.
3. Second dropdown: **Comma-separated values (.csv)**.
4. Open **Published content & settings** and set it to **Results** too. See
   the note under *Publishing the Standings tab*: this is the setting that
   keeps the other tabs private.
5. Leave **Automatically republish when changes are made** ticked.
   **Publish**, copy the address.
6. Paste it into `HANDICAP_CSV_URL` in `src/consts.ts`, commit, push.

Read by `src/utils/handicap-results.ts`, pinned by
`scripts/check-handicap-results.mjs`. Columns are found by name. What fails the
build: a missing column, a date that is not YYYY-MM-DD, two winners on one
night, two runners in one position, a position that is not a whole number.
An empty `HANDICAP_CSV_URL` does not — the section says the results are not
published yet.

Nights before October 2026 came from Simon's spreadsheet with only the winner
recorded, so they show as a date and a winner with nothing to open. From
October on, every night has the full result.

### A page for each night

Every handicap in the Results tab also gets its own page,
`/results/handicap/<date>/` (for example `/results/handicap/2026-10-27/`), made
by `src/pages/results/handicap/[date].astro`. It has the winner, two highlights
(the quickest run, and whoever finished furthest under their start time,
leaving out first handicaps), the full result with a "vs start" column, share
links, and links to the nights either side. The Results page shows the latest
night in full and lists every night, each linking to its page; the homepage and
News will link to them too.

Nobody writes these pages. A night appears the morning after it is saved in the
sheet. The only sums on them are time differences (run time minus start time,
for "vs start" and the highlights); positions and the winner are exactly what
the timing page saved. While `HANDICAP_CSV_URL` is empty there are no nights, so
no pages are built.

The share preview is the site's usual contour card for now. A card with the
winner's name on it, as sketched on the design canvas, needs the build to draw
text into an image, and is a separate piece of work.

---

## Where results show up besides this page

Decided with the club on 28 October 2026, after the "results and news"
sketches went round: results should not live only two taps deep.

| Where | What | Made by |
|---|---|---|
| **Homepage**, "What's happening", straight under the hero | The latest handicap (winner, top three, link to the night), the championship leaders and how many races have been run, what is coming up, the latest posts | `src/components/WhatsHappening.astro` |
| **News page**, `/news/` (footer link "Club news") | Every handicap night among the race reports and club news, newest first | `src/pages/news/index.astro`, merged by `src/utils/news.ts` |
| **Results page** | Section links, **Find your name**, then the handicap, the championship and records, newest first | `src/pages/results.astro` |

All three read the same two published tabs as everything above, so nothing new
needs publishing and a correction in a sheet reaches all of them at the next
rebuild. Every word around the numbers is in `src/content/pages/` (`home.md`,
`news.md`, `results.md`), editable in the CMS.

### Races run so far

"13 of 15 races run" and "Still to come: Herepath Half and The Full Monty" are
counted from the Standings tab: a race column where anybody has a result (a 0
included) has been run, one where nobody does is still to come. That is a count
of what the sheet shows, not scoring — `racesScored` in
`src/utils/championship.ts`, pinned by `npm run check:championship`.

### Find your name

A search box at the top of the Results page: type part of a name and see that
runner's championship standing and every handicap they have run, each line a
link to where it comes from. Built at Jack and Wayne's request.

- The lines are written at build time by `src/utils/find-your-name.ts`, from
  the same standings and handicap results the page shows, worded from
  `search` in `results.md`. The browser only filters them.
- Names are matched ignoring case, accents and hyphens. A runner spelled two
  ways on the two sheets shows as two runners — fix the spelling in the sheet.
- It needs JavaScript, so it is hidden without it, and the page is otherwise
  unchanged. It is the third script on the site; see CLAUDE.md.
- **Worth the committee knowing:** it gathers one person's results in one
  place. Nothing in it is not already public on the site.

Races are not searchable yet; that was a "maybe" and can be added to the same
box later.

### The next handicap night

The homepage's "Coming up" includes the next handicap once it is on the club's
**Club nights** Google calendar, as any event with "handicap" in its title.
Nothing works the date out: until somebody adds it to the calendar, it does not
show. The calendar is downloaded overnight (see CLAUDE.md), so a new entry
appears the next morning, or straight away if the calendar
workflow (Actions tab, "Fetch calendars") is run by hand.
