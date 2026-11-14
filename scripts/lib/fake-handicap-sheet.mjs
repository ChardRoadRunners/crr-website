// A pretend CRR Handicap sheet, for running sheets/handicap/setup.gs in Node.
//
// The real script only runs inside Google Sheets, where nothing can test it
// before a race night. This stands in for the handful of SpreadsheetApp calls
// the script makes, and for the three Runners formulas it depends on
// (Start time to use, Handicaps run, First handicap next time?), so that
// scripts/check-handicap-night.mjs can drive a whole night through the same
// functions the timing page calls.
//
// It is a stand-in, not a spreadsheet: it knows this sheet's layout and no
// other. If a column moves in setup.gs (COL, SET), move it here too.

import { readFileSync } from 'node:fs';

const DAY = 86400;
const here = (file) => new URL(`../../sheets/handicap/${file}`, import.meta.url);

const clockText = (fraction) => {
	const s = Math.round(fraction * DAY);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const show = (v) => {
	if (v === null || v === undefined || v === '') return '';
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
	if (typeof v === 'number' && v > 0 && v < 1) return clockText(v);
	return String(v);
};

class Sheet {
	constructor(book, name, rows, columns) {
		this.book = book;
		this.name = name;
		this.columns = columns;
		this.cells = rows.map((r) => r.slice());
	}
	cell(r, c) { return (this.cells[r - 1] || [])[c - 1] ?? ''; }
	put(r, c, v) {
		if (c > this.columns) throw new Error(`${this.name}: column ${c} is off the edge of the sheet (it has ${this.columns})`);
		while (this.cells.length < r) this.cells.push([]);
		this.cells[r - 1][c - 1] = v;
	}
	getLastRow() {
		for (let r = this.cells.length; r >= 1; r -= 1) if ((this.cells[r - 1] || []).some((v) => v !== '' && v !== undefined && v !== null)) return r;
		return 0;
	}
	getMaxColumns() { return this.columns; }
	insertColumnsAfter(_after, howMany) { this.columns += howMany; }
	getIndex() { return this.book.order.indexOf(this.name) + 1; }
	setFrozenRows() {}
	getRange(row, col, numRows = 1, numCols = 1) {
		const sheet = this;
		const each = (fn) => { for (let r = 0; r < numRows; r += 1) for (let c = 0; c < numCols; c += 1) fn(row + r, col + c, r, c); };
		const grid = (fn) => Array.from({ length: numRows }, (_, r) => Array.from({ length: numCols }, (_, c) => fn(sheet.cell(row + r, col + c))));
		const range = {
			getValues: () => { sheet.book.recalc(); return grid((v) => v); },
			getDisplayValues: () => { sheet.book.recalc(); return grid(show); },
			getValue: () => range.getValues()[0][0],
			getDisplayValue: () => range.getDisplayValues()[0][0],
			setValue: (v) => { each((r, c) => sheet.put(r, c, v)); return range; },
			setValues: (vs) => { each((r, c, i, j) => sheet.put(r, c, vs[i][j])); return range; },
			clearContent: () => { each((r, c) => sheet.put(r, c, '')); return range; },
			// The formulas the upgrade writes are recorded, not run: recalc() below is
			// this file's own version of what they work out.
			setFormula: (f) => { sheet.book.formulas[`${sheet.name}!R${row}C${col}`] = f; return range; },
			// As in Sheets: every cell in the range becomes an unticked box, whatever it held.
			insertCheckboxes: () => { each((r, c) => sheet.put(r, c, false)); return range; },
			setNumberFormat: () => range,
			setNote: () => range,
			setFontWeight: () => range,
			copyFormatToRange: () => range,
		};
		return range;
	}
}

/**
 * `runners`: [{ name, simonStart, suggested }] — suggested in seconds, or
 * omitted for nobody-knows. `history`: [{ dateIso, name, runSeconds }].
 */
export function makeSheet({ runners, history = [], raceDateIso, raceLabel, pin = '1981', version = '1.1' }) {
	const book = { sheets: {}, order: [], formulas: {} };
	const add = (name, rows, columns) => { book.sheets[name] = new Sheet(book, name, rows, columns); book.order.push(name); };

	// Runners as version 1.1 left it: 16 columns, no "first time" tick.
	const runnerRows = [['Name', 'M or F', 'Running tonight', 'Finish token', "Simon's start time", "Simon's note",
		'Start time to use', 'Suggested start time', 'Why', 'Last handicap run', 'Last run time', 'Handicaps run',
		'(latest start time)', '(last run date)', '(start time that night)', 'First handicap next time?']];
	for (const r of runners) {
		const row = Array(16).fill('');
		row[0] = r.name; row[2] = false; row[4] = r.simonStart ?? '';
		row[7] = r.suggested === undefined ? '' : r.suggested / DAY;
		runnerRows.push(row);
	}
	add('Start list', [['Runner', 'Start time', 'Go at', 'Note']], 10);
	add('Runners', runnerRows, 16);
	add('History', [['Date', 'Race', 'Runner', 'Start time', 'Run time', 'Position', 'Winner', 'First handicap', 'Go at', 'Clock time', 'Note'],
		...history.map((h) => [new Date(`${h.dateIso}T12:00:00Z`), h.dateIso, h.name, '', h.runSeconds / DAY, '', '', '', '', '', ''])], 11);
	add('Timing', [['Position', 'Clock time', 'Clock (seconds)', 'Tap ID', 'Recorded at']], 5);
	add('Settings', [['Setting', 'Value', 'Notes'], ['This race (date)', new Date(`${raceDateIso}T12:00:00Z`), ''], ['This race', raceLabel, ''],
		['Step', 15, ''], ['Off night', 60, ''], ['Timing page PIN', pin, ''], ['Clock started at', '', ''], ['Timing page link', '', '']], 3);

	// What the three Runners formulas work out, in both their 1.1 and 1.2 forms.
	book.recalc = () => {
		const sh = book.sheets.Runners;
		const upgraded = `Runners!R2C16` in book.formulas;
		const hist = book.sheets.History.cells.slice(1);
		for (let r = 2; r <= sh.cells.length; r += 1) {
			const name = sh.cell(r, 1);
			if (!name) continue;
			const simon = String(sh.cell(r, 5)).trim();
			let use = sh.cell(r, 8);
			if (simon !== '') {
				if (upgraded && simon.toLowerCase() === 'guest') use = 'Guest';
				else {
					const m = /^(\d+)[:.](\d\d)$/.exec(simon);
					use = m ? (Number(m[1]) * 60 + Number(m[2])) / DAY : "Check Simon's start time";
				}
			}
			const runs = hist.filter((h) => h[2] === name && h[4] !== '' && h[4] !== undefined).length;
			sh.cells[r - 1][6] = use;
			sh.cells[r - 1][11] = runs;
			sh.cells[r - 1][15] = upgraded ? runs === 0 && sh.cell(r, 17) === true : runs === 0;
		}
	};

	const SpreadsheetApp = {
		getActiveSpreadsheet: () => ({
			getSheetByName: (n) => book.sheets[n] || null,
			getSpreadsheetTimeZone: () => 'UTC',
			insertSheet: (n) => { add(n, [], 26); return book.sheets[n]; },
		}),
		flush: () => book.recalc(),
		getUi: () => { throw new Error('No menus in the pretend sheet'); },
	};
	const LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
	const Utilities = { formatDate: (d) => d.toISOString().slice(0, 10) };

	const source = `${readFileSync(here('scoring.gs'), 'utf8')}\n${readFileSync(here('setup.gs'), 'utf8')}`;
	const names = ['api_state', 'api_setRunning', 'api_setFirstTime', 'api_addLate', 'api_addRunner', 'api_setStartTime',
		'api_startClock', 'api_resetClock', 'api_syncFinishes', 'api_setToken', 'api_result', 'api_saveRace', 'upgradeLayout_'];
	const api = new Function('SpreadsheetApp', 'LockService', 'Utilities', `${source}\nreturn { ${names.join(', ')} };`)(
		SpreadsheetApp, LockService, Utilities);
	if (version === '1.2') api.upgradeLayout_();

	return { api, book, pin, rows: (tab) => { book.recalc(); return book.sheets[tab].cells.map((r) => r.map(show)); } };
}

/**
 * What the timing page receives is not quite what the script returns: a null
 * inside an object can go missing on the way. This does that on purpose, to
 * every reply, so the page is always tested against the worse case.
 */
export function asThePageSeesIt(value) {
	return JSON.parse(JSON.stringify(value, (_k, v) => (v === null ? undefined : v)));
}
