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

Done already, in the Cloudflare dashboard. Recorded here so the next person can
see the shape of it, and rebuild it if it is ever lost.

1. **A deploy hook on the `crr-website` Worker**, under **Settings → Builds →
   Deploy hooks**, pointed at `main`. A deploy hook is a secret URL that starts
   a build when it receives a POST — anyone holding it can start builds, so it
   is treated as a password.
2. **This Worker, named `diary-rebuild`**, created under **Workers & Pages →
   Create application** with the `ChardRoadRunners/crr-website` repository connected
   and **Root directory** set to `workers/diary-rebuild`. Cloudflare builds this
   folder on its own machines and reads the `wrangler.jsonc` here, so the
   schedule travels with the code.
3. **The deploy hook URL stored as a secret** on this Worker, under **Settings →
   Variables and Secrets**, named `DEPLOY_HOOK_URL`. The code refuses to run
   without it — a missing secret throws rather than logging quietly, so a
   half-finished setup fails loudly instead of looking healthy for months.

**`name` in `wrangler.jsonc` must match the Worker's name in the dashboard.**
Wrangler deploys to whatever the file says, and a mismatch is not an error: it
creates a second, different Worker and leaves the real one — the one holding the
secret — untouched and never running. The dashboard flags this if the two drift.

One side effect of connecting the repository: every push to `main` rebuilds this
Worker as well as the site. Harmless, and it builds in seconds, but it shows up
as a second build every time.

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
