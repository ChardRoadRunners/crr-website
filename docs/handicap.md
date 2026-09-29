# Monthly handicap — the sheet, the form, and the rules

**Status (29 Sep 2026): the sheet is built.** It is **CRR Handicap** in the
club Drive's Results folder. Its script is `sheets/handicap/scoring.gs` plus
`sheets/handicap/setup.gs`, pasted into the sheet's Apps Script. The form is
created from the sheet's own menu and has not been made yet. No results are
loaded yet: the club's back catalogue is being gathered. The website side is
not started.

Everything below came from the club, in conversation on 28–29 September 2026,
or from copy already on the website. Anything nobody has decided is in
**Open questions** at the end rather than guessed at.

---

## What the competition is

Last Tuesday of the month, with the bake off afterwards. From `home.md`, in
the club's own words:

> Our most common timed run format is a handicap 5km, we all run round the
> route together first and then everyone starts at a different time based on
> your 5Km time. The slowest goes off first, fastest last so in theory
> everyone finishes together.
>
> Other handicap events include; The mile, 1500m, 3000m out and back.

**Four distances: 5k, 3km, 1500m, 1 mile.**

**It is two different races under one name, and this is the thing to get
right:**

| | 5k | 3km, 1500m, 1 mile |
|---|---|---|
| Start | Staggered. Each runner's own start time | All together, on the gun |
| Handicap | Yes — from their last 5k | None |
| Winner | **First across the line** | **Best age grade %** |

**One trophy.** Whoever wins this month holds it until somebody takes it off
them next month — a current champion, not a points table. **There is no
season-long standings table**, which is a change from what `crr-sitemap.md`
assumes ("latest month's results and the running standings"). The sitemap is
out of date on this point.

---

## The scoring, precisely

### 5k handicap

- A runner's **handicap** is their finish time at the **most recent previous
  5k handicap**. Not this month's, and not a later one. Failing that, a
  **starting handicap** typed on the Runners tab: a 5k time the club already
  knew from before the sheet existed, which counts like a previous run.
- **First-timers race but cannot win.** Somebody with no previous 5k and no
  starting handicap is not placed; they appear on Not counted with that reason.
  Their time becomes their handicap for next month. On the night they start
  from a **first-run estimate** typed on the Runners tab. That is a guess for
  the starter only, and scoring never uses it.
- Times are the **runner's own watch**. There are usually timekeepers, but
  members time themselves, so the result is worked out from submitted times,
  not the order across the line. An app for timing on the night is a later idea.
