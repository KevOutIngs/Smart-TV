// $L reaches for ilib, which a plain unit test has no way to load. Every key is its own
// English source string, so handing the string straight back is faithful enough here.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {MEDIA_STATUS, REQUEST_STATUS} from './seerrStatus';
import {
	formatCurrency, formatDate, formatRuntime, getSeasonStatusColor,
	getSeasonStatusLabel, getStatusBadge, isSeasonRerequestable, isStatusBlocked
} from './seerrBadges';

const badge = (hd, fourK, hdDeclined = false, fourKDeclined = false) =>
	getStatusBadge(hd, fourK, hdDeclined, fourKDeclined);

describe('getStatusBadge', () => {
	test('a title nobody has asked for says so', () => {
		expect(badge(MEDIA_STATUS.UNKNOWN, MEDIA_STATUS.UNKNOWN)).toEqual({text: 'NOT REQUESTED', color: 'gray'});
	});

	test('declined on both counts reads as one refusal, not two', () => {
		expect(badge(MEDIA_STATUS.PENDING, MEDIA_STATUS.PENDING, true, true)).toEqual({text: 'DECLINED', color: 'red'});
	});

	test('declined outranks whatever the other quality is doing', () => {
		expect(badge(MEDIA_STATUS.AVAILABLE, MEDIA_STATUS.PENDING, false, true))
			.toEqual({text: 'HD AVAILABLE • 4K DECLINED', color: 'mixed'});
		expect(badge(MEDIA_STATUS.PENDING, MEDIA_STATUS.AVAILABLE, true, false))
			.toEqual({text: 'HD DECLINED • 4K AVAILABLE', color: 'mixed'});
	});

	test('both available collapses to one badge', () => {
		expect(badge(MEDIA_STATUS.AVAILABLE, MEDIA_STATUS.AVAILABLE)).toEqual({text: 'HD + 4K AVAILABLE', color: 'green'});
	});

	test('one available names which one', () => {
		expect(badge(MEDIA_STATUS.AVAILABLE, MEDIA_STATUS.UNKNOWN)).toEqual({text: 'HD AVAILABLE', color: 'green'});
		expect(badge(MEDIA_STATUS.UNKNOWN, MEDIA_STATUS.AVAILABLE)).toEqual({text: '4K AVAILABLE', color: 'green'});
	});

	test('a mixed pair names both sides', () => {
		expect(badge(MEDIA_STATUS.PARTIALLY_AVAILABLE, MEDIA_STATUS.PROCESSING))
			.toEqual({text: 'HD PARTIAL • 4K PROCESSING', color: 'mixed'});
		expect(badge(MEDIA_STATUS.PENDING, MEDIA_STATUS.PROCESSING))
			.toEqual({text: 'HD PENDING • 4K PROCESSING', color: 'mixed'});
	});

	test('a matching pair collapses rather than naming both', () => {
		expect(badge(MEDIA_STATUS.PARTIALLY_AVAILABLE, MEDIA_STATUS.PARTIALLY_AVAILABLE)).toEqual({text: 'PARTIALLY AVAILABLE', color: 'purple'});
		expect(badge(MEDIA_STATUS.PROCESSING, MEDIA_STATUS.PROCESSING)).toEqual({text: 'PROCESSING', color: 'indigo'});
		expect(badge(MEDIA_STATUS.PENDING, MEDIA_STATUS.PENDING)).toEqual({text: 'PENDING', color: 'yellow'});
	});

	test('further along wins when the two disagree', () => {
		expect(badge(MEDIA_STATUS.PARTIALLY_AVAILABLE, MEDIA_STATUS.UNKNOWN).text).toBe('HD PARTIALLY AVAILABLE');
		expect(badge(MEDIA_STATUS.PROCESSING, MEDIA_STATUS.UNKNOWN).text).toBe('HD PROCESSING');
		expect(badge(MEDIA_STATUS.PENDING, MEDIA_STATUS.UNKNOWN).text).toBe('HD PENDING');
	});

	test('blacklisted shows only once nothing else applies', () => {
		expect(badge(MEDIA_STATUS.BLOCKLISTED, MEDIA_STATUS.UNKNOWN)).toEqual({text: 'BLACKLISTED', color: 'red'});
		expect(badge(MEDIA_STATUS.BLOCKLISTED, MEDIA_STATUS.AVAILABLE).text).toBe('4K AVAILABLE');
	});

	// Whatever the pairing, the viewer gets a badge rather than a blank space.
	test('every pairing of the media states produces a badge', () => {
		const all = Object.values(MEDIA_STATUS);
		all.forEach((hd) => {
			all.forEach((fourK) => {
				const result = badge(hd, fourK);
				expect(typeof result.text).toBe('string');
				expect(result.text.length).toBeGreaterThan(0);
				expect(result.color).toBeTruthy();
			});
		});
	});
});

describe('isStatusBlocked', () => {
	test('a title already asked for cannot be asked for again', () => {
		expect(isStatusBlocked(MEDIA_STATUS.PENDING)).toBe(true);
		expect(isStatusBlocked(MEDIA_STATUS.PROCESSING)).toBe(true);
		expect(isStatusBlocked(MEDIA_STATUS.AVAILABLE)).toBe(true);
	});

	test('partially available stays open, since the missing seasons can still be asked for', () => {
		expect(isStatusBlocked(MEDIA_STATUS.PARTIALLY_AVAILABLE)).toBe(false);
	});

	test('unknown and nothing at all stay open', () => {
		expect(isStatusBlocked(MEDIA_STATUS.UNKNOWN)).toBe(false);
		expect(isStatusBlocked(null)).toBe(false);
		expect(isStatusBlocked(undefined)).toBe(false);
	});
});

describe('season status', () => {
	test('each request state has a label and a colour', () => {
		Object.values(REQUEST_STATUS).forEach((status) => {
			expect(getSeasonStatusLabel(status)).toBeTruthy();
			expect(getSeasonStatusColor(status)).toBeTruthy();
		});
	});

	test('an unrecognised state falls back rather than showing a label', () => {
		expect(getSeasonStatusLabel(99)).toBeNull();
		expect(getSeasonStatusColor(99)).toBe('gray');
	});

	test('only declined and failed can be asked for again', () => {
		expect(isSeasonRerequestable(REQUEST_STATUS.DECLINED)).toBe(true);
		expect(isSeasonRerequestable(REQUEST_STATUS.FAILED)).toBe(true);
		expect(isSeasonRerequestable(REQUEST_STATUS.PENDING)).toBe(false);
		expect(isSeasonRerequestable(REQUEST_STATUS.COMPLETED)).toBe(false);
	});
});

describe('formatters', () => {
	test('runtime reads in hours and minutes, and takes minutes', () => {
		expect(formatRuntime(90)).toBe('1h 30m');
		expect(formatRuntime(45)).toBe('45m');
		expect(formatRuntime(120)).toBe('2h 0m');
		expect(formatRuntime(0)).toBeNull();
	});

	// The exact wording follows the viewer's locale, so only the empty cases are pinned.
	test('a date renders, and nothing renders when there is no date', () => {
		expect(formatDate('2026-03-01')).toBeTruthy();
		expect(formatDate(null)).toBeNull();
		expect(formatDate('')).toBeNull();
	});

	test('currency drops anything that is not a real amount', () => {
		expect(formatCurrency(0)).toBeNull();
		expect(formatCurrency(-5)).toBeNull();
		expect(formatCurrency(null)).toBeNull();
		expect(formatCurrency(1000)).toContain('1,000');
	});
});
