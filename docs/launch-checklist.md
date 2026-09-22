# Launch checklist

Everything that has to happen before the site is announced, and the one thing
that has to happen on the day.

**Two dates, not one.**

- **November 2026 — committee review.** The site is live at its address and the
  committee are asked to read it. `PRE_LAUNCH` stays `true`: readable by anyone
  with the link, not findable by anyone without it. That is not a compromise,
  it is exactly what a review period wants.
- **December 2026 — public launch.** `PRE_LAUNCH` goes `false` and the site
  becomes findable.

Nothing here is broken. These are decisions and facts nobody has supplied yet,
left as gaps on purpose rather than filled with guesses.

---

## On the day — the switch

**Set `PRE_LAUNCH` to `false` in `src/consts.ts`, commit, push.**

That one line is the difference between a site nobody can find and a site
people can. While it is `true`:

- every page carries `<meta name="robots" content="noindex, nofollow">`
- `/robots.txt` says `Disallow: /` — nothing at all is to be crawled
- the build prints a yellow reminder saying so

With it `false`, `/robots.txt` goes back to allowing everything except the CMS
screen and starts advertising the sitemap. **Check `chardroadrunners.com/robots.txt`
after the deploy** — if it still says `Disallow: /`, the change did not deploy,
and the site will never appear in a search for the club with nothing looking
broken.

Then check the page as well as the file: fetch the live homepage and confirm
`noindex` is **absent** from it. The tag and `robots.txt` come from the same
flag, but they are two different things a crawler reads, and a cached page can
still carry the tag after the file has changed.

There is no separate `public/robots.txt` to edit. It is generated from that
flag, deliberately, so there is only one thing to remember.

This is not security. Anyone with the address can read every page today, and
this repository is public. It only stops the site being found by accident.

### ~~And confirm ALLOWED_DOMAINS includes the live domain~~

**Done — read from the new Worker on 20 September 2026, and correct.** It was
checked once before, on 18 September, but that reading came off the old
`buddygoestravelling` authenticator and did not survive the account move:
environment variables do not follow a Worker across accounts on their own, so
the variable had to be set again rather than inherited. This reading came from
`crr-cms-auth.chardrunners.workers.dev`, which is the Worker sign-in actually
runs on, and `/admin` has since been tested end to end against it.

It is set to:

```
chardroadrunners.com, *.chardroadrunners.com, crr-website.chardrunners.workers.dev
```

The naked domain, its subdomains listed separately as they have to be, and the
`workers.dev` hostname kept on while that address is still in use. Note the
third is the *site's* hostname, not the authenticator's: what gets checked is
the domain serving `/admin`, not the address the CMS calls. It names the site's
Worker on the club's account, which is the right value — the easy mistake is to
"correct" it to the authenticator's own address, and it has been avoided here.

**It is not dashboard-only, as this entry used to say.** Sveltia inlines the
compiled patterns into every error response — the browser needs them to check
the origin of the `postMessage` it receives — so the list is public, and can be
read again in one command without opening Cloudflare:

```
curl -s 'https://crr-cms-auth.chardrunners.workers.dev/auth' \
  | grep -o 'trustedPatterns = .*;'
```

That is upstream behaviour rather than a leak: an allow-list of domains is not
a secret. But it is worth knowing it is readable by anyone.

Still worth knowing where this lives. `ALLOWED_DOMAINS` is on the
`crr-cms-auth` Worker, not this site's — the GitHub sign-in proxy the CMS
calls, named as `base_url` in `public/admin/config.yml`. The patterns are
exact, and a hostname matching none of the three is refused with "Your domain
is not allowed to use the authenticator". That fails quietly from the outside:
the website is completely fine, it is only the committee who cannot sign in to
edit it, which is the one group who will not be looking at it on launch day.

---

## November handover

Everything the website runs on moves from one person to the club: the club
Google account, the Cloudflare account that holds the domain and the Workers,
and the GitHub repository. Until then the maintainer holds all of it alone —
deliberately, not as an oversight. That is why the email test below waits on
this date, and why the club calendar turns out not to.

**It is one job, not four.** The CRR Gmail account is the root of all of it:
the CRR Cloudflare account is opened from that Gmail account, the domain
registration moves into that Cloudflare account, and the Workers follow it
there. So the Google account has to land first and everything else is
downstream of it.

In order, because each step needs the one before it:

