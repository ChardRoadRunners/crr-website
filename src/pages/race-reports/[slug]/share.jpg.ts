/**
 * The share card for one race report: /race-reports/<id>/share.jpg.
 *
 * The work is in src/utils/share-card.ts, shared with club news posts.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

import { shareCardResponse } from '../../../utils/share-card';

export const getStaticPaths = (async () => {
	const posts = await getCollection('race-reports', ({ data }) => !data.draft && Boolean(data.heroImage));
	return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ post: CollectionEntry<'race-reports'> }> = ({ props }) =>
	shareCardResponse(props.post);
