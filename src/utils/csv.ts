/**
 * A CSV parser, because the club's results live in Google Sheets.
 *
 * Deliberately not a dependency. CSV looks trivial until a field contains a
 * comma, and then every naive `split(',')` in the world is wrong — which
 * matters here because the fields are people's names and race titles, both of
 * which the committee types by hand. The whole of RFC 4180 that Google
 * actually emits is the four rules below, and it is forty lines.
 *
 * The rules:
 *
 *   1. Fields are separated by commas, records by newlines.
 *   2. A field may be wrapped in double quotes, and then it may contain
 *      commas and newlines.
 *   3. Inside a quoted field, `""` means one literal quote.
 *   4. A quote that is not at the start of a field is just a character.
 *
 * Rule 2's newline is the one that catches people out: a quoted field can span
 * lines, so splitting the file on "\n" before parsing loses rows. This walks
 * the string once instead.
 */

/**
 * Splits CSV text into rows of fields.
 *
 * Handles CRLF, LF and a trailing newline. A completely empty input gives an
 * empty list rather than one empty row, so a caller can tell "no data" from
 * "one blank line".
 */
export function parseCsv(text: string): string[][] {
	// A BOM survives Google's export and would otherwise become part of the
	// first header — "﻿Name" matches nothing that looks for "Name".
	const input = text.replace(/^﻿/, '');
	if (input === '') return [];

	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;

	for (let i = 0; i < input.length; i += 1) {
		const char = input[i];

		if (quoted) {
			if (char !== '"') {
				field += char;
				continue;
			}
			// Rule 3: a doubled quote inside a quoted field is one quote.
			if (input[i + 1] === '"') {
				field += '"';
				i += 1;
				continue;
			}
			quoted = false;
			continue;
		}

		if (char === '"' && field === '') {
			// Rule 4: only a quote opening a field starts a quoted field.
			quoted = true;
			continue;
		}

		if (char === ',') {
			row.push(field);
			field = '';
			continue;
		}

		if (char === '\n' || char === '\r') {
			// Swallow the LF of a CRLF so it does not open an empty row.
			if (char === '\r' && input[i + 1] === '\n') i += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			continue;
		}

		field += char;
	}

	// Whatever is still in hand is the last record, unless the file ended on a
	// newline — in which case there is nothing left and pushing would invent a
	// blank row.
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}