1. **Name the responsible people.** Who owns `welfare@`, `membership@`,
   `hello@` and the two race addresses, who holds the club Google account
   afterwards, and who holds the CRR Cloudflare account. Names still to be
   supplied — nothing below can start without them.
2. **Hand over the club Google account.** Transfer it to the people named
   above, so it belongs to the club as an organisation rather than to whoever
   set it up.
3. **Set up the forwarders.** One per published address, pointing at the
   people named in step 1. Then test them end to end, as **Before the day**
   requires — that test is the proof this section actually happened.
4. **Open the CRR Cloudflare account from the CRR Gmail account**, then move
   the domain registration and the Workers into it. See what this breaks,
   below — it is more than it looks. **The Workers have moved**, and the old
   ones are deleted. The domain is deliberately last: it waits on the
   committee's green light rather than on anybody's time.
5. **Move the GitHub repository** to the club's own GitHub account, and
   reconnect Workers Builds to it so that a push still deploys. **Done** — it
   is `ChardRoadRunners/crr-website`, and both Workers Builds are connected and
   checked: the site's because a push to `main` reached the live site, and
   `diary-rebuild`'s because the code deployed on it is this repository's and
   not the placeholder. Its first scheduled run is the one proof still
   outstanding.

### What the Cloudflare move breaks

Worth reading, because it is not obvious — and the Workers part of it has now
happened, so this is a record of what it took rather than a warning about what
is coming. **The `workers.dev` subdomain belongs to the account, not to the
Worker.** Both Workers moved into the club's Cloudflare account, so every
`*.buddygoestravelling.workers.dev` address became
`*.chardrunners.workers.dev`.

Three things named the old address and break if they are not moved with it.
All three are done, and `/admin` has been tested end to end against the result:

- `public/admin/config.yml` — `base_url`, the address the CMS calls. It reads
  `https://crr-cms-auth.chardrunners.workers.dev`.
- the GitHub OAuth App's **Authorization callback URL**, set on GitHub rather
  than in this repository. The App is owned by the ChardRoadRunners
  organisation and its callback is
  `https://crr-cms-auth.chardrunners.workers.dev/callback`.
- `ALLOWED_DOMAINS` on `crr-cms-auth`, which had to be set again rather than
  inherited. Confirmed on the new Worker — see the entry above.

`workers/cms-auth/README.md` records these too.

Note that README says the callback URL "does not change when the site's domain
changes". That is true and stays true — but an account move is not a domain
change, and it did change then.

Get any one of these wrong and the website is completely fine while the
committee cannot sign in to edit it. Which is why the end-to-end `/admin` test
is what proves this section happened, and the site loading is not.

#### ~~The old Workers are both still live~~

**Done — both deleted 20 September 2026**, and both addresses now return
Cloudflare's error code 1042 rather than a copy of anything. Kept here rather
than removed, because the reason they mattered is worth a future reader's
attention.

They were `crr-cms-auth.buddygoestravelling.workers.dev`, the superseded
authenticator, and `crr-website.buddygoestravelling.workers.dev`, a second copy
of the website. The second was the interesting one: it had stopped building
from this repository, and was still serving homepage wording that commit
`8bc1086` had already changed — frozen rather than divergent-and-live. It
carried `noindex` like everything else while `PRE_LAUNCH` was `true`, and CMS
sign-in from it already failed because its hostname was no longer in
`ALLOWED_DOMAINS`. Both correct behaviour, and neither a reason to leave it up.

The risk was the one `workers/cms-auth/README.md` describes for the duplicate
repository, in a different place: not that a frozen copy does harm by itself,
but that somebody finds it in a year and takes it for the live site. An account
move leaves these behind by default — the old account keeps everything until
somebody deletes it — so finishing a move means looking for what stayed
behind, not just checking that the new thing works.

#### The domain is held back on purpose

`chardroadrunners.com` has no nameserver records at all and does not resolve
(checked 20 September 2026), so nothing is served from it yet and the first two
entries of `ALLOWED_DOMAINS` are waiting rather than wrong.

**This is a decision, not an unfinished job.** The domain stays unpointed until
the committee have given a green light and the maintainer is happy with the
site. Anybody auditing this list should read an unresolving domain as the plan
working, and should not "fix" it — pointing it early publishes the domain in
public certificate transparency logs and starts the clock on being findable,
which is the one thing `PRE_LAUNCH` exists to control.

So this is the last piece of the Cloudflare move, and it is waiting on people
rather than on work. See **DNS and the custom domain in Cloudflare** under
Before the day.

#### The preview-URL gap can now be decided

