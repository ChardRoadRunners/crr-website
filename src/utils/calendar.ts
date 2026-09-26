/**
 * The club's Google calendars, read at build time.
 *
 * Five public `.ics` feeds parsed into one shape, so a page never has to care
 * which calendar an event came from. The pages render ordinary HTML with no
 * client-side JavaScript, which is why the nightly rebuild exists: a static
 * build only knows what was true when it ran.
 *
 * Nothing here runs in a visitor's browser. The only request to Google happens
 * on the build machine — the whole reason this replaces the calendar iframe,
 * which would have put every visitor's IP in front of Google.
 *
 * WHY node-ical: it parses an .ics file and expands RRULEs without a build
 * step. `ical.js` is the stricter parser but needs RecurExpansion wired up by
 * hand. The reason to switch would be club-night recurrence misbehaving — it
 * was checked across the BST/GMT change and 7pm stays 7pm, so it has not.
 */
import ical from 'node-ical';

import { CALENDAR_IDS } from '../consts.ts';
import { formatDate, formatTime } from './date.ts';

export type CalendarSource = keyof typeof CALENDAR_IDS;

export interface ClubEvent {
	/** The ICS UID, stable across rebuilds. A recurring series shares one. */
	uid: string;
	/** SUMMARY, rendered as typed. Titles are the club's, not ours to reword. */
	title: string;
	start: Date;
	end: Date | null;
	/** DTSTART was a DATE rather than a DATE-TIME. Changes how it is formatted. */
	allDay: boolean;
	location: string | null;
	/** DESCRIPTION with the entry link taken out, so it is not printed twice. */
	description: string | null;
	entryLink: string | null;
	source: CalendarSource;
	isChampionship: boolean;
	isRecurring: boolean;
}

const feedUrl = (source: CalendarSource) =>
	`https://calendar.google.com/calendar/ical/${encodeURIComponent(
		CALENDAR_IDS[source],
	)}/public/basic.ics`;

/**
 * One fetch per feed per build.
 *
 * Several pages read the same calendar, and without this each would pull it
 * again. Keyed by source and holding the promise rather than the result, so
 * two pages starting at once still share a single request.
 */
const feeds = new Map<CalendarSource, Promise<ical.CalendarResponse>>();

/**
 * One request to Google at a time.
 *
 * /calendar asks for all five feeds in a single `Promise.all`, seventeen
 * milliseconds into the build, so five requests left for the same host at the
 * same instant from one address. Google refused some of them with 429, and
 * which ones looked random — "2 of 3" on one build, "1 of 1" on the next.
 *
 * Retrying hid the shape of it rather than fixing it: every round re-fired the
 * survivors together, so each attempt was another burst. Raising the attempt
 * count from four to six on 26 September bought more waiting and still lost.
 *
 * Queueing costs about a second of build time across five small files and
 * removes the burst entirely. It does not replace the backoff above: a shared
 * build address can arrive already out of quota, which is a different problem
 * with the same symptom.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Statuses worth trying again.
 *
 * 429 is Google saying "not right now", not "no". Cloudflare's builders come
 * from a shared pool of addresses, so the rate limit can be spent by traffic
 * that has nothing to do with this club — which is what took the build down on
 * 20 September 2026, on a commit that changed two CSS classes.
 *
 * A 404 is deliberately NOT here. That means somebody turned off public
 * sharing, it will 404 again in ten seconds, and the build should say so at
 * once rather than spending half a minute pretending otherwise. Retrying the
 * statuses that mean "later" is what keeps the loud failure meaningful: if the
 * build still goes red after this, something is actually wrong.
 */
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Six attempts, not four.
 *
 * The sleeps go between attempts and double from a second, so four attempts
 * spent 1 + 2 + 4 = seven seconds of patience altogether. That reads like more
 * than it is, and it is no match for a rate-limit window measured in minutes.
 * Six gives 1 + 2 + 4 + 8 + 16 = thirty-one seconds.
 *
 * Raised on 26 September 2026, after the shared-address 429 described above
 * took three builds down inside a week — once on 20 September, twice in one
 * morning on the 26th — each on a commit with nothing wrong with it.
 *
 * This makes losing less likely, not impossible. The real fix is for builds to
 * stop depending on Google at all, which is a decision on the launch checklist
 * rather than a number to tune.
 */
