/**
 * The club championship standings, read from the Standings tab at build time.
 *
 * The scoring all happens in Google Sheets — runners submit their own result
 * on a Google Form, formulas rank the Chard runners in each race and work out
 * the points. This module does no scoring of its own on purpose: two places
 * calculating the same table is two answers to "how many points have I got",
 * and the sheet is the one the committee can see working. See docs/results.md.
 *
 * So all that happens here is reading a CSV and giving it a shape a template
 * can render.
 *
 * COLUMNS ARE FOUND BY NAME, never by position. The Standings tab has room for
 * twenty races and only fifteen are in use, so the summary columns sit at a
 * different letter every time a race is added. Reading "Points so far" by name
 * survives that; reading column Y does not, and would silently start rendering
 * a race's points as somebody's total.
 */
import { CHAMPIONSHIP_CSV_URL } from '../consts.ts';
import { fetchSheetCsv } from './sheet.ts';

/** How the sheet records gender. It ranks men and women separately. */
export type Gender = 'M' | 'F';

export interface RunnerStanding {
	name: string;
	gender: Gender;
	/**
	 * One entry per race column, in the order the races appear on the sheet.
	 *
	 * `null` means the runner did not run it; `0` means they ran and finished
	 * eleventh or lower among the Chard runners, which scores nothing. Those
	 * are different facts and the table shows them differently, which is why
	 * this is not just a number with 0 doing double duty.
	 */
	racePoints: (number | null)[];
	bonus: number;
	racesRun: number;
	/** The straight sum, as the club has always published it. */
	pointsSoFar: number;
	/** Rank within gender on pointsSoFar. Ties share a position. */
	position: number;
	/** The year-end rule: best N results, plus a bit for every extra race. */
	championshipScore: number;
}

export interface Standings {
	/** Race names in column order, as typed on the sheet's Races tab. */
	races: string[];
	men: RunnerStanding[];
	women: RunnerStanding[];
	/** When this was read. The site is static, so it is only this current. */
	readAt: Date;
}

/** The summary columns that follow the race columns, in sheet order. */
const SUMMARY_HEADERS = [
	'Bonus',
	'Races run',
	'Points so far',
	'Position',
	'Championship score',
] as const;

const NAME_HEADER = 'Name';
const GENDER_HEADER = 'M or F';

/** Header matching is forgiving about case and stray spaces, nothing else. */
const tidy = (value: string) => value.replace(/\s+/g, ' ').trim();
const sameHeader = (a: string, b: string) => tidy(a).toLowerCase() === tidy(b).toLowerCase();

const findColumn = (header: string[], wanted: string): number =>
	header.findIndex((cell) => sameHeader(cell, wanted));

/**
 * Turns the Standings CSV into the two tables the page renders.
 *
 * Exported separately from the fetch so the rules can be checked against
 * fixtures — see scripts/check-championship.mjs.
 *
 * Every failure here throws. A standings table that renders half the club, or
 * puts a runner in the wrong column, is worse than a red build: it is wrong in
 * a way that looks right, and the people it is wrong about are named on it.
 */
