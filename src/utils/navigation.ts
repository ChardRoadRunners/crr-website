/**
 * The site's menus, read from content.
 *
 * One place, because three components need the same two lists — the header,
 * the footer and the 404 page — and a menu that differs between them is a menu
 * somebody half-edited.
 *
 * Nothing here decides what the menus say. That is
 * `src/content/navigation/navigation.md`, which the committee can edit in the
 * CMS. This only fetches it and says whether a link leaves the site.
 *
 * Marking the current page is HeaderLink's job, not this file's — it already
 * did it, including matching a section from one of its pages.
 */
import { getEntry } from 'astro:content';

export interface NavLink {
	label: string;
	href: string;
}

export interface FooterGroup {
	label: string;
	links: NavLink[];
}

export interface SiteNavigation {
	primary: NavLink[];
	/** The header's call-to-action button, shown on every page. */
	cta: NavLink;
	footerGroups: FooterGroup[];
}

/**
 * Loud rather than empty.
 *
 * A missing navigation file would otherwise render a header with no links and
 * a footer with no welfare contact, which looks like a styling bug and is the
 * kind of thing that ships.
 */
export async function getNavigation(): Promise<SiteNavigation> {
	const entry = await getEntry('navigation', 'navigation');
	if (!entry) {
		throw new Error(
			'src/content/navigation/navigation.md is missing — the site has no menus without it.',
		);
	}
	return entry.data;
}

/**
 * Whether a link leaves the site.
 *
 * Derived from the href rather than stored as a flag, so an editor adding a
 * link in the CMS cannot forget to tick it and ship an external link without
 * `rel="noopener"`.
 */
export const isExternal = (href: string): boolean => /^https?:\/\//i.test(href);