const MAX_ATTEMPTS = 6;
const BACKOFF_MS = 1_000;
/** Google has asked for a wait this long before; anything more is a real outage. */
const MAX_BACKOFF_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long to wait before attempt number `attempt` (1-based).
 *
 * Honours Retry-After when Google sends one, in either of its forms — a count
 * of seconds, or an HTTP date. Falls back to doubling. Exported so the wait is
 * testable without waiting.
 */
export function retryDelayMs(attempt: number, retryAfter?: string | null, now = Date.now()): number {
	const backoff = Math.min(BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
	if (!retryAfter) return backoff;

	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds)) {
		return Math.min(Math.max(seconds, 0) * 1_000, MAX_BACKOFF_MS);
	}

	const when = Date.parse(retryAfter);
	if (Number.isNaN(when)) return backoff;

	return Math.min(Math.max(when - now, 0), MAX_BACKOFF_MS);
}

/**
 * What a failing status actually means, in words aimed at whoever has to fix it.
 *
 * This used to say "a 404 here almost always means the calendar is no longer
 * shared publicly" whatever the status — so a 429 was reported with advice
 * about sharing permissions, and cost a morning chasing the wrong thing.
 * Exported so the wording is pinned by the checks.
 */
export function describeStatus(source: CalendarSource, status: number, statusText: string): string {
	const head = `Calendar "${source}" returned ${status} ${statusText}.`;

	if (status === 404) {
		return (
			`${head} That almost always means the calendar is no longer shared ` +
			'publicly in Google — check Settings > (the calendar) > Access permissions.'
		);
	}
	if (RETRY_STATUSES.has(status)) {
		return (
			`${head} That is a "try later", and it was already retried ${MAX_ATTEMPTS} ` +
			'times with backoff, so Google is still refusing. Nothing is wrong with the ' +
			'calendar itself — a build machine sharing an address with noisy neighbours ' +
			'can spend the rate limit. Re-run the build.'
		);
	}
	return `${head} Check the calendar is still shared publicly in Google.`;
}

/**
 * Fetches and parses one feed.
 *
 * Fails loudly on purpose. A feed that 404s means somebody turned off public
 * sharing in Google, and the visible symptom would otherwise be a page that
 * quietly has nothing on it — which nobody notices until a member asks why the
 * races have gone.
 *
 * Transient refusals get up to MAX_ATTEMPTS tries with backoff first, because
 * failing the whole site build on one 429 is a false alarm, and a build nobody
 * trusts is as bad as a page nobody checks.
 */
export function fetchCalendar(source: CalendarSource): Promise<ical.CalendarResponse> {
	const cached = feeds.get(source);
	if (cached) return cached;

	const work = async () => {
		let lastProblem = '';

		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			let response: Response;
			try {
				response = await fetch(feedUrl(source));
			} catch (cause) {
				// A dropped connection is the same kind of "later" as a 429.
				lastProblem = `Calendar "${source}" could not be reached: ${(cause as Error).message}`;
				if (attempt === MAX_ATTEMPTS) break;
				await sleep(retryDelayMs(attempt));
				continue;
			}

			if (response.ok) {
				const body = await response.text();
				if (!body.trimStart().startsWith('BEGIN:VCALENDAR')) {
					throw new Error(
						`Calendar "${source}" did not return an iCalendar file. ` +
							'Google serves an HTML error page when a feed is private, so this is the ' +
							'same problem as a 404.',
					);
				}
				return ical.async.parseICS(body);
			}

			lastProblem = describeStatus(source, response.status, response.statusText);

			// Anything that is not a "try later" is a real answer. Say so now.
			if (!RETRY_STATUSES.has(response.status)) throw new Error(lastProblem);

			if (attempt === MAX_ATTEMPTS) break;
			await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
		}

		throw new Error(lastProblem);
	};

	// Wait for whatever is already in flight, then go. `queue` swallows the
	// result so one feed failing does not stop the feeds behind it from being
	// tried — they each need to report their own problem, which is what lets
	// the error name every broken feed at once rather than one per build.
	const pending = queue.then(work);
	queue = pending.catch(() => {});

	feeds.set(source, pending);
	return pending;
}

