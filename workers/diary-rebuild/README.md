# Nightly rebuild

The race diary is worked out at build time, and so are the club's Google
calendars. Without a rebuild both freeze: races that have already happened stop
dropping off, the twelve-month window stops rolling forward, and an event added
in Google never appears. This Worker rings a deploy hook once a night so that
happens on its own — which is what stops the diary lapsing the way the old
hand-maintained calendar did.

It is a separate Worker from the site and shares nothing with it. Twenty lines,
in `src/index.js`.

## How it is set up

Set up on the club's Cloudflare account on 20 September 2026, when both Workers
moved there. Recorded here so the next person can see the shape of it, and
rebuild it if it is ever lost.

1. **A deploy hook on the `crr-website` Worker**, under **Settings → Builds →
   Deploy hooks**, pointed at `main`. A deploy hook is a secret URL that starts
   a build when it receives a POST — anyone holding it can start builds, so it
   is treated as a password.

   **A deploy hook belongs to one Worker on one account, and is not something to
   carry across an account move.** The old account's hook keeps working, so
   reusing it would ring the wrong bell: this Worker would rebuild the
   superseded site every night while the live one quietly froze, logging
   success the whole time. Generate a new one on the club account.
2. **This Worker, named `diary-rebuild`**, created under **Workers & Pages →
   Create application → Import a repository**, with
   `ChardRoadRunners/crr-website` connected. Cloudflare builds this folder on
   its own machines and reads the `wrangler.jsonc` here, so the schedule travels
   with the code.
3. **Its build settings**, under **Settings → Build**:

   | Setting | Value |
   | :------ | :---- |
   | Root directory | `workers/diary-rebuild` |
   | Build command | *empty* |
   | Deploy command | `npx wrangler deploy` |
   | Branch control | `main` |

   Build command stays empty on purpose: there is no `package.json` in this
   folder and nothing to compile, because Wrangler bundles the single file
   itself. A default `npm install` here fails looking for a file that was never
   meant to exist. The other three each have a failure mode of their own — see
   the next section.

   One consequence worth knowing: with no `package.json` here, the deploy step
   downloads Wrangler from npm on every build, so a flaky fetch can fail a
   deploy with nothing wrong in the code. The site's own build no longer has
   this problem — Wrangler is pinned in the root `package.json` — but this
   Worker still does. Fixing it means adding a `package.json` here and a build
   command in the dashboard to install from it. See "A build that fails with
   nothing changed" in `docs/handover.md`.
4. **The deploy hook URL stored as a secret** on this Worker, under **Settings →
   Variables and Secrets**, named `DEPLOY_HOOK_URL`. The code refuses to run
   without it — a missing secret throws rather than logging quietly, so a
   half-finished setup fails loudly instead of looking healthy for months.
   Deleting and recreating the Worker takes the secret with it, so it has to be
   set again afterwards rather than assumed.

**`name` in `wrangler.jsonc` must match the Worker's name in the dashboard.**
Wrangler deploys to whatever the file says, and a mismatch is not an error: it
creates a second, different Worker and leaves the real one — the one holding the
secret — untouched and never running. The dashboard flags this if the two drift.

One side effect of connecting the repository: every push to `main` rebuilds this
Worker as well as the site. Harmless, and it builds in seconds, but it shows up
as a second build every time.

## Four things that look like it worked

All four were hit setting this up on the club's account, in one afternoon. Not
one of them produces an error, which is why they are written down: each leaves a
dashboard that reads as finished.

**Connecting the repository does not build anything.** Workers Builds runs on a
push event to the production branch. Connecting the repository only arranges for
that to happen next time — so connect it on a quiet afternoon and nothing builds
at all until somebody pushes. Trigger one from the **Builds** tab, or push to
`main`.

**A new Worker starts as Cloudflare's "Hello World".** Creating it deploys a
placeholder straight away, so until the first real build lands, the Worker
exists, carries the right name, shows no error, and contains none of this code.
Check the code, not the name.

**`wrangler versions upload` does not apply cron triggers.** It uploads the code
and leaves the schedule alone, so the Worker arrives complete and never runs.
Only `wrangler deploy`, or `wrangler triggers deploy`, applies them.

This one is live here rather than hypothetical. **Non-production branch builds
are enabled on this Worker**, and their deploy command is
`npx wrangler versions upload` — so every push to a branch uploads a new version
of `diary-rebuild` and posts a preview URL on the pull request. That does no
harm, because a version is not a deployment: production carries on running
whatever `wrangler deploy` last put there. It is worth knowing anyway, because
a green build on a branch has not touched the schedule, and a schedule checked
after one has not been checked at all. Before concluding a schedule is set,
confirm the production branch is `main` and the deploy command is
`npx wrangler deploy`.

**Root directory left blank deploys the wrong thing.** The deploy command runs
wherever the root directory points. At the repository root, `npx wrangler deploy`
reads the *site's* `wrangler.jsonc`, whose `name` is `crr-website` — so a build
of this Worker would push the site's configuration over the live site, and
report success. The same trap as the name mismatch above, walked into from the
other side.

## Reading the schedule in the dashboard

**Settings → Triggers → Cron Triggers** lists the next five runs rather than the
rule. Read on a Sunday, the next five runs of a nightly job are Monday to
Friday, which reads convincingly as "weekdays at 4am". It is not that.

`0 4 * * *` is every day. The five fields are minute, hour, day of month, month
and day of week, and it is that last `*` that makes it daily. Weekdays only
would be `0 4 * * 1-5`. Read the same screen on a Wednesday and the preview runs
Thursday to Monday, and the question does not come up.

The time is **UTC**. It fires at 05:00 British Summer Time and 04:00 in winter,
so a log timestamped an hour away from what you expected is the clocks, not a
fault.

## Checking it works

The first scheduled run is the next 04:00 UTC after setup. Two ways to see
it:

- **In the dashboard** — this Worker's **Logs** tab. A successful run logs
  "Rebuild requested" with the time. A failure throws, so it appears as an
  error rather than passing silently. Cross-check against the `crr-website`
  Worker's build list: a build should appear a moment after.
- **From a terminal** — `npx wrangler tail diary-rebuild` shows the same thing
  live.

To test without waiting for the small hours, from this directory:

```
npx wrangler dev --test-scheduled
```

then visit `http://localhost:8787/__scheduled` in a browser. Note that this
fires a *real* rebuild if `DEPLOY_HOOK_URL` is set locally.

## Changing the schedule

`triggers.crons` in `wrangler.jsonc` — standard cron syntax, always UTC.
Currently `0 4 * * *`: every night at 04:00.

It can also be changed in the dashboard under **Settings → Triggers → Cron
Triggers**, but prefer the file, so the schedule stays written down in the
repository rather than living only somewhere nobody thinks to look.

It was Monday-only until the club calendars were read at build time. Weekly
suited the diary on its own, which moves when a month rolls over — but an event
added to a Google calendar on a Tuesday should not wait until the following
Monday to show up. Nightly is the slowest schedule that still makes a calendar
useful.

Do not go faster than nightly. A club calendar changes weekly at most, and
anything more frequent burns build minutes for nothing. An edit through the CMS
already triggers its own build, so content changes never wait for this.

## Deploying from a terminal instead

Only needed if the repository connection is ever removed. From this directory:

```
npx wrangler secret put DEPLOY_HOOK_URL
```

```
npx wrangler deploy
```
