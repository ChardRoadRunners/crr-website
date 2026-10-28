import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getPosts } from '../utils/news';

// Race reports and club news posts, newest first, each dated by its own rule
// (see src/utils/news.ts). Handicap results are not in the feed: they are a
// table, not a post, and the News page is where they sit among the posts.
export async function GET(context) {
	const posts = await getPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map(({ post, date, href }) => ({
			title: post.data.title,
			description: post.data.excerpt,
			pubDate: date,
			link: href,
		})),
	});
}