/**
 * Pulls the entry link out of the description.
 *
 * Google puts whatever the organiser pasted into DESCRIPTION, and on these
 * calendars that starts with the race's own entry page. Taking it out here
 * means the template can render it as a button without the same URL also
 * appearing as raw text in the prose underneath.
 */
function splitDescription(raw?: string): Pick<ClubEvent, 'description' | 'entryLink'> {
	const text = (raw ?? '').trim();
	if (!text) return { description: null, entryLink: null };

	const match = text.match(/https:\/\/\S+/);
	// Trailing punctuation is sentence, not URL.
	const entryLink = match ? match[0].replace(/[).,;]+$/, '') : null;
	const description = (entryLink ? text.replace(entryLink, '') : text).trim() || null;

	return { description, entryLink };
}

/** node-ical hands back `VEvent`s mixed in with timezone components. */
const isEvent = (value: ical.CalendarComponent): value is ical.VEvent =>
	value.type === 'VEVENT';

const isCancelled = (raw: { status?: string }) =>
	String(raw.status ?? '').toUpperCase() === 'CANCELLED';

function toClubEvent(
	raw: ical.VEvent,
	source: CalendarSource,
	start: Date,
	end: Date | null,
	isRecurring: boolean,
): ClubEvent {
	const { description, entryLink } = splitDescription(raw.description);

	return {
		uid: raw.uid,
		title: (raw.summary ?? '').trim(),
		start,
		end,
		// node-ical reports `date` for DTSTART;VALUE=DATE and `date-time`
		// otherwise. That distinction is the whole of the all-day handling —
		// see formatEventWhen for why it must not be timezone-converted.
		allDay: raw.datetype === 'date',
		location: raw.location?.trim() || null,
		description,
		entryLink,
		source,
		isChampionship: source === 'championship',
		isRecurring,
	};
}

/**
 * Expands one VEVENT into the occurrences falling inside a window.
 *
 * A club night is a single VEVENT with an RRULE, so without this the page
 * shows one Tuesday in September forever. Overridden instances (a run moved to
 * a different time) live in `recurrences`, and cancelled ones in `exdate`;
 * both are honoured, or a cancelled club night still renders.
 */
function expand(
	raw: ical.VEvent,
	source: CalendarSource,
	from: Date,
	to: Date,
): ClubEvent[] {
	if (!raw.rrule) {
		return [toClubEvent(raw, source, raw.start, raw.end ?? null, false)];
	}

	const overrides = (raw.recurrences ?? {}) as Record<string, ical.VEvent>;
	const excluded = raw.exdate ?? {};
	const excludedInstants = new Set(
		Object.values(excluded).map((date) => (date as Date).getTime()),
	);

	// Google gives every occurrence the same length as the first.
	const duration = raw.end ? raw.end.getTime() - raw.start.getTime() : 0;

	const out: ClubEvent[] = [];
	for (const occurrence of raw.rrule.between(from, to, true)) {
		const key = occurrence.toISOString().slice(0, 10);

		// EXDATE is keyed by date in node-ical, but compare the instant too:
		// an occurrence cancelled at a specific time will not match by date.
		if (key in excluded || excludedInstants.has(occurrence.getTime())) continue;

		const override = overrides[key];
		if (override) {
			if (isCancelled(override)) continue;
			out.push(toClubEvent(override, source, override.start, override.end ?? null, true));
			continue;
		}

		out.push(
			toClubEvent(
				raw,
				source,
				occurrence,
				duration ? new Date(occurrence.getTime() + duration) : null,
				true,
			),
		);
	}

	return out;
}

