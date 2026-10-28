/**
 * The share card for a post with a photo: what Facebook and WhatsApp show when
 * somebody shares it. The hero, cut to 1200x630 at the crop the author picked
 * in the CMS, so the card shows the same band of the photo as the page does.
 *
 * Shared by /race-reports/<id>/share.jpg and /news/<id>/share.jpg. It lived in
 * the race reports route until club news arrived on 28 October 2026.
 *
 * Built here rather than with Astro's getImage because getImage hands the crop
 * to Sharp's `position` option, which knows top, centre and bottom and nothing
 * in between. The five crop positions need upper and lower too, so the
 * rectangle is worked out by cropBox (the same arithmetic the browser uses for
 * the page) and cut with Sharp directly. Sharp is already what builds every
 * other image on the site.
 *
 * JPEG on purpose, as with every share card: preview scrapers handle it
 * everywhere and WebP patchily.
 *
 * Generated at build time like everything else; nothing here runs when a page
 * is visited.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import sharp from 'sharp';

import { cropBox, type Crop } from './crop';

const WIDTH = 1200;
const HEIGHT = 630;

/** The parts of a race report or news post the card needs. */
export interface ShareCardPost {
	id: string;
	filePath?: string;
	data: { heroImageCrop: Crop };
}

/**
 * Where the hero's original file is on disk.
 *
 * Read from the post's own frontmatter rather than from Astro's image object,
 * which only exposes the path through an internal property. The frontmatter
 * path is what the author's CMS wrote and what the schema resolved, relative
 * to the Markdown file.
 */
async function heroFile(post: ShareCardPost): Promise<string> {
	if (!post.filePath) throw new Error(`Post "${post.id}" has no file path to read its photo from.`);
	const markdown = join(process.cwd(), post.filePath);
	const frontmatter = (await readFile(markdown, 'utf8')).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
	// One line, as the CMS writes it: `heroImage: ./images/name.webp`, quotes optional.
	const path = frontmatter.match(/^heroImage:\s*['"]?([^'"\r\n]+?)['"]?\s*$/m)?.[1];
	if (!path) {
		throw new Error(`Post "${post.id}" has a photo, but no heroImage path could be read from ${post.filePath}.`);
	}
	return resolve(dirname(markdown), path);
}

/** The finished card, as a JPEG response. */
export async function shareCardResponse(post: ShareCardPost): Promise<Response> {
	// rotate() with no angle follows the phone's own orientation flag first, so
	// the crop is worked out on the photo the right way up, as the page shows it.
	const { data, info } = await sharp(await heroFile(post))
		.rotate()
		.toBuffer({ resolveWithObject: true });

	const box = cropBox(info.width, info.height, WIDTH, HEIGHT, post.data.heroImageCrop);

	const card = await sharp(data)
		.extract(box)
		.resize(WIDTH, HEIGHT)
		.jpeg({ quality: 82, mozjpeg: true })
		.toBuffer();

	return new Response(new Uint8Array(card), { headers: { 'Content-Type': 'image/jpeg' } });
}
