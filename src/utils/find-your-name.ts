/**
 * The index behind "Find your name" on the Results page: every runner in this
 * year's championship standings and the handicap results, with one line per
 * result, worded from src/content/pages/results.md.
 *
 * Built at build time, like everything else. The browser receives the
 * finished lines and only filters them by name — it never works anything out,
 * so the search cannot disagree with the tables on the same page. Nothing
 * here is new information either: every line restates something already on
 * the Results page or a handicap night's page.
 *
 * Names are matched loosely — case, accents, hyphens and extra spaces ignored —
 * so "ellis trott" finds Tracey Ellis-Trott. The same runner spelled two
 * different ways on the two sheets is two runners here; the sheets are where
 * that gets fixed.
 */
import type { Standings } from './championship';
import { formatDate, ordinal } from './date';
import type { HandicapResults } from './handicap-results';

export interface RunnerLine {
	text: string;
	href: string;
}

export interface Runner {
	name: string;
	/** The name as matched: see nameKey. */
	key: string;
	lines: RunnerLine[];
}

export interface SearchWords {
	championshipLine: string;
	womenGroup: string;
	menGroup: string;
	points: { one: string; other: string };
	races: { one: string; other: string };
	handicapLine: string;
	handicapLineShort: string;
	wonLabel: string;
}

/**
 * Lower case, accents off, anything that is not a letter or digit a single
 * space. The browser script normalises what is typed the same way.
 */
export const nameKey = (name: string): string =>
	name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const fill = (line: string, values: Record<string, string>) =>
	Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), line);

const counted = (forms: { one: string; other: string }, n: number) =>
	(n === 1 ? forms.one : forms.other).replaceAll('{n}', String(n));

export function buildRunnerIndex(
	standings: Standings | null,
	handicap: HandicapResults | null,
	words: SearchWords,
): Runner[] {
	const runners = new Map<string, Runner>();
	const add = (name: string, line: RunnerLine) => {
		const key = nameKey(name);
		if (!key) return;
		const runner = runners.get(key) ?? { name, key, lines: [] };
		runner.lines.push(line);
		runners.set(key, runner);
	};

	// The championship first: one line, the standing as it is now.
	for (const [group, list] of [
		[words.womenGroup, standings?.women ?? []],
		[words.menGroup, standings?.men ?? []],
	] as const) {
		for (const runner of list) {
			add(runner.name, {
				text: fill(words.championshipLine, {
					place: ordinal(runner.position),
					group,
					points: counted(words.points, runner.pointsSoFar),
					races: counted(words.races, runner.racesRun),
				}),
				href: '/results/#championship',
			});
		}
	}

	// Then every handicap they are in, newest first, as the nights already are.
	for (const night of handicap?.nights ?? []) {
		for (const runner of night.finishers) {
			const place = runner.winner ? words.wonLabel : runner.position ? ordinal(runner.position) : null;
			if (place === null) continue;
			const date = formatDate(night.date);
			add(runner.name, {
				text:
					runner.runTime && runner.startTime
						? fill(words.handicapLine, { date, place, run: runner.runTime, start: runner.startTime })
						: fill(words.handicapLineShort, { date, place }),
				href: `/results/handicap/${night.dateIso}/`,
			});
		}
	}

	return [...runners.values()].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
}
