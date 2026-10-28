/**
 * What is coming up: the next few races, and the next handicap night.
 *
 * Moved out of the homepage's old "Coming up" section on 28 October 2026, when
 * it was folded into "What's on!" and the Results page started showing
 * the next championship race too. The reasoning is unchanged:
 *
 * Two sources for races, deliberately merged rather than one replacing the
 * other:
 *
 * - The **Google race calendars** hold dates somebody has confirmed. Few
 *   entries, all exact.
 * - The **race diary** holds rules worked out from past race reports — "the
 *   last Sunday in November". Many entries, most approximate.
 *
 * Showing only the calendar would empty the homepage whenever the committee
 * were behind. Showing only the diary would hide a race that has actually been
 * booked. So both, with the same honesty rule applied throughout: an exact
 * date prints as a day, a worked-out one says how it is worked out.
 *
 * Where a race is in both — the Chard Flyer is — the calendar wins, because a
 * confirmed date beats an inferred one. See `isSameRace` in utils/calendar for
 * how that is matched, and why it is deliberately cautious.
 *
 * And one more source: the **handicap night**, from the Club nights calendar,
 * any event with "handicap" in its title. Nothing works a handicap date out —
 * it shows when somebody has put it on the calendar, and not before. The next
 * one is always included, however many races fall before it, because it is
 * the club's own night.
 */
import { getCollection } from 'astro:content';

import { getUpcoming, isSameRace } from './calendar';
import { describeTiming, hasExactDate, isRunning, nextOccurrence } from './race-diary';

export interface ComingUpEntry {
	key: string;
	name: string;
	date: Date;
	/** True when the day itself is known, rather than worked out from a rule. */
	exact: boolean;
	/** How an approximate date is described, e.g. "usually mid-November". */
	timing: string | null;
	championship: boolean;
	/** The club's handicap night, from the Club nights calendar. */
	handicap: boolean;
	/** Timed calendar events carry a time; diary entries and all-day ones don't. */
	showTime: boolean;
}

/** A handicap night on the Club nights calendar, found by its title. */
const HANDICAP_TITLE = /handicap/i;

/**
 * The next `limit` races, plus the next handicap night if there is one on the
 * calendar, in date order.
 */
export async function getComingUp({
	limit = 4,
	now = new Date(),
}: { limit?: number; now?: Date } = {}): Promise<ComingUpEntry[]> {
	const fromCalendar: ComingUpEntry[] = (
		await getUpcoming(['race-calendar', 'championship', 'club-races'], { now })
	).map((event) => ({
		key: event.uid,
		name: event.title,
		date: event.start,
		exact: true,
		timing: null,
		championship: event.isChampionship,
		handicap: false,
		showTime: !event.allDay,
	}));

	const fromDiary: ComingUpEntry[] = (await getCollection('calendar-events'))
		.filter((event) => isRunning(event.data))
		.map((event) => ({ event, date: nextOccurrence(event.data, now) }))
		.filter((item): item is { event: (typeof item)['event']; date: Date } => Boolean(item.date))
		.map(({ event, date }) => ({
			key: `diary:${event.id}`,
			name: event.data.name,
			date,
			exact: hasExactDate(event.data, now),
			timing: describeTiming(event.data),
			championship: event.data.championship,
			handicap: false,
			showTime: false,
		}))
		// A race the committee has actually booked is the better record of it.
		.filter((entry) => !fromCalendar.some((c) => isSameRace(c.name, entry.name, c.date, entry.date)));

	const races = [...fromCalendar, ...fromDiary]
		.sort((a, b) => a.date.getTime() - b.date.getTime())
		.slice(0, limit);

	const handicap = (await getUpcoming(['club-nights'], { now }))
		.filter((event) => HANDICAP_TITLE.test(event.title))
		.slice(0, 1)
		.map(
			(event): ComingUpEntry => ({
				key: event.uid,
				name: event.title,
				date: event.start,
				exact: true,
				timing: null,
				championship: false,
				handicap: true,
				showTime: !event.allDay,
			}),
		);

	return [...races, ...handicap].sort((a, b) => a.date.getTime() - b.date.getTime());
}
