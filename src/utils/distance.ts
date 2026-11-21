type Unit = "km" | "mi";

interface Distance {
	value: number;
	unit: Unit;
}

const KM_PER_MILE = 1.609344;

const otherUnit = (unit: Unit): Unit => (unit === "km" ? "mi" : "km");

const convert = (distance: Distance, to: Unit): number =>
	distance.unit === to
		? distance.value
		: to === "mi"
			? distance.value / KM_PER_MILE
			: distance.value * KM_PER_MILE;

// Whole numbers stay whole, so a 10k reads "10km" and not "10.0km". Anything
// else gets one decimal, which is how race distances are quoted — 13.1mi,
// 26.2mi — and a converted value that lands on .0 drops it again.
const round = (value: number): string =>
	Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");

const format = (distance: Distance, unit: Unit): string => `${round(convert(distance, unit))}${unit}`;

/**
 * A race distance in the unit it was entered in, with the other alongside:
 * "10km (6.2mi)".
 *
 * Both are always shown. An earlier version made this a preference with a
 * switch in the nav, which was worse: anyone who did not notice the control
 * was left doing the conversion in their head, and most people would not
 * notice it. Showing both costs a few characters and asks nothing of anyone.
 *
 * distance is { value, unit } rather than a string precisely so this can be
 * worked out — always render through here, never raw.
 */
export function formatDistance(distance: Distance): string {
	return `${format(distance, distance.unit)} (${format(distance, otherUnit(distance.unit))})`;
}

/**
 * The same two figures as formatDistance, kept apart so a layout can stack
 * them: { primary: "10.1km", other: "6.3mi" }. Same rounding, same units —
 * only the brackets are left out. Used by the route tiles, where the pair on
 * one line wrapped on a phone.
 */
export function distanceParts(distance: Distance): { primary: string; other: string } {
	return { primary: format(distance, distance.unit), other: format(distance, otherUnit(distance.unit)) };
}
