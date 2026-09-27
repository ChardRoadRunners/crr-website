/**
 * Reading a published Google Sheet tab as CSV, at build time.
 *
 * The committee keeps the results in Google Sheets, which is where they
 * already work. "File > Share > Publish to web > (the tab) > CSV" turns one
 * tab into a plain CSV at a fixed address, and this fetches it while the site
 * builds. Nothing here runs in a visitor's browser — the only request to
 * Google happens on the build machine, the same arrangement as the calendars
 * in `calendar.ts` and for the same reason.
 *
 * Because the site is built rather than live, a page is only as current as the
 * last build. The nightly rebuild in `workers/diary-rebuild/` is what keeps
 * results moving without anybody pushing a commit.
 *
 * WHY NOT the Sheets API: it needs a key, the key needs somewhere to live, and
 * somebody has to rotate it. Publish-to-web needs a URL. The trade is that the
 * published tab is readable by anyone who has the address, which is fine —
 * these are names and finishing times that go on a public web page anyway, and
 * the sheet's private tabs are not published. See docs/results.md.
 *
 * ONE RETRY POLICY, shared with calendar.ts by convention rather than by code:
 * that module owns a queue and per-calendar error wording that do not belong
 * here, and its behaviour is pinned by check-calendar.mjs. Merging the two is
 * worth doing when a third caller appears, not before.
 */
import { parseCsv } from './csv.ts';

/**
 * Statuses worth trying again, and the reasoning is calendar.ts's verbatim:
 * 429 is Google saying "not right now", not "no". Cloudflare builds from a
 * shared pool of addresses, so the rate limit can be spent by traffic that has
 * nothing to do with this club.
 *
 * 404 is deliberately absent. That means the tab is not published, it will
 * 404 again in ten seconds, and the build should say so at once.
 */
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long to wait before attempt number `attempt` (1-based).
 *
 * Honours Retry-After in either of its forms — a count of seconds, or an HTTP
 * date — and otherwise doubles. Exported so the wait is testable without
 * actually waiting.
 */
export function retryDelayMs(attempt: number, retryAfter?: string | null, now = Date.now()): number {
	const backoff = Math.min(BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
	if (!retryAfter) return backoff;

	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds)) {
		return Math.min(Math.max(seconds, 0) * 1_000, MAX_BACKOFF_MS);
	}

	const when = Date.parse(retryAfter);
	if (Number.isNaN(when)) return backoff;

	return Math.min(Math.max(when - now, 0), MAX_BACKOFF_MS);
}

/**
 * What a failing status means, in words aimed at whoever has to fix it.
 *
 * Exported so the wording is pinned by the checks. The 404 case is the one
 * that will actually happen: somebody duplicates the sheet, or un-publishes a
 * tab while tidying up, and the address stops resolving.
 */
export function describeStatus(label: string, status: number, statusText: string): string {
	const head = `The ${label} sheet returned ${status} ${statusText}.`;

	if (status === 404 || status === 400) {
		return (
			`${head} That almost always means the tab is no longer published — in ` +
			'Google Sheets, File > Share > Publish to web, and check the right tab ' +
			'is still listed and still set to CSV.'
		);
	}
	if (RETRY_STATUSES.has(status)) {
		return (
			`${head} That is a "try later", and it was already retried ${MAX_ATTEMPTS} ` +
			'times with backoff, so Google is still refusing. Nothing is wrong with the ' +
			'sheet itself — a build machine sharing an address with noisy neighbours ' +
			'can spend the rate limit. Re-run the build.'
		);
	}
	return `${head} Check the tab is still published to the web as CSV.`;
}

/** One fetch per URL per build, so two pages reading the same tab share it. */
const inFlight = new Map<string, Promise<string[][]>>();

/**
 * Fetches one published tab and parses it into rows.
 *
 * Fails loudly on purpose, exactly as the calendars do. A results page that
 * quietly has nothing on it is worse than a red build, because nobody notices
 * until a member asks where the standings went — and by then it has been wrong
 * for a fortnight.
 *
 * `label` only ever appears in error messages; it is what the person reading a
 * failed build calls this sheet.
 */
export function fetchSheetCsv(url: string, label: string): Promise<string[][]> {
	const cached = inFlight.get(url);
	if (cached) return cached;

	const work = async (): Promise<string[][]> => {
		let lastProblem = '';

		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
			let response: Response;
			try {
				response = await fetch(url, { redirect: 'follow' });
			} catch (cause) {
				// A dropped connection is the same kind of "later" as a 429.
				lastProblem = `The ${label} sheet could not be reached: ${(cause as Error).message}`;
				if (attempt === MAX_ATTEMPTS) break;
				await sleep(retryDelayMs(attempt));
				continue;
			}

			if (response.ok) {
				const body = await response.text();
				assertNotHtml(body, label);
				return parseCsv(body);
			}

			lastProblem = describeStatus(label, response.status, response.statusText);

			// Anything that is not a "try later" is a real answer. Say so now.
			if (!RETRY_STATUSES.has(response.status)) throw new Error(lastProblem);

			if (attempt === MAX_ATTEMPTS) break;
			await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
		}

		throw new Error(lastProblem);
	};

	const pending = work();
	inFlight.set(url, pending);
	return pending;
}

/**
 * Google answers an un-published tab with a 200 and a sign-in page.
 *
 * That is the nastiest failure available here, because every status check
 * passes and the CSV parser happily turns HTML into one very strange row. The
 * same trap as the calendars serving an HTML error page, caught the same way:
 * look at what actually came back.
 */
export function assertNotHtml(body: string, label: string): void {
	const head = body.trimStart().slice(0, 200).toLowerCase();
	if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.includes('<head>')) {
		throw new Error(
			`The ${label} sheet returned an HTML page rather than CSV. Google serves ` +
				'a sign-in page when a tab is not published, so this is the same problem ' +
				'as a 404: File > Share > Publish to web, and publish the tab as CSV.',
		);
	}
}