export function parseStandings(rows: string[][], readAt = new Date()): Standings {
	if (rows.length === 0) {
		throw new Error(
			'The Standings sheet was empty. Check the published tab is Standings and ' +
				'not a blank one.',
		);
	}

	const header = rows[0].map(tidy);

	const nameColumn = findColumn(header, NAME_HEADER);
	const genderColumn = findColumn(header, GENDER_HEADER);
	if (nameColumn === -1 || genderColumn === -1) {
		throw new Error(
			`The Standings sheet has no "${NAME_HEADER}" and "${GENDER_HEADER}" columns. ` +
				`Its first row reads: ${header.slice(0, 6).join(', ')}. That usually means a ` +
				'different tab got published.',
		);
	}

	const summary: Record<string, number> = {};
	for (const wanted of SUMMARY_HEADERS) {
		const index = findColumn(header, wanted);
		if (index === -1) {
			throw new Error(
				`The Standings sheet has no "${wanted}" column. The website reads the ` +
					'summary columns by name, so renaming one on the sheet stops the ' +
					'standings building. Put the heading back, or update SUMMARY_HEADERS ' +
					'in src/utils/championship.ts to match.',
			);
		}
		summary[wanted] = index;
	}

	// Races are everything between the two name columns and the first summary
	// column. Unused slots have blank headers and are dropped — the sheet keeps
	// room for twenty races whether or not the club has entered that many.
	const firstSummary = Math.min(...Object.values(summary));
	const raceColumns: number[] = [];
	for (let i = Math.max(nameColumn, genderColumn) + 1; i < firstSummary; i += 1) {
		if (header[i] !== '') raceColumns.push(i);
	}
	const races = raceColumns.map((i) => header[i]);

	/** A cell that must hold a number. Blank counts as zero for the summaries. */
	const requireNumber = (row: string[], column: number, what: string, who: string): number => {
		const raw = tidy(row[column] ?? '');
		if (raw === '') return 0;
		const value = Number(raw);
		if (!Number.isFinite(value)) {
			throw new Error(
				`The Standings sheet has "${raw}" under "${what}" for ${who}, which is not ` +
					'a number. That is usually a formula showing an error on the sheet — ' +
					'open it and look at that cell.',
			);
		}
		return value;
	};

	const men: RunnerStanding[] = [];
	const women: RunnerStanding[] = [];

	for (const row of rows.slice(1)) {
		const name = tidy(row[nameColumn] ?? '');
		// The sheet runs its formulas to row 1000, so most rows are blank. A
		// blank name is the end of the runners, not a problem.
		if (name === '') continue;

		const genderRaw = tidy(row[genderColumn] ?? '').toUpperCase();
		if (genderRaw !== 'M' && genderRaw !== 'F') {
			throw new Error(
				`${name} has "${row[genderColumn] ?? ''}" in the "${GENDER_HEADER}" column ` +
					'on the Standings sheet, and it has to be M or F — the championship ranks ' +
					'men and women separately, so there is nowhere to put anybody else. Fix it ' +
					'on the Runners tab, which is where that column comes from.',
			);
		}

		const racePoints = raceColumns.map((column) => {
			const raw = tidy(row[column] ?? '');
			// Blank is "did not run". Zero is "ran, finished 11th or lower".
			if (raw === '') return null;
			const value = Number(raw);
			if (!Number.isFinite(value)) {
				throw new Error(
					`${name} has "${raw}" against ${header[column]} on the Standings sheet, ` +
						'which is not a number. Points come from formulas, so this is likely an ' +
						'error showing in that cell.',
				);
			}
			return value;
		});

		const runner: RunnerStanding = {
			name,
			gender: genderRaw,
			racePoints,
			bonus: requireNumber(row, summary.Bonus, 'Bonus', name),
			racesRun: requireNumber(row, summary['Races run'], 'Races run', name),
			pointsSoFar: requireNumber(row, summary['Points so far'], 'Points so far', name),
			position: requireNumber(row, summary.Position, 'Position', name),
			championshipScore: requireNumber(
				row,
				summary['Championship score'],
				'Championship score',
				name,
			),
		};

		(genderRaw === 'M' ? men : women).push(runner);
	}

	// The sheet lists runners alphabetically. Order by the standing itself, and
	// alphabetically within a tie so a shared position has a stable order
	// rather than whatever the sheet happened to hand over.
	const byPosition = (a: RunnerStanding, b: RunnerStanding) =>
		a.position - b.position || a.name.localeCompare(b.name, 'en-GB');

	men.sort(byPosition);
	women.sort(byPosition);

	return { races, men, women, readAt };
}

/**
 * The standings, or `null` while the sheet has not been published yet.
 *
 * `null` is a real state with its own wording on the page, not a swallowed
 * error: until somebody does File > Share > Publish to web on the Standings
 * tab there is no address to read, and the page says so plainly. Every other
 * way this can fail throws and takes the build with it.
 */
export async function getChampionshipStandings(): Promise<Standings | null> {
	if (CHAMPIONSHIP_CSV_URL === '') return null;

	return parseStandings(await fetchSheetCsv(CHAMPIONSHIP_CSV_URL, 'championship standings'));
}