/** Turns a parsed feed into events, dropping anything cancelled. */
export function normalise(
	parsed: ical.CalendarResponse,
	source: CalendarSource,
	from: Date,
	to: Date,
): ClubEvent[] {
	return Object.values(parsed)
		.filter(isEvent)
		.filter((raw) => !isCancelled(raw))
		.flatMap((raw) => expand(raw, source, from, to));
}

export interface UpcomingOptions {
	limit?: number;
	/** Injectable so the behaviour can be tested against a fixed date. */
	now?: Date;
	/** How far ahead to expand recurring events. */
	horizonDays?: number;
}

/**
 * The merged, sorted list of what is coming up.
 *
 * Recurring series collapse to their next occurrence: without that, "the next
 * five events" on the homepage is five Tuesdays.
 *
 * Every feed is fetched in parallel, and if more than one is broken the error
 * names them all — fixing them one build at a time is miserable.
 */
export async function getUpcoming(
	sources: readonly CalendarSource[],
	{ limit, now = new Date(), horizonDays = 365 }: UpcomingOptions = {},
): Promise<ClubEvent[]> {
	const to = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

	const settled = await Promise.allSettled(
		sources.map(async (source) => normalise(await fetchCalendar(source), source, now, to)),
	);

	const failures = settled.flatMap((result, index) =>
		result.status === 'rejected'
			? [`${sources[index]}: ${(result.reason as Error).message}`]
			: [],
	);
	if (failures.length > 0) {
		throw new Error(
			`Could not read ${failures.length} of ${sources.length} club calendars:\n` +
				failures.map((line) => `  - ${line}`).join('\n'),
		);
	}

	const events = settled
		.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
		// An event is over once it has ended; all-day DTEND is exclusive, so
		// this keeps an all-day race visible for the whole of its own day.
		.filter((event) => (event.end ?? event.start).getTime() > now.getTime())
		.sort((a, b) => a.start.getTime() - b.start.getTime());

	// Sorted first, so the occurrence kept is the soonest one.
	const seenSeries = new Set<string>();
	const collapsed = events.filter((event) => {
		if (!event.isRecurring) return true;
		if (seenSeries.has(event.uid)) return false;
		seenSeries.add(event.uid);
		return true;
	});

	return typeof limit === 'number' ? collapsed.slice(0, limit) : collapsed;
}

/**
 * Is this calendar event and this diary entry the same race?
 *
 * The two sources name races slightly differently — the calendar has "Chard
 * Flyer 10k" where the diary might have "Chard Flyer" — so the homepage would
 * otherwise list both.
 *
 * Deliberately cautious. One name must be the whole of the other or its
 * opening words: a plain "contains" would let a stray "10k" or "Marathon"
 * swallow unrelated races. The dates must also land near each other, because
 * the diary's are worked out rather than confirmed and the same race runs
 * once a year — two entries months apart are two different runnings.
 */
const NEAR_ENOUGH_DAYS = 28;

const normaliseName = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

