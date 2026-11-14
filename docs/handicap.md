# Monthly handicap — the sheet, the timing page, and the rules

**Status (1 Oct 2026): rebuilt around finishing order.** The sheet is **CRR Handicap** in the club
Drive's Results folder. Its script is `sheets/handicap/scoring.gs` + `sheets/handicap/setup.gs`, with
the phone timing page in `sheets/handicap/timing.html`, all pasted into the sheet's Apps Script.
First real use: the October handicap, Tue 27 Oct 2026. The website reads its Results tab, live
from 28 Oct 2026.

**Version 1.2 (November 2026)** is what that first night taught: see "Version 1.2" below for what
changed and how to put it on the sheet.

This replaces the 29 Sep design (handicap = last 5k time, winner = best finish − handicap, results
from a form of runners' own watch times). Simon, who times the handicap and sets the start times,
put us right on 1 Oct; everything below comes from him and Matthew unless marked as open.

---

## The rules

- **Start time.** Every runner has a start time: a predicted 5k time, **in 15-second steps**. Simon
  sets it. The sheet suggests one; he overrides it whenever he likes.
- **Go at.** The slowest start time among those *actually starting* goes first, on 0:00. Everyone
  else goes at (slowest start time − their start time). Done right, everyone arrives together.
- **The winner is the first person across the line.** Not the best run time minus start time: if
  someone is set off a few seconds early, those disagree, and the line is what counts. In Aug and
  Sep 2026 the two gave different winners (Katie Hobbs and Tom Wallis won by the line).
- **First-timers race but can't win.** The first *eligible* runner across the line wins. "First
  time" is **a tick the timer makes on the night**, offered only for runners with no run in
  History. Nothing in History is not enough on its own: History starts in Feb 2026, so on 27 Oct
  people who had run for years were all treated as first-timers. If a runner with nothing in
  History is first across the line and isn't ticked, the result asks for one look before saving.
- **A guest is not racing.** Someone who runs along and takes a token (27 Oct: two did) is marked
  **Guest**: placed, no run time, can't win, and their start time moves nobody's go-at time. It is
  the word `Guest` in Simon's start time, for one night; saving clears it.
- **Finishing order comes from numbered tokens**, handed out at the line. The club has about 10;
  Matthew is 3D printing more (`sheets/handicap/tokens/`, 1–40, 50 × 36 mm: number on the front, club mark on the back).
- **Run time = clock time − go-at time**, from one clock started when the first group goes. That
  is what sets the next suggestion. Nobody needs their own watch (people still run one for Strava).
- One combined result, men and women together. One trophy: the latest winner holds it.

### The suggested start time

Measured against Simon's own choices, Feb–Sep 2026 (31 of 48 within 15 s):

1. Last run time, rounded to the nearest 15 s.
2. A run **more than a minute slower** than the start time is an off night: the start time stays.
3. Missed the latest handicap: the latest start time carries forward.
4. First handicap with no start time given: the run itself, rounded.

Simon's own figure (Runners → Simon's start time) always wins. It clears itself once that runner
runs again, so the new run drives the next suggestion. Simon's note is for a short handicap reason,
**never medical detail**.

---

## The sheet

| Tab | Who edits | Purpose |
|---|---|---|
| Start here | — | Plain-English guide |
| Start list | worked out | Who's running tonight, slowest first, with go-at times grouped for the caller |
| This race | worked out | Live result from tokens and timing |
| **Runners** | Simon / timers | The one list of runners (Simon's list is the authority, not the membership list). Inputs: M or F, Running tonight, Finish token, Simon's start time (a time, or `Guest`), Simon's note, and at the far right **First time?** (column Q, the timer's tick). Worked out: Start time to use, Suggested start time, Why, Last handicap run, Last run time, Handicaps run, First handicap next time? (nothing in History *and* the tick) |
| Runner form | — | Pick a runner: every handicap, a chart of start vs run time, the suggestion |
| History | the script | One row per starter per handicap. Everything reads from it |
| **Results** | worked out | **The tab the website reads.** Placed runners and winners from History, newest first |
| Events | committee | Race nights: Date, Distance, How it is decided, Label (worked out) |
| Timing | the timing page | One row per finish: position, clock time. A finish taken back with Undo stays, below the others, with `Removed` for its position |
| Timing archive | the script | Every tap of every saved night: who held each position, the positions nobody claimed, the taps taken back. Nothing reads it; it is the record |
| Settings | committee | This race (worked out), 15 s step, off-night threshold, **timing page PIN**, clock start, first group when the clock started |

Typing `24:30` into a time cell normally gives 24 *hours*. Simon's start time is a text column and
the formula reads it as minutes:seconds, so `24:30`, `24.30` and `0:24:30` all work.

Add new runners at the bottom of Runners (or from the timing page). Don't sort Runners while
anyone is ticked.

History for Feb–Sep 2026 came from Simon's spreadsheet: run times are runners' own watch times,
only the winners are known (no full finishing orders), and the Feb/Mar/Apr dates are guesses.

## The timing page

An Apps Script web app on the sheet (`doGet` → `timing.html`), deployed *Execute as: Me, Access:
Anyone*, gated by the PIN on Settings. Five screens, in the order of the night:

1. **Runners** — tick who's running; add a newcomer with a guessed start time; set a start time
   or Guest. A ticked runner with nothing in History gets a **first time?** button: tap it if this
   really is their first handicap.
