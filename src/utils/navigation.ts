/**
 * The site's menus, read from content.
 *
 * One place, because three components need the same two lists — the header,
 * the footer and the 404 page — and a menu that differs between them is a menu
 * somebody half-edited.
 *
 * Nothing here decides what the menus say. That is
 * `src/content/navigation/navigation.md`, which the committee can edit in the
 * CMS. This only fetches it and answers the two questions a template has about
 * a link: is it external, and is it the page we are on.
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

/**
 * Whether `href` is the page currently being rendered.
 *
 * Matches the section as well as the page itself, so /race-reports stays
 * marked while reading a report inside it. A hash is ignored: /calendar and
 * /calendar#race-calendar are the same page, and marking both current would
 * put two current-page markers in one menu.
 */
export function isCurrent(href: string, pathname: string): boolean {
	if (isExternal(href)) return false;

	const target = href.split('#')[0].replace(/\/$/, '') || '/';
	const here = pathname.replace(/\/$/, '') || '/';

	if (target === '/') return here === '/';
	return here === target || here.startsWith(`${target}/`);
}
