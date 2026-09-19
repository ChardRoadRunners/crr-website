/**
 * How dates are written on this site.
 *
 * One place, because there were two: the calendar listed "Sun 18 Oct" while
 * the race diary next to it listed "Nov 1, 2026" — American order, on a
 * Somerset running club's website.
 *
 * The form is "1st Nov 2026": ordinal day, short month, full year. The year is
 * always shown. A race calendar is read months ahead and often spans a new
 * year, and "1st Jan" with no year is exactly the entry somebody turns up to
 * twelve months early.
 */

const ORDINAL_RULES = new Intl.PluralRules('en-GB', { type: 'ordinal' });

const SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
	one: 'st',
	two: 'nd',
	few: 'rd',
	other: 'th',
	zero: 'th',
	many: 'th',
};

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th", 21 -> "21st". */
export const ordinal = (value: number): string =>
	`${value}${SUFFIXES[ORDINAL_RULES.select(value)] ?? 'th'}`;

export interface FormatDateOptions {
	/**
	 * Which zone the date is read in.
	 *
	 * 'UTC' for a date with no time of its own — a frontmatter date, or an
	 * all-day calendar entry. Running one of those through a real timezone is
	 * how an event ends up showing the day before.
	 *
	 * 'Europe/London' for a real instant, so a 10am race reads as 10am rather
	 * than in whatever zone the build machine happens to run in.
	 */
	timeZone?: string;
	/** Month and year only, for a date whose exact day is not known. */
	monthOnly?: boolean;
}

/** "1st Nov 2026", or "November 2026" when the day is not known. */
export function formatDate(
	date: Date,
	{ timeZone = 'UTC', monthOnly = false }: FormatDateOptions = {},
): string {
	if (monthOnly) {
		return new Intl.DateTimeFormat('en-GB', {
			timeZone,
			month: 'long',
			year: 'numeric',
		}).format(date);
	}

	// Built from parts so the day can be made ordinal and the pieces joined in
	// our own order, rather than accepting whatever the locale assembles.
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).formatToParts(date);

	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? '';

	return `${ordinal(Number(part('day')))} ${part('month')} ${part('year')}`;
}

/** "10:00 am", in London time. */
export function formatTime(date: Date, timeZone = 'Europe/London'): string {
	return (
		new Intl.DateTimeFormat('en-GB', {
			timeZone,
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		})
			.format(date)
			// Intl uses a narrow no-break space before am/pm, which copies badly.
			.replace(/ /g, ' ')
	);
}
