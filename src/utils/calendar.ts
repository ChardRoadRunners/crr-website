/**
 * The club's Google calendars, read at build time.
 *
 * Four public `.ics` feeds parsed into one shape, so a page never has to care
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
 * Fetches and parses one feed.
 *
 * Fails loudly on purpose. A feed that 404s means somebody turned off public
 * sharing in Google, and the visible symptom would otherwise be a page that
 * quietly has nothing on it — which nobody notices until a member asks why the
 * races have gone.
 */
export function fetchCalendar(source: CalendarSource): Promise<ical.CalendarResponse> {
	const cached = feeds.get(source);
	if (cached) return cached;

	const pending = (async () => {
		let response: Response;
		try {
			response = await fetch(feedUrl(source));
		} catch (cause) {
			throw new Error(
				`Calendar "${source}" could not be reached: ${(cause as Error).message}`,
			);
		}

		if (!response.ok) {
			throw new Error(
				`Calendar "${source}" returned ${response.status} ${response.statusText}. ` +
					'A 404 here almost always means the calendar is no longer shared publicly ' +
					'in Google — check Settings > (the calendar) > Access permissions.',
			);
		}

		const body = await response.text();
		if (!body.trimStart().startsWith('BEGIN:VCALENDAR')) {
			throw new Error(
				`Calendar "${source}" did not return an iCalendar file. ` +
					'Google serves an HTML error page when a feed is private, so this is the ' +
					'same problem as a 404.',
			);
		}

		return ical.async.parseICS(body);
	})();

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

const LONDON = 'Europe/London';

/**
 * Formats an event's date and time for display.
 *
 * Two rules, both of which have a wrong answer that looks plausible:
 *
 * 1. Timed events format in Europe/London, never the build machine's zone.
 *    Cloudflare builds in UTC, and the Stockland Scamper is stored as
 *    `20261018T090000Z` — which is 10am BST. Formatted in UTC it reads 9am,
 *    an hour early, and only in summer.
 *
 * 2. All-day events format in UTC, because that is how the calendar date was
 *    encoded: node-ical turns `VALUE=DATE:20261108` into midnight UTC. Running
 *    that through a timezone is how an all-day race ends up showing the day
 *    before.
 */
export function formatEventWhen(event: ClubEvent, now = new Date()): string {
	const sameYear =
		new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, year: 'numeric' }).format(
			event.start,
		) ===
		new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, year: 'numeric' }).format(now);

	// Assembled from parts rather than taking Intl's own string: en-GB adds a
	// comma after the weekday only when a year is present, so the two forms
	// would read "Sun 18 Oct" and "Fri, 1 Jan 2027" in the same list.
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: event.allDay ? 'UTC' : LONDON,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(sameYear ? {} : { year: 'numeric' }),
	}).formatToParts(event.start);

	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? '';

	const date = [part('weekday'), part('day'), part('month'), part('year')]
		.filter(Boolean)
		.join(' ');

	if (event.allDay) return date;

	const time = new Intl.DateTimeFormat('en-GB', {
		timeZone: LONDON,
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	})
		.format(event.start)
		// "7:00 pm" reads better than "7:00 pm" with a narrow no-break space.
		.replace(/ /g, ' ');

	return `${date}, ${time}`;
}

/** ISO date for a <time datetime="..."> attribute. */
export const machineDate = (event: ClubEvent): string =>
	event.allDay ? event.start.toISOString().slice(0, 10) : event.start.toISOString();
