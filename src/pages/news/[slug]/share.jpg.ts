/**
 * The share card for one club news post: /news/<id>/share.jpg.
 *
 * The work is in src/utils/share-card.ts, shared with race reports.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

import { shareCardResponse } from '../../../utils/share-card';

export const getStaticPaths = (async () => {
	const posts = await getCollection('news', ({ data }) => !data.draft && Boolean(data.heroImage));
	return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ post: CollectionEntry<'news'> }> = ({ props }) => shareCardResponse(props.post);