Branch deployments get a `workers.dev` hostname that `ALLOWED_DOMAINS` does not
match, so CMS sign-in fails on a branch preview. It was deferred because the
subdomain was about to change, and that reason has now expired — it has settled
as `chardrunners.workers.dev`. The objection to widening the allow-list has
weakened rather than vanished: `*.chardrunners.workers.dev` now covers only the
club's own Workers instead of a personal account's, which is a smaller blast
radius but not none. That is a decision rather than a typing job, so it is
still recorded here rather than done.

### What the GitHub move breaks

Less than the Cloudflare move, but it is not nothing, and it is a different
list — so do not assume the two are covered by the same pass.

**`public/admin/config.yml` names the repository**, in `backend.repo`. That is
the line the CMS uses to decide where to commit a race report. GitHub does
redirect a transferred repository, so this may appear to keep working for a
while, which is precisely what makes it worth changing on purpose rather than
leaning on: the redirect is somebody else's convenience feature, not a promise
to the club.

Two Workers Builds are connected to this repository, not one:
`crr-website` and `diary-rebuild`, the latter with its **Root directory** set
to `workers/diary-rebuild`. Reconnect both. The one that is easy to forget is
`diary-rebuild`, and it is also the one nobody would notice for weeks — it
only runs at 04:00, so a broken connection shows up as the race diary quietly
ceasing to roll forward.

**Both were reconnected on 20 September 2026**, and `diary-rebuild` did not come
good first time. It passed through several states on the way, and not one of
them reported an error: connecting a repository does not trigger a build; a new
Worker sits on Cloudflare's "Hello World" placeholder until one runs;
`wrangler versions upload` deploys code without applying cron triggers; and a
blank root directory would have deployed the site's own configuration over the
live site. All four are written up in `workers/diary-rebuild/README.md` under
**Four things that look like it worked**. Worth reading before reconnecting
anything, rather than after.

Also worth knowing, though neither lives in this repository:

- **The Claude GitHub App** is installed per account, so it needs installing on
  the organisation before it can open pull requests against the moved repo.
- **The GitHub OAuth App** behind CMS sign-in is unaffected by the *repository*
  move — it is bound to its callback URL, not to a repository. It has moved
  anyway, and separately: it is now owned by the **ChardRoadRunners**
  organisation, so it belongs to the club rather than to an individual. But
  whoever signs in to `/admin` still needs write access at the new location.

`workers/cms-auth/README.md` refers to `crr-cms-auth`. That is a **different**
repository: a superseded duplicate of `workers/cms-auth/` in this one, with no
Workers Build of its own, which is what makes it safe to retire. It moves to
the organisation alongside this repository and is then **archived**, so there
is only one copy and nobody later mistakes the read-only leftover for the live
source.

---

## Before the day

### Must be done, or the site is wrong

- **DNS and the custom domain in Cloudflare.** `site` in `astro.config.mjs` is
  already `https://chardroadrunners.com`, which is what makes canonical URLs,
  share links, RSS and the sitemap correct — but nothing resolves until the
  domain is attached. Attaching it also publishes the domain in public
  certificate transparency logs, so do it when you are ready to be findable.
  **Gated on two things, both of them judgement rather than work:** the
  committee giving a green light, and the maintainer being happy with the
  site. Until both, an unresolving domain is the intended state — see **The
  domain is held back on purpose** under the Cloudflare move.
- **Redirects from the old Webador URLs.** Needs the list of old addresses
  captured *before* that site is switched off. Without them, every link anyone
  has ever shared breaks on launch day.
- ~~**Capture every old Webador URL by 30 September 2026**, before the old site
  is cancelled.~~ **Done — captured 19 September 2026 from the old site's own
  sitemap, while it was still up. All eleven are in `docs/old-site-urls.md`,
  with the old pub runs wording alongside them.** Writing the redirects is
  still to do: six map straight across, five need somebody to choose, and the
  doc says which are which.
- **Test every published email address end to end.** Not "the address is
  spelled right" — send a real message to each and have the recipient confirm
  it arrived. Covers `welfare@`, `membership@`, `hello@` and the two race
  addresses. A safeguarding address that looks official and quietly routes
  nowhere is the worst failure this site could have, and it is invisible from
  the outside.
  **None of them forward anywhere yet, and that is deliberate.** A forwarder
  needs somebody to forward to, and who owns each address is settled at the
  November handover below. So this test cannot be run until the forwarders
  exist — and running it is how you prove they do.