- **Start offset** = (slowest handicap among those actually starting) − (this
  runner's handicap), **rounded to the nearest 5 seconds** because a person
  calls them from a stopwatch. The slowest runner goes off on 0:00.
- **Result** = finish time − own handicap. Lowest wins.

  That ordering *is* the finishing order, and it is worth seeing why: every
  runner's elapsed time from the gun is `slowest handicap + (finish −
  handicap)`, and the first term is the same for everybody. It also means the
  result does not shift depending on who turned up, which a raw elapsed time
  would.

- **Worked example.** Ann's handicap is 30:00, Bob's 25:00, Cat's 20:00. Ann
  starts on 0:00, Bob waits 5:00, Cat waits 10:00. Ann runs 28:00, Bob 25:00,
  Cat 20:00. Ann wins by two minutes despite being ten minutes slower than
  Cat, because she is the only one to beat her handicap. **The fastest runner
  is not the winner** — if that ever looks wrong on the sheet, the handicap is
  not being applied.
- **Offsets must come from who is actually starting.** If the slowest member
  stays at home and the sheet still bases offsets on their time, the whole
  field waits for somebody who is not there.

### 3km, 1500m, 1 mile

- Everyone starts together. **Ranked on age grade %, highest first.** Finish
  time decides nothing.
- No handicap is involved, so somebody brand new can run one and be placed
  immediately.

### Shared by both

- If a runner submits twice for the same race, **the latest submission wins** —
  same rule as the championship.
- A submission does not count if the name is not on the Runners tab, or the
  measure that decides that race is missing (finish time for a 5k, age grade
  for the others), or it is a 5k runner's first handicap run.
- **Ties share a place and the next one skips** (1, 1, 3), as the
  championship's Position column does.
- **One combined result**, men and women together.
- **Everybody who submitted should appear somewhere**, placed or with a reason
  they were not. A member left out of the results wants to know whether they
  were missed or whether their entry was no good, and a blank says neither.

---

## Privacy — this one is a constraint, not a preference

Age grading needs an age. **`CLAUDE.md` says only names and finishing times go
in a sheet that gets published**; dates of birth live in a separate,
never-published file.

**So the runner submits their own age grade %, and no date of birth goes
anywhere near this sheet.** That is exactly how the championship already
handles parkruns, so members have done it before.

Do not add a date-of-birth column and compute it, however convenient. If the
committee ever wants that, it is a decision to take deliberately, with the
ages held somewhere that is not published.

---

## Tabs

Mirror the championship workbook's shape and vocabulary — the same people
maintain both, and a familiar layout is worth more than a better one.

| Tab | Who edits | Purpose |
|---|---|---|
| Start here | — | Plain-English guide, as the championship has |
| **Results** | worked out | **The one the website reads.** One row per placed runner per race |
| Not counted | worked out | Submissions that did not score, and why. Checked after each race |
| Start list | worked out | Tick who is running; start times, and a list grouped by start time |
| Events | committee | Date · Distance · How it is decided · Form label (worked out) |
| Runners | committee | Name · M or F · Starting handicap · First-run estimate · Current handicap and From (worked out) |
| Settings | committee | The membership list's file ID |
| Form responses | the form | Created when the form is made. Past results are typed in here too |

### Events

`Date`, `Distance` (one of the four), `How it is decided` (`Handicap` or
`Age graded`). If `How it is decided` is left blank, the 5k is scored as a
Handicap and the rest as Age graded. It is editable, so an odd month can be
run differently without code changes. Seeded with 25 Aug and 29 Sep 2026, both 5k.

Races repeat monthly, so **a race is identified by date *and* distance** — the
name alone is not unique, unlike the championship. The form's dropdown needs
to say something like `27 Oct 2026 — 5k`.

### Runners

Seeded with the championship's 43 athletes, with three spellings corrected on
29 Sep 2026 (Matthew Glastonvill, Marek Wegrzynowski, Aga Maslikiewicz). The
same corrections were made in the championship sheet, so the lists match.

New names come from the **membership list** (below): Handicap → Add new
members from the membership list appends anybody missing, at the bottom, so
nobody's tick on the Start list moves. The Runners tab keeps its own copy
because Starting handicap and First-run estimate have to sit on the same row
as the name.

- `Starting handicap`: a 5k time the club knew from before the sheet.
- `First-run estimate`: a guess, so a newcomer can be given a start.
- `Current handicap` and `From`: written by the script. This is what each
  runner carries into the next 5k, and it is what the Start list uses.

Typing `24:30` into a time cell gets 24 *hours* from Sheets. The script and the
Start list both read anything over three hours as minutes and seconds, so
either `24:30` or `0:24:30` works.

### Start list

The thing that makes the sheet useful on the night, and it is ordinary
formulas, not script, because custom menus do not appear in the Sheets phone
app. A tick box per runner gives each one a start time. Slowest ticked runner
on 0:00. To the right, **Go at / Who / How many** groups the ticked runners by
start time, for whoever is calling the starts.

---

## The membership list

**CRR Membership List** in the club Drive's Membership folder: Name · M or F ·
Date of birth · Age (worked out) · Status (Member, EA member, Lapsed). It is the
one list of members that other sheets take names from.

**It holds dates of birth, so it is never published and is shared only with
named people.** The handicap script reads Name, M or F and Status from it and
nothing else. The championship sheet does not read from it yet; its Runners
tab is still its own list.

---

## The form

Same arrangement as the championship: created from the sheet, dropdowns fed
from the tabs, refreshable when the lists change.

| Question | Type | Notes |
|---|---|---|
| Your name | dropdown | From the Runners tab |
| Which race? | dropdown | From the Events tab, date and distance |
| Finish time | duration | Required. Decides the 5k; collected for the others too |
| Age grade % | number | Optional on the form, but it decides the 3km, 1500m and mile |

The race dropdown shows the six most recent events on the Events tab, newest
first. Handicap → Update form lists refreshes both dropdowns.

**Do not put a link to this form on the website.** The site is public and the
form takes a submission from anybody who opens it; members get the link from
the WhatsApp community. The reasoning is written up under "Why the form is not
linked from the website" in `docs/results.md` and applies identically here.

---

## What the website needs

Once the sheet exists, the website side is the same job as the championship
and the plumbing is already written — `src/utils/sheet.ts` reads any published
tab as CSV with the retries and failure messages done.

- **Publish the `Results` tab only**, as CSV (File > Share > Publish to web).
  Not "Entire document" — that would publish the raw form responses.
- Flat, one row per placed runner per race:
  `Date · Distance · Format · Place · Name · M or F · Finish time · Age grade % · Handicap · Start offset`
- Newest race first. From that one table the site can show the latest month's
  result, the current trophy holder (place 1 in the most recent race), and the
  roll of past winners.
- Rows run past the last entry, so the site drops rows with an empty Name.

---

## Checking it once it is built

`scripts/check-handicap.mjs` in the website repository states all of the above
as tests, against `sheets/handicap/scoring.gs`. Nothing in the club's sheet
runs it — it exists so the rules can be argued with in a form that either
passes or fails, and so the sheet's arithmetic can be audited against it once
there are real results, the way the championship's sums were on 28 September.

Run it with `npm run check:handicap`.

---

## Open questions

None of these stops the sheet being built. All of them need a person.

- **Where does a member get their age grade % for a club 1500m or mile?**
  parkrun hands it to them, which is why the championship can ask for it. A
  club track race does not. Without an answer, the short races have no usable
  input. Naming a specific calculator on the form is probably the fix.
- **Averages.** Whether a handicap should be an average of recent 5ks rather
  than the last one is to be discussed at the club. The club doesn't believe
  anybody games it: "a race against yourself more than the masses".
- **A dead heat** — two people on the same age grade. Shared trophy, or a
  tiebreak?
- **Does a 5k run anywhere else ever count** towards the handicap, or only the
  club's own monthly one? This brief assumes only the monthly one.
