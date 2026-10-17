/**
 * Where a hero photo is cropped from, when it is cut to a wide shape.
 *
 * Club photos are nearly all group shots, and every place a hero appears cuts
 * it wider than it was taken: 2:1 on the page and in the lists, 1200x630 on a
 * share card. A 4:3 phone photo loses a third of its height to that, a
 * portrait about two thirds, so which band survives decides whether people
 * keep their heads.
 *
 * Five positions, picked per post in the CMS, where each one is shown cropped
 * from the photo itself. The number is how far down the photo the window sits,
 * in the sense CSS `object-position` uses: 0 shows the very top, 100 the very
 * bottom, 50 the middle, and the rest proportionally between.
 *
 * Upper (25%) is the default because it was always the intention for every
 * hero: dead centre took the tops off group shots, and hard to the top turned
 * landscapes — Forde Abbey, Maiden Newton — into mostly sky. Until 17 October
 * 2026 it never actually applied (see the note on the hero in BlogPost.astro).
 *
 * ONLY WORKS IF THE <Image> HAS A WIDTH AND NO HEIGHT. Given both, Astro has
 * Sharp cut the photo to that exact shape from the centre while building, so
 * the browser receives a photo already 2:1 with nothing left for
 * object-position to move. That is how every hero was until 17 October 2026,
 * and how Rhys lost most of his head on the Bath & Bristol report. With a
 * width alone the photo keeps its own shape, and the aspect box around it,
 * `object-cover` and this position do the cropping. Files are bigger for it,
 * by the part that used to be thrown away, and that was accepted.
 *
 * The same numbers are written into the CMS picker in public/admin/index.html,
 * and the names into the heroImageCrop field in config.yml and
 * content.config.ts. Change one, change all four.
 */
export const CROPS = {
	top: 0,
	upper: 25,
	middle: 50,
	lower: 75,
	bottom: 100,
} as const;

export type Crop = keyof typeof CROPS;

export const CROP_NAMES = Object.keys(CROPS) as [Crop, ...Crop[]];

export const DEFAULT_CROP: Crop = 'upper';

/** The CSS `object-position` for a crop: always centred left to right. */
export const objectPosition = (crop: Crop = DEFAULT_CROP): string => `50% ${CROPS[crop]}%`;

/**
 * The rectangle to cut from a photo `width` x `height` so it fills a window of
 * `targetWidth` x `targetHeight` with the given crop — the same arithmetic the
 * browser does for `object-fit: cover` plus `object-position`, so the share
 * card matches the page.
 */
export function cropBox(
	width: number,
	height: number,
	targetWidth: number,
	targetHeight: number,
	crop: Crop = DEFAULT_CROP,
): { left: number; top: number; width: number; height: number } {
	const target = targetWidth / targetHeight;

	if (width / height > target) {
		// Wider than the window: trim the sides, always evenly.
		const cutWidth = Math.round(height * target);
		return { left: Math.round((width - cutWidth) / 2), top: 0, width: cutWidth, height };
	}

	// Taller than the window: trim top and bottom, by the chosen position.
	const cutHeight = Math.round(width / target);
	const spare = height - cutHeight;
	return { left: 0, top: Math.round((spare * CROPS[crop]) / 100), width, height: cutHeight };
}
