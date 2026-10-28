/**
 * The monthly handicap results, read from the CRR Handicap sheet at build time.
 *
 * The handicap is timed on the night with the sheet's own timing page, which
 * works out positions, run times and the winner and saves them to the History
 * tab. The sheet's Results tab is the public slice of that: one row per runner
 * per handicap, newest first. This module does no timing and no judging of its
 * own — the winner is whoever the sheet says won, for the same reason the
 * championship points are never worked out here: two places deciding the same
 * result is two answers. See docs/results.md and docs/handicap.md.
 *
 * COLUMNS ARE FOUND BY NAME, never by position, as in championship.ts.
 *
 * Handicaps before October 2026 came from Simon's spreadsheet and only the
 * winner was recorded, so a night can be "winner only": one row, no position.
 * That is a real state the page shows as such, not a broken result.
 */
import { HANDICAP_CSV_URL } from '../consts.ts';
import { formatDate } from './date.ts';
import { fetchSheetCsv } from './sheet.ts';

export interface HandicapFinisher {
	/** Finishing position across the line, or null if none was recorded. */
	position: number | null;
	name: string;
	/** As the sheet shows it, e.g. "24:49". Null if there is no time. */
	runTime: string | null;
	/** The predicted 5k time they were set off on, e.g. "26:30". */
	startTime: string | null;
	winner: boolean;
	/** First handicap: races, but can't win. */
	firstHandicap: boolean;
	/**
	 * Run time minus start time, as people say it: "−1:41" is 1 min 41 under
	 * their start time, "+0:17" over. Null without both times.
	 */
	vsStart: string | null;
	/** The same, in seconds, negative when under. */
	vsStartSeconds: number | null;
}

export interface HandicapNight {
	/** YYYY-MM-DD, as written on the sheet. */
	dateIso: string;
	/** Midnight UTC on that day, for FormattedDate. */
	date: Date;
	/** The sheet's label for the race, e.g. "27 Oct 2026". */
	race: string;
	/** Placed finishers first in position order, then anyone without one, A–Z. */
	finishers: HandicapFinisher[];
	/** Null if nobody eligible finished. */
	winner: HandicapFinisher | null;
	/** True when only the winner was recorded (the handicaps before Oct 2026). */
	winnerOnly: boolean;
	/** Fastest run time of the night. Null on a winner-only night. */
	quickest: HandicapFinisher | null;
	/**
	 * Furthest under their start time. First handicaps are left out — their
	 * start time was a guess — and so is anybody who was not under at all.
	 */
	furthestUnder: HandicapFinisher | null;
}

export interface HandicapResults {
	/** Newest first. */
	nights: HandicapNight[];
	/** When this was read. The site is static, so it is only this current. */
	readAt: Date;
}

const HEADERS = {
	date: 'Date',
	race: 'Race',
	position: 'Position',
	name: 'Name',
	runTime: 'Run time',
	startTime: 'Start time',
	winner: 'Winner',
	firstHandicap: 'First handicap',
} as const;

const tidy = (value: string) => value.replace(/\s+/g, ' ').trim();
const sameHeader = (a: string, b: string) => tidy(a).toLowerCase() === tidy(b).toLowerCase();
const yes = (value: string) => tidy(value).toUpperCase() === 'TRUE';
const orNull = (value: string) => (tidy(value) === '' ? null : tidy(value));

/**
 * "24:49" or "1:02:30" to seconds; anything else is null.
 *
 * Only ever used for the highlights and the "vs start" column on a night's
 * page. Positions and the winner are never worked out here — they are what the
 * sheet's timing page saved.
 */
export function timeToSeconds(text: string | null): number | null {
	if (!text) return null;
	const parts = text.split(':');
	if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
	const n = parts.map(Number);
	if (n[n.length - 1] >= 60) return null;
	return n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
}