- **Verify CMS sign-in on the final domain, after the switch, in a fresh
  browser, by somebody who is not the maintainer.** A maintainer with a live
  session cannot detect this class of failure, and `ALLOWED_DOMAINS` above is
  the thing most likely to cause it.
- **Domain: transfer unlock on 20 September 2026.**
- **Domain: confirm auto-renew is on and the card on file will not expire.**
  Losing the domain takes the website and every published email address with
  it, including the safeguarding one.
- ~~**Confirm Lizzie Cox is happy to be named as welfare officer.**~~
  **Done — consent given verbally on 12 September 2026.** Left here rather than
  deleted so a future reader can see it was asked as well as answered. The
  published contact is the forwarder, not a personal address; the detail is in
  `docs/handover.md` under Content notes.

### Words nobody has written yet

- **The privacy page** — three sections still empty, awaiting committee wording.
- **The committee list** on the contact page (`src/content/pages/contact.md`) —
  roles and names, once people have said they are happy to be listed. Nothing
  renders while it starts with `TODO`.
- **Both race pages** (`src/content/races/`) — parking, registration times,
  facilities, baggage, prizes, the course description, and who marshals contact.
  Chard Flyer also has no race director named and no alt text on its hero image.
- **Join Us** — when membership renews.

### Decisions

- **Whether the CMS should keep committing straight to `main`.**
  `public/admin/config.yml` turns editorial workflow off on purpose, on the
  grounds that routing every post through a pull request is "friction nobody
  needs yet". That was written before committee members were posting.

  What it costs became clear on 22 September: a race report whose photo never
  uploaded took the build red, and two unrelated Join Us edits stayed
  unpublished behind it for most of a day. The site was fine throughout — it
  simply stopped updating, and the person who wrote the posts was told nothing.

  Three ways to close it, and they are not exclusive:
  1. **Turn editorial workflow on.** A bad post becomes a pull request that
     fails rather than a `main` that fails. The cost is that every post then
     needs approving, and there may not be anybody reliably around to approve.
  2. **Turn on build notifications** so a failure emails somebody who can act.
     This is a Cloudflare dashboard setting on `crr-website`, not a repository
     change, and it is the cheapest of the three.
  3. **Leave it, and rely on the runbook** now in `docs/handover.md` under
     "When a post does not appear".

  Doing nothing is a choice too, and a defensible one while the site is small
  and somebody is watching it daily. It stops being defensible at handover.

- **Which races count for the championship.** The 2026 list has been received,
  but it is the wrong year for this. The diary runs twelve months ahead, so a
  December 2026 launch shows December 2026 to December 2027, and almost
  everything in it is a 2027 running. **The 2027 list is the one that settles
  the diary.** All 29 entries carry `championship: false` with a `TODO` until
  it arrives.

  **Flagging, not fixing — the field may be the wrong shape.** `championship`
  is a boolean on the recurring race, so setting it true says "this race
  counts", permanently, not "this race counts in 2027". If the list changes
  from season to season the field cannot say so, and each new list means
  editing every entry again. That is a decision about how the diary should
  work, not a typing job, so no diary entries have been changed.
- **Forde Abbey's slot** — fourth Wednesday in June, or last? 2026 was both, so
  the diary is guessing. It is the club's own race; somebody knows.

### Loose ends worth closing

- **`npm run check:diary`** lists diary entries running on evidence over three
  years old — 11 today. Each needs confirming with the organiser or retiring.
- **The Full MontyCute entry link** is commented out in its diary entry;
  entries are open and the real Race Nation URL needs pasting in.
- **The club Google Calendar** on `/calendar` — **not blocked on access.** The
  maintainer holds the club Google account alone, by design, until the November
  handover, so there is nothing to wait for and no one to chase: this is time,
  not permission. The agreed version reads the calendar's `.ics` feed at build
  time rather than embedding an iframe. See `backlog.md`.
- **The 2017 Dark Valley race report** is still `draft: true` and is the only
  history that entry has.
- **The nightly rebuild** (`workers/diary-rebuild/`) — confirm a scheduled run
  actually fired, in the Worker's Logs tab: "Rebuild requested" with a
  timestamp, and a build appearing on `crr-website` a moment after. It runs at
  04:00 UTC, which is 05:00 British Summer Time until the clocks change. Set up
  on the club's Cloudflare account 20 September 2026, so the first run is the
  night after. This entry asked for a *Monday* build until now, left over from
  when the schedule was weekly.
