// Downloads the club's five Google calendars into src/data/calendars/.
//
// Run every night by .github/workflows/fetch-calendars.yml, or by hand:
//
//   node --experimental-strip-types --no-warnings scripts/fetch-calendars.mjs
//
// WHY THIS EXISTS: builds used to fetch the calendars from Google themselves.
// Cloudflare's build machines share their internet addresses with everyone
// else's builds, so Google regularly refused them for asking too often, and
// the site stopped deploying on commits that had nothing wrong with them —
// three times in a week in September, three more in two days in October.
// Now builds read the copies saved here and never contact Google, and this
// script is the only thing that does. It runs overnight with nobody waiting on
// it, so it can afford to be far more patient than a build could.
//
// A FILE IS ONLY WRITTEN WHEN SOMETHING CHANGED. Google stamps every event with
// the time of the download (the DTSTAMP line), so two downloads a minute apart
// never match byte for byte. Those lines are ignored when comparing, otherwise
// every night would make a commit and a build for nothing.
//
// IF A CALENDAR FAILS, its old copy is left exactly as it was, the others are
// still saved, and the script exits with an error so the workflow opens a
// "Calendar fetch failing" issue. The site keeps showing the last good copy
// until it is fixed.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CALENDAR_IDS } from '../src/consts.ts';
import { downloadFeed } from '../src/utils/calendar.ts';

const DIR = join(process.cwd(), 'src', 'data', 'calendars');

// Eight tries, waiting up to a minute between them: about two minutes per
// calendar before giving up, against half a minute in the old build.
const PATIENCE = { attempts: 8, maxBackoffMs: 60_000 };

// DTSTAMP changes on every download; line endings vary with how a file was
// checked out. Neither is a change to the calendar.
const comparable = (ics) =>
	ics
		.replace(/\r\n/g, '\n')
		.split('\n')
		.filter((line) => !line.startsWith('DTSTAMP:'))
		.join('\n')
		.trim();

await mkdir(DIR, { recursive: true });

const problems = [];

// One at a time, never all at once: five requests at the same instant is what
// got the builds refused in the first place.
for (const source of Object.keys(CALENDAR_IDS)) {
	const file = join(DIR, `${source}.ics`);
	try {
		const fresh = await downloadFeed(source, PATIENCE);
		const old = await readFile(file, 'utf8').catch(() => null);

		if (old !== null && comparable(old) === comparable(fresh)) {
			console.log(`${source}: unchanged`);
			continue;
		}
		await writeFile(file, fresh);
		console.log(`${source}: ${old === null ? 'saved for the first time' : 'updated'}`);
	} catch (error) {
		problems.push(error.message);
		console.error(`${source}: FAILED, old copy kept. ${error.message}`);
	}
}

if (problems.length) {
	console.error(`\n${problems.length} of ${Object.keys(CALENDAR_IDS).length} calendars failed.`);
	process.exit(1);
}
