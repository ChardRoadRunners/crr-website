---
# src/content/pages/results.md

# Tells the schema which set of sections to expect. Don't change it.
page: "results"

hero:
  heading: "Results"
  strapline: "Championship standings, the monthly handicap, and the club records."

# Used for the browser tab and for links shared on social media.
seo:
  description: "Club championship standings, the monthly handicap and club records for Chard Road Runners."

championship:
  heading: "Club Championship"
  intro: "Points from the club's championship races through the year. Submit your own result on the championship form after every race — no form, no points."

  # Shown until somebody publishes the Standings tab to the web. See
  # CHAMPIONSHIP_CSV_URL in src/consts.ts for how.
  notPublished: "The standings are moving over to this page and are not quite ready. Until they are, they go out on Facebook as they always have."

  # Shown when the sheet is published but has no runners on it yet, which is
  # what a new season looks like in January.
  emptyState: "No results in this year's championship yet. The first race of the season will fill this in."

  womenHeading: "Women"
  menHeading: "Men"

  # The four columns on the summary table, and the two extra on the grid.
  labels:
    position: "Pos"
    name: "Name"
    racesRun: "Races"
    points: "Points"
    bonus: "Bonus"
    championshipScore: "Year-end score"

  gridHeading: "Race by race"
  gridIntro: "Scroll sideways for the rest of the year. A dash means they didn't run that one; a 0 means they ran and finished outside the first ten Chard runners."
  gridRegionLabel: "Race by race standings"

  # Shown under the date the page was last built.
  updatedLabel: "Standings as at"
  updatedNote: "The page is rebuilt every night, so a result submitted today shows up tomorrow."

  # The year-end column rests on a reading of the rules nobody has confirmed
  # yet — see the Open questions in docs/results.md. Say so rather than
  # printing a number as though it were settled. Clear this line once the
  # committee has confirmed what "2 points for every race more than the 7"
  # means.
  scoreNote: "The year-end score counts each runner's best seven results, plus two points for every race beyond those seven, plus bonus points. That reading of the rule is still to be confirmed by the committee, so treat the column as provisional — Points is the running total the club has always published."

  rulesHeading: "How the championship works"
  # The rules exactly as the club publishes them. Don't reword these without
  # asking the committee — they are the rules, not a description of them.
  rules:
    - "7 results to count"
    - "2 points for every race more than the 7"
    - "10 Points for first Chard Runner, then 9 etc"
    - "For Parkruns age graded % will be used"
    - "Max 1 Bonus Point if you run a marathon in the year"
    - "Max 1 Bonus point if you run an ultra during the year (32 miles / 50k Min)"
    - "Club Kit to be worn in Championship races"

  # The form runners submit their results on. Nothing renders while this is
  # empty, so the page never shows a dead link.
  formUrl: ""
  formLabel: "Submit a result"

handicap:
  heading: "Monthly Handicap"
  body: "The latest month, and the running standings across the year."
  notPublished: "Not published here yet. Handicap results go out on Facebook in the meantime."

records:
  heading: "Club Records"
  body: "By distance and age category."
  notPublished: "Not published here yet."

footnote: "Looking for upcoming races? They are on the [calendar](/calendar)."
---
