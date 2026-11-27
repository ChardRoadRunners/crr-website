// Turning a race diary rule into a date, and into words.
//
// The single path for both, the way getEarliestRaceDate is for race reports.
// Nothing else should be working out when a race falls.
//
// Everything is computed in UTC. Frontmatter dates arrive as UTC midnight, and
// mixing those with local-time arithmetic is how a race lands on the wrong day
// for anyone west of Greenwich.

export type Nth = "first" | "second" | "third" | "fourth" | "last";
export type Weekday =
	| "Monday"
	| "Tuesday"
	| "Wednesday"
	| "Thursday"
	| "Friday"
	| "Saturday"
	| "Sunday";

export type DiaryStatus = "active" | "renamed" | "dormant" | "retired";

export interface DiaryRule {
	month: number;
	fixedDate?: string;
	nth?: Nth;
	weekday?: Weekday;
	status?: DiaryStatus;
	date?: Date;
	dateConfirmed?: boolean;
}

const WEEKDAY_INDEX: Record<Weekday, number> = {
	Sunday: 0,
	Monday: 1,
	Tuesday: 2,
	Wednesday: 3,
	Thursday: 4,
	Friday: 5,
	Saturday: 6,
};

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

const NTH_WORDS: Record<Nth, string> = {
	first: "first",
	second: "second",
	third: "third",
	fourth: "fourth",
	last: "last",
};

/**
 * Whether an entry belongs on the site at all.
 *
 * Listed while a race is happening, under whatever name it happens under. A
 * dormant or retired one stays in the repository as the record that somebody
 * checked and what they found — it is only hidden from readers.
 *
 * One predicate rather than the test written out at each call site, so the
 * diary and the homepage cannot come to disagree about which races still run.
 */
export function isRunning(entry: DiaryRule): boolean {
	const status = entry.status ?? "active";
	return status === "active" || status === "renamed";
}

/** The nth given weekday of a month, e.g. the last Sunday in November 2026. */
export function resolveRule(year: number, month: number, nth: Nth, weekday: Weekday): Date {
	const target = WEEKDAY_INDEX[weekday];

	if (nth === "last") {
		// Walk back from the last day of the month to the first matching weekday.
		const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
		const date = new Date(Date.UTC(year, month - 1, lastDay));
		date.setUTCDate(lastDay - ((date.getUTCDay() - target + 7) % 7));
		return date;
	}

	// Forward from the 1st to the first matching weekday, then whole weeks on.
	const first = new Date(Date.UTC(year, month - 1, 1));
	const offset = (target - first.getUTCDay() + 7) % 7;
	const week = { first: 0, second: 1, third: 2, fourth: 3 }[nth];
	return new Date(Date.UTC(year, month - 1, 1 + offset + week * 7));
}

/** "1 January" for a given year. Returns undefined if it cannot be parsed. */
export function resolveFixedDate(year: number, fixedDate: string): Date | undefined {
	const match = fixedDate.trim().match(/^(\d{1,2})\s+([A-Za-z]+)$/);
	if (!match) return undefined;
	const day = Number(match[1]);
	const month = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[2].toLowerCase());
	if (month < 0) return undefined;
	return new Date(Date.UTC(year, month, day));
}

/** Where this entry falls in a given year. Used for ordering. */
export function occurrenceIn(entry: DiaryRule, year: number): Date | undefined {
	if (entry.fixedDate) return resolveFixedDate(year, entry.fixedDate);
	if (entry.nth && entry.weekday) return resolveRule(year, entry.month, entry.nth, entry.weekday);
	return undefined;
}

/**
 * The next time this race comes round, on or after `from`.
 *
 * A confirmed date wins outright — somebody checked it. Otherwise this year's
 * occurrence if it is still ahead, and next year's if it has been and gone.
 */
export function nextOccurrence(entry: DiaryRule, from: Date): Date | undefined {
	// A known date wins whether or not it is confirmed — an unconfirmed date
	// from an aggregator still sorts the entry to the right place. Only while
	// it is still ahead, though: last year's date left in place would otherwise
	// pin the entry in the past for ever.
	if (entry.date && entry.date >= startOfDay(from)) return entry.date;
	const thisYear = occurrenceIn(entry, from.getUTCFullYear());
	if (thisYear && thisYear >= startOfDay(from)) return thisYear;
	return occurrenceIn(entry, from.getUTCFullYear() + 1);
}

const startOfDay = (d: Date): Date =>
	new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Whether a specific day may be shown.
 *
 * Only two things earn one: a date a human confirmed with the organiser, and a
 * fixed date that cannot drift because it is the same every year. A date
 * computed from a rule never does, however plausible it looks — the rule came
 * from one observation, and a member turning up a week late is a worse outcome
 * than a page admitting it does not know.
 */
export function hasExactDate(entry: DiaryRule, now: Date): boolean {
	// A date that cannot drift, because it is the same every year.
	if (entry.fixedDate) return true;

	if (!entry.dateConfirmed || !entry.date) return false;

	// The guard. A date confirmed for last year is not a confirmed date, and
	// left unguarded it renders as one — a day, in bold, with "date confirmed"
	// under it, for a race that has already been. This is the exact failure
	// that produced a diary full of 2017 dates presented as fact, so it is
	// checked here rather than trusted to whoever edits the entry next.
	return entry.date >= startOfDay(now);
}

/**
 * Whether this running of a race counts for the club championship.
 *
 * Takes the date being shown, not just the entry, because the championship is
 * set for one year at a time. A race in the 2027 championship whose next
 * running is in December 2026 shows no badge on that running, and neither
 * does its 2028 running until somebody puts it in the 2028 championship. A
 * plain yes/no would have done both, silently.
 */
export function countsForChampionship(
	entry: { championshipYear?: number },
	date: Date,
): boolean {
	return entry.championshipYear === date.getUTCFullYear();
}

/** How to say when this race happens, when no exact date may be shown. */
export function describeTiming(entry: DiaryRule): string {
	const month = MONTH_NAMES[entry.month - 1];
	if (entry.nth && entry.weekday) {
		return `usually the ${NTH_WORDS[entry.nth]} ${entry.weekday} in ${month}`;
	}
	return `expected in ${month}`;
}

/**
 * The far end of the diary: twelve months from `from`, to the day.
 *
 * A rolling range rather than twelve calendar months. Bucketing by calendar
 * month loses any race that has just been: on 8 September the Bridgwater races
 * of the 6th roll to next September, which falls outside a September-to-August
 * set of buckets, and they disappear from the diary for a year. A range that
 * runs to the same date next year keeps them, in a group labelled with the
 * year they belong to.
 */
export function diaryCutoff(from: Date, months = 12): Date {
	return new Date(
		Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, from.getUTCDate()),
	);
}

/** Group occurrences by the month they fall in, earliest first. */
export function groupByMonth<T extends { date: Date }>(
	items: T[],
): { year: number; month: number; items: T[] }[] {
	const groups = new Map<string, { year: number; month: number; items: T[] }>();
	for (const item of [...items].sort((a, b) => a.date.getTime() - b.date.getTime())) {
		const year = item.date.getUTCFullYear();
		const month = item.date.getUTCMonth() + 1;
		const key = `${year}-${month}`;
		if (!groups.has(key)) groups.set(key, { year, month, items: [] });
		groups.get(key)!.items.push(item);
	}
	return [...groups.values()];
}

export const monthName = (month: number): string => MONTH_NAMES[month - 1];
