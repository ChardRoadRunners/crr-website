/**
 * Everything that counts as news, newest first: handicap results, race
 * reports and club news posts.
 *
 * The News page lists all of it; the homepage's "What's happening" shows the
 * top of it. Both read from here so the two can never disagree about what is
 * newest.
 *
 * Each kind keeps its own date rule — this module only puts them in one line:
 *
 * - a handicap night is dated by the night (the sheet's Date column);
 * - a race report by its earliest race, via getEarliestRaceDate, exactly as
 *   the race reports page orders it;
 * - a club news post by the day it was posted, its only date.
 *
 * Drafts are left out, as everywhere else.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

import { getHandicapResults, type HandicapNight } from './handicap-results';
import { getEarliestRaceDate } from './race-reports';

export type FeedItem =
	| { kind: 'handicap'; date: Date; href: string; night: HandicapNight }
	| { kind: 'report'; date: Date; href: string; post: CollectionEntry<'race-reports'> }
	| { kind: 'news'; date: Date; href: string; post: CollectionEntry<'news'> };

export type PostItem = Extract<FeedItem, { kind: 'report' | 'news' }>;

export const reportHref = (id: string) => `/race-reports/${id}/`;
export const newsHref = (id: string) => `/news/${id}/`;
export const nightHref = (dateIso: string) => `/results/handicap/${dateIso}/`;

/**
 * On the same day, a result before a post about it, and club news before a
 * race report. Only breaks ties; the date decides everything else.
 */
const KIND_ORDER: Record<FeedItem['kind'], number> = { handicap: 0, news: 1, report: 2 };

const newestFirst = (a: FeedItem, b: FeedItem) =>
	b.date.getTime() - a.date.getTime() || KIND_ORDER[a.kind] - KIND_ORDER[b.kind];

/** Race reports and club news posts, newest first. No results. */
export async function getPosts(): Promise<PostItem[]> {
	const [reports, news] = await Promise.all([
		getCollection('race-reports', ({ data }) => !data.draft),
		getCollection('news', ({ data }) => !data.draft),
	]);

	const items: PostItem[] = [
		...reports.map((post) => ({
			kind: 'report' as const,
			date: getEarliestRaceDate(post.data.races),
			href: reportHref(post.id),
			post,
		})),
		...news.map((post) => ({
			kind: 'news' as const,
			date: post.data.posted,
			href: newsHref(post.id),
			post,
		})),
	];
	return items.sort(newestFirst);
}

/**
 * Everything, newest first.
 *
 * While the handicap Results tab is not published there are simply no
 * handicap items; every other way that read can fail throws, as on the
 * results page.
 */
export async function getFeed(): Promise<FeedItem[]> {
	const [posts, handicap] = await Promise.all([getPosts(), getHandicapResults()]);
	const nights: FeedItem[] = (handicap?.nights ?? []).map((night) => ({
		kind: 'handicap',
		date: night.date,
		href: nightHref(night.dateIso),
		night,
	}));
	return [...nights, ...posts].sort(newestFirst);
}