export function racesShareAName(aName: string, bName: string): boolean {
	const [x, y] = [normaliseName(aName), normaliseName(bName)];
	if (!x || !y) return false;

	return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export function isSameRace(
	aName: string,
	bName: string,
	aDate: Date,
	bDate: Date,
): boolean {
	if (!racesShareAName(aName, bName)) return false;

	return Math.abs(aDate.getTime() - bDate.getTime()) / 86_400_000 <= NEAR_ENOUGH_DAYS;
}

/**
 * Is this social a pub run?
 *
 * Pub runs live in the socials calendar alongside parties and quizzes, because
 * that is the calendar the social secretaries already keep. Nothing marks one
 * out except its title, so this is a naming convention doing structural work —
 * the weakest joint in the pub runs page, and worth knowing about.
 *
 * Deliberately generous, because the failure is silent: a pub run the filter
 * misses does not error, it just never appears. "Pub run", "Pub Run - The
 * George", "July pub run" and the annual "Pubs Run" all match. Matching too
 * widely only pulls a party onto a page about pub runs, which somebody will
 * notice and report; matching too narrowly empties a page nobody is checking.
 *
 * `\b` on both ends keeps it honest: "pub quiz" and "club run" do not match,
 * and neither does a word that merely ends in "pub".
 *
 * If this ever needs to be stricter, the honest fix is a field the secretaries
 * fill in, not a cleverer regex — see docs/pub-runs.md.
 */
const PUB_RUN = /\bpubs?[\s-]*runs?\b/i;

export const isPubRun = (event: ClubEvent): boolean => PUB_RUN.test(event.title);

/**
 * The club's own next running of a race, from the club-races calendar.
 *
 * Matched by name alone — unlike the homepage merge there is no second date to
 * compare against, because finding the date is the whole point.
 */
export async function findNextClubRace(
	title: string,
	now = new Date(),
): Promise<ClubEvent | null> {
	const races = await getUpcoming(['club-races'], { now });

	return races.find((race) => racesShareAName(race.title, title)) ?? null;
}

export interface ResolvedRaceDate {
	date: Date | null;
	/** True when the date came from the calendar rather than the content file. */
	fromCalendar: boolean;
	/** All-day calendar entries, and content-file dates, have no time. */
	showTime: boolean;
}

/**
 * Where a race page's date comes from.
 *
 * The club-races calendar is the source of truth: it is what the committee
 * actually edits, and it carries a start time. A race's content file may still
 * name a date for one the calendar does not have yet.
 *
 * If both exist and disagree, the build fails rather than picking one. Two
 * dates for the same race is exactly the failure a runner discovers by
 * arriving on the wrong day, and silently preferring either would hide it.
 */
export async function resolveRaceDate(
	title: string,
	contentDate: Date | undefined,
	now = new Date(),
): Promise<ResolvedRaceDate> {
	const event = await findNextClubRace(title, now);

	if (!event) {
		return { date: contentDate ?? null, fromCalendar: false, showTime: false };
	}

	if (contentDate) {
		const daysApart = Math.abs(event.start.getTime() - contentDate.getTime()) / 86_400_000;
		if (daysApart > 1) {
			throw new Error(
				`"${title}" has two different dates. The club-races calendar says ` +
					`${event.start.toISOString().slice(0, 10)}, and its content file says ` +
					`${contentDate.toISOString().slice(0, 10)}. The calendar is the one the ` +
					'committee edits, so remove nextDate from the race\'s content file — or ' +
					'correct whichever of the two is wrong.',
			);
		}
	}

	return { date: event.start, fromCalendar: true, showTime: !event.allDay };
}

const LONDON = 'Europe/London';

/**
 * Formats an event's date and time for display.
 *
 * Two rules, each with a wrong answer that looks right:
 *
 * 1. Timed events read in Europe/London, never the build machine's zone.
 *    Cloudflare builds in UTC, and the Stockland Scamper is stored as
 *    `20261018T090000Z` — which is 10am BST. Read as UTC it says 9am: an hour
 *    early, and only in summer.
 *
 * 2. All-day events read in UTC, because that is how the calendar date was
 *    encoded — node-ical turns `VALUE=DATE:20261108` into midnight UTC.
 *    Running that through a timezone is how an all-day race shows the day
 *    before.
 */
export function formatEventWhen(event: ClubEvent, _now = new Date()): string {
	const date = formatDate(event.start, { timeZone: event.allDay ? 'UTC' : LONDON });

	return event.allDay ? date : `${date}, ${formatTime(event.start, LONDON)}`;
}

/** ISO date for a <time datetime="..."> attribute. */
export const machineDate = (event: ClubEvent): string =>
	event.allDay ? event.start.toISOString().slice(0, 10) : event.start.toISOString();