2. **Start** — big clock; "Start the clock" as the first group goes; shows who goes next with a
   countdown, beeps the last three seconds, flashes GO. Once it is running: **Restart** (0:00 and
   running again) and **Reset** (stopped, finishes cleared, ready to start properly: for a
   practice or a false start). Both need two taps.
3. **Finish** — one big button: each tap is the next position and its clock time. Undo needs two
   taps, and takes the finish back without throwing it away.
4. **Tokens** — put each runner against the token they hold. The list for each token is: **No
   one** (clears it); **Running tonight**, A–Z, with the token anyone already holds in brackets
   (picking them moves them); **Everyone else**, for someone who ran without being ticked, which
   asks for the start time they went off on, or Guest. Finishes taken back are listed at the
   bottom with **Put back**.
5. **Result** — the result and anything to sort out first; **Save to History** clears the ticks,
   tokens and clock for next month. Two taps; **three when anything is still listed to sort
   out**, and the sheet refuses a save with problems that nobody has accepted.

The phone is the record of finishes: it keeps them across a reload or lost signal and sends the
whole list each time, so a resend can't double-count. Fallback with no phone: tick and type tokens
on Runners, time on paper, type the clock times into Timing.

0:00 on the clock is the first group, the slowest start time among those ticked. Ticking someone
slower, or unticking the slowest, after the clock has started moves every go-at time and so every
run time. The page allows it (sometimes that is the correction needed) but the sheet notes who the
first group was when the clock started, and the result says so if it has changed.

## Version 1.2 — what 27 October 2026 changed

| What happened on the night | What changed |
|---|---|
| One runner ticked with no start time put every runner in a single group on the Start tab, and "undefined" on the Result | A blank reaches the page as *missing* rather than as an empty value, and the page only tested for one of the two. It now tidies everything from the sheet on arrival and asks one question (`none()`) everywhere. A runner with no start time is listed under the start order and moves nobody |
| A runner who wasn't ticked couldn't be given a token; one put on a token by mistake couldn't be taken off | The new pick list: No one, Running tonight, Everyone else |
| Everyone with nothing in History was a "first handicap" | The timer's first-time tick |
| It saved with four problems listed; unclaimed clock times and a removed finish were lost | A third tap when problems are listed; every tap kept in the Timing archive; Undo keeps the tap |
| A practice start could only be undone by restarting the clock | Reset the clock |

**Not in 1.2, still to come:** the race setup screen and mass-start mode (mile, 1500m), which
wait on how those races are scored, and the two-phone start. See the backlog.

### Putting 1.2 on the sheet

1. In the sheet: Extensions > Apps Script. Replace the contents of `scoring.gs`, `setup.gs` and
   `timing` (the HTML file) with the three files in `sheets/handicap/`. Save.
2. **Deploy > Manage deployments > the pencil > Version: New version > Deploy.** Without this the
   link keeps serving the old page. The link itself does not change.
3. Open the timing page (or reload the sheet). The first time, the script brings the sheet up to
   1.2 by itself (`upgradeLayout_` in `setup.gs`): the First time? column on Runners, the Timing
   archive tab, one Settings row, and three formulas rewritten (Runners G and P, Start list D).
   It checks the Runners layout first and changes nothing if it isn't what it expects. If anything
   looks wrong afterwards, File > Version history puts the sheet back.
4. Do a practice: tick a few, start, tap some finishes, try the tokens, then **Reset the clock**
   and untick. Don't save a practice.

Known gap, left on purpose: the **This race** tab is the formula-only fallback view and doesn't
know about guests, so a guest first across the line shows as the winner *there*. The timing page
and Save to History get it right.

The results form from the 29 Sep design is no longer used for the handicap. `onFormSubmitted` is
kept as a no-op so its old trigger can't fail; delete the trigger and park the form.

## Privacy

- **Publish the Results tab only**, as CSV (File > Share > Publish to web). Names, run times and
  start times only. Simon's notes and the PIN stay in the sheet.
- Share the timing page link with the timers only, never on the website.
- The membership list (dates of birth) is not read by this sheet any more.

## What the website needs

Live (28 Oct 2026): the results page and a page per night read the published Results CSV — see docs/results.md. Columns: `Date · Race · Position · Name · Run time · Start time · Winner ·
First handicap`, newest first. Current trophy holder = the Winner row of the latest race. Rows
before October 2026 have a winner but no position.

## Checking it

`npm run check:handicap` runs two files:

- `scripts/check-handicap.mjs` against `scoring.gs`: go-at times, winner by the line,
  first-timers, guests, run times, the problems a result reports, and the suggestion rule against
  real cases from Simon's sheet.
- `scripts/check-handicap-night.mjs` drives `setup.gs` itself — the functions the timing page
  calls — through a whole night against a pretend sheet (`scripts/lib/fake-handicap-sheet.mjs`),
  replaying 27 October: the runner with no start time, the unticked runner, the token taken off
  again, saving with problems, the archive, the reset.

Neither can run the page in a browser or the formulas in Google Sheets. Version 1.2's page was
run in a phone-sized browser against the same pretend sheet before it was pasted in, but that
test is not in the repository (it needs a browser installed). A practice run on the real sheet
is still the last check.

## Open questions

- **Age-graded races** (3km, 1500m, mile): mass start, won on age grade %. The timing page gives
  everyone's run time, but age grading needs an age, which this sheet must not hold. Not built.
- Which September start times were used on the night: Simon's "September Result" tab or his
  "Time order" tab (they differ for Marek Sedlak, Matthew and Phil Goodridge-Reynolds).
- Names to confirm: Sophie Dyer / Sophie Cottie (same person?), "Sam M", surnames for Ben, Laura, Molly.