/** Seconds to "−1:41", "+0:17" or "0:00". The minus is a real minus sign. */
export function formatDifference(seconds: number): string {
	const sign = seconds < 0 ? '\u2212' : seconds > 0 ? '+' : '';
	const abs = Math.abs(seconds);
	return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/**
 * Turns the Results CSV into handicap nights, newest first.
 *
 * Exported separately from the fetch so the rules can be checked against
 * fixtures — see scripts/check-handicap-results.mjs. Every failure throws: a
 * results table with the wrong winner, or a runner missing, is wrong about a
 * named member of the club on a public page.
 */
export function parseHandicapResults(rows: string[][], readAt = new Date()): HandicapResults {
	if (rows.length === 0) {
		throw new Error(
			'The handicap Results sheet was empty. Check the published tab is Results and not a blank one.',
		);
	}

	const header = rows[0].map(tidy);
	const column = {} as Record<keyof typeof HEADERS, number>;
	for (const [key, wanted] of Object.entries(HEADERS) as [keyof typeof HEADERS, string][]) {
		const index = header.findIndex((cell) => sameHeader(cell, wanted));
		if (index === -1) {
			throw new Error(
				`The handicap Results sheet has no "${wanted}" column. Its first row reads: ` +
					`${header.slice(0, 8).join(', ')}. If a heading was renamed, put it back; if ` +
					'that looks like a different tab, the wrong tab got published.',
			);
		}
		column[key] = index;
	}

	const byDate = new Map<string, { race: string; finishers: HandicapFinisher[] }>();

	for (const row of rows.slice(1)) {
		const cell = (key: keyof typeof HEADERS) => row[column[key]] ?? '';
		const name = tidy(cell('name'));
		if (name === '') continue;

		const dateIso = tidy(cell('date'));
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || Number.isNaN(Date.parse(`${dateIso}T00:00:00Z`))) {
			throw new Error(
				`The handicap Results sheet has "${dateIso}" as the date for ${name}. The website ` +
					'needs it as YYYY-MM-DD; check the Date column on the Results tab is still ' +
					'formatted that way.',
			);
		}

		const positionText = tidy(cell('position'));
		let position: number | null = null;
		if (positionText !== '') {
			position = Number(positionText);
			if (!Number.isInteger(position) || position < 1) {
				throw new Error(
					`The handicap Results sheet has "${positionText}" as ${name}'s position on ${dateIso}. ` +
						'A position is a whole number from 1, or blank.',
				);
			}
		}

		const night = byDate.get(dateIso) ?? { race: tidy(cell('race')) || dateIso, finishers: [] };
		const runTime = orNull(cell('runTime'));
		const startTime = orNull(cell('startTime'));
		const run = timeToSeconds(runTime);
		const start = timeToSeconds(startTime);
		const vsStartSeconds = run !== null && start !== null ? run - start : null;
		night.finishers.push({
			position,
			name,
			runTime,
			startTime,
			winner: yes(cell('winner')),
			firstHandicap: yes(cell('firstHandicap')),
			vsStart: vsStartSeconds === null ? null : formatDifference(vsStartSeconds),
			vsStartSeconds,
		});
		byDate.set(dateIso, night);
	}

	const nights: HandicapNight[] = [...byDate.entries()].map(([dateIso, { race, finishers }]) => {
		const winners = finishers.filter((f) => f.winner);
		if (winners.length > 1) {
			throw new Error(
				`The handicap Results sheet has ${winners.length} winners on ${dateIso}: ` +
					`${winners.map((w) => w.name).join(' and ')}. There is one winner a night — ` +
					'fix the Winner column in History.',
			);
		}

		const shared = new Map<number, string[]>();
		for (const f of finishers) {
			if (f.position !== null) shared.set(f.position, [...(shared.get(f.position) ?? []), f.name]);
		}
		for (const [position, names] of shared) {
			if (names.length > 1) {
				throw new Error(
					`The handicap Results sheet has ${names.join(' and ')} both in position ${position} ` +
						`on ${dateIso}. Positions come from the order across the line, so each is held ` +
						'by one runner — fix the Position column in History.',
				);
			}
		}

		finishers.sort((a, b) => {
			if (a.position !== null && b.position !== null) return a.position - b.position;
			if (a.position !== null) return -1;
			if (b.position !== null) return 1;
			return a.name.localeCompare(b.name, 'en-GB');
		});

		const winnerOnly = finishers.every((f) => f.position === null);
		const timed = finishers.filter((f) => timeToSeconds(f.runTime) !== null);
		const quickest = winnerOnly || timed.length === 0
			? null
			: timed.reduce((a, b) => (timeToSeconds(b.runTime)! < timeToSeconds(a.runTime)! ? b : a));
		const under = finishers.filter((f) => !f.firstHandicap && f.vsStartSeconds !== null && f.vsStartSeconds < 0);
		const furthestUnder = winnerOnly || under.length === 0
			? null
			: under.reduce((a, b) => (b.vsStartSeconds! < a.vsStartSeconds! ? b : a));

		return {
			dateIso,
			date: new Date(`${dateIso}T00:00:00Z`),
			race,
			finishers,
			winner: winners[0] ?? null,
			winnerOnly,
			quickest,
			furthestUnder,
		};
	});

	nights.sort((a, b) => (a.dateIso < b.dateIso ? 1 : a.dateIso > b.dateIso ? -1 : 0));
	return { nights, readAt };
}

/**
 * Fills the {placeholders} in a line of content about one night.
 *
 * {monthYear} "October 2026", {month} "October", {date} "Tue 27th Oct 2026",
 * {winner}, {count} runners, and the winner's {run} and {start} times. The
 * wording is the committee's, in src/content/pages/; this only puts the
 * sheet's facts into it. Used by the night pages, the News page and the
 * homepage, so a placeholder means the same everywhere.
 */
export function fillNight(line: string, night: HandicapNight): string {
	const month = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' }).format(night.date);
	return line
		.replaceAll('{monthYear}', formatDate(night.date, { monthOnly: true }))
		.replaceAll('{month}', month)
		.replaceAll('{date}', formatDate(night.date))
		.replaceAll('{winner}', night.winner?.name ?? '')
		.replaceAll('{count}', String(night.finishers.length))
		.replaceAll('{run}', night.winner?.runTime ?? '')
		.replaceAll('{start}', night.winner?.startTime ?? '');
}

/**
 * The handicap results, or `null` while the Results tab has not been published.
 *
 * `null` is a real state with its own wording on the page. Every other way
 * this can fail throws and takes the build with it.
 */
export async function getHandicapResults(): Promise<HandicapResults | null> {
	if (HANDICAP_CSV_URL === '') return null;

	return parseHandicapResults(await fetchSheetCsv(HANDICAP_CSV_URL, 'handicap results'));
}
