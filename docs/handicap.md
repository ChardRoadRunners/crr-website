# Monthly handicap — the sheet, the timing page, and the rules

**Status (1 Oct 2026): rebuilt around finishing order.** The sheet is **CRR Handicap** in the club
Drive's Results folder. Its script is `sheets/handicap/scoring.gs` + `sheets/handicap/setup.gs`, with
the phone timing page in `sheets/handicap/timing.html`, all pasted into the sheet's Apps Script.
First real use: the October handicap, Tue 27 Oct 2026. The website side is not started.

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
  handicap" = no run in History yet.
- **Finishing order comes from numbered tokens**, handed out at the line. The club has about 10;
  Matthew is 3D printing more (`crr-finish-token.scad`, 50 × 36 mm, numbers cut into both faces).
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
| **Runners** | Simon / timers | The one list of runners (Simon's list is the authority, not the membership list). Inputs: M or F, Running tonight, Finish token, Simon's start time, Simon's note. Worked out: Start time to use, Suggested start time, Why, Last handicap run, Last run time, Handicaps run, First handicap next time? |
| Runner form | — | Pick a runner: every handicap, a chart of start vs run time, the suggestion |
| History | the script | One row per starter per handicap. Everything reads from it |
| **Results** | worked out | **The tab the website reads.** Placed runners and winners from History, newest first |
| Events | committee | Race nights: Date, Distance, How it is decided, Label (worked out) |
| Timing | the timing page | One row per finish: position, clock time |
| Settings | committee | This race (worked out), 15 s step, off-night threshold, **timing page PIN**, clock start |

Typing `24:30` into a time cell normally gives 24 *hours*. Simon's start time is a text column and
the formula reads it as minutes:seconds, so `24:30`, `24.30` and `0:24:30` all work.

Add new runners at the bottom of Runners (or from the timing page). Don't sort Runners while
anyone is ticked.

History for Feb–Sep 2026 came from Simon's spreadsheet: run times are runners' own watch times,
only the winners are known (no full finishing orders), and the Feb/Mar/Apr dates are guesses.

## The timing page

An Apps Script web app on the sheet (`doGet` → `timing.html`), deployed *Execute as: Me, Access:
Anyone*, gated by the PIN on Settings. Five screens, in the order of the night:

1. **Runners** — tick who's running; add a newcomer with a guessed start time; set a start time.
2. **Start** — big clock; "Start the clock" as the first group goes; shows who goes next with a
   countdown, beeps the last three seconds, flashes GO.
3. **Finish** — one big button: each tap is the next position and its clock time. Undo needs two taps.
4. **Tokens** — put each runner against the token they hold.
5. **Result** — the result and anything to sort out first; **Save to History** clears the ticks,
   tokens and clock for next month.

The phone is the record of finishes: it keeps them across a reload or lost signal and sends the
whole list each time, so a resend can't double-count. Fallback with no phone: tick and type tokens
on Runners, time on paper, type the clock times into Timing.

The results form from the 29 Sep design is no longer used for the handicap. `onFormSubmitted` is
kept as a no-op so its old trigger can't fail; delete the trigger and park the form.

## Privacy

- **Publish the Results tab only**, as CSV (File > Share > Publish to web). Names, run times and
  start times only. Simon's notes and the PIN stay in the sheet.
- Share the timing page link with the timers only, never on the website.
- The membership list (dates of birth) is not read by this sheet any more.

## What the website needs

Read the published Results CSV: `Date · Race · Position · Name · Run time · Start time · Winner ·
First handicap`, newest first. Current trophy holder = the Winner row of the latest race. Rows
before October 2026 have a winner but no position.

## Checking it

`npm run check:handicap` runs `scripts/check-handicap.mjs` against `scoring.gs`: go-at times,
winner by the line, first-timers, run times, the problems a result reports, and the suggestion
rule against real cases from Simon's sheet.

## Open questions

- **Age-graded races** (3km, 1500m, mile): mass start, won on age grade %. The timing page gives
  everyone's run time, but age grading needs an age, which this sheet must not hold. Not built.
- Which September start times were used on the night: Simon's "September Result" tab or his
  "Time order" tab (they differ for Marek Sedlak, Matthew and Phil Goodridge-Reynolds).
- Names to confirm: Sophie Dyer / Sophie Cottie (same person?), "Sam M", surnames for Ben, Laura, Molly.
