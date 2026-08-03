// Test the playback time label formatting functions.
// The labels are used in the video and music players, and in the settings preview.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {
	PLAYBACK_TIME_DISPLAYS,
	PLAYBACK_TIME_SLOTS,
	formatPlaybackDuration,
	formatPlaybackEndsAt,
	formatPlaybackTimeSlot,
	formatPlaybackTrailingTime,
	playbackTimeDisplayForSlot
} from './playbackTimeLabels';

// Tests written so that it is time ignorent.
const POSITION = (42 * 60) + 10;
const DURATION = (1 * 3600) + (58 * 60) + 33;

describe('formatPlaybackDuration', () => {
	test('drops the hour part below one hour', () => {
		expect(formatPlaybackDuration((4 * 60) + 5)).toBe('4:05');
		expect(formatPlaybackDuration(0)).toBe('0:00');
	});

	test('includes hours with zero-padded minutes and seconds', () => {
		expect(formatPlaybackDuration(DURATION)).toBe('1:58:33');
		expect(formatPlaybackDuration((2 * 3600) + 7)).toBe('2:00:07');
	});

	test('clamps negative and unusable values to zero', () => {
		expect(formatPlaybackDuration(-30)).toBe('0:00');
		expect(formatPlaybackDuration(NaN)).toBe('0:00');
		expect(formatPlaybackDuration(undefined)).toBe('0:00');
	});
});

describe('formatPlaybackTrailingTime', () => {
	const trailing = (mode, extra) => formatPlaybackTrailingTime({
		mode,
		position: POSITION,
		duration: DURATION,
		clockDisplay: '24-hour',
		...extra
	});

	test('totalDuration shows the full runtime', () => {
		expect(trailing('totalDuration')).toBe('1:58:33');
	});

	test('timeRemaining shows the negated remainder', () => {
		expect(trailing('timeRemaining')).toBe('-1:16:23');
	});

	test('timeRemaining never goes below zero', () => {
		expect(trailing('timeRemaining', {position: DURATION + 5})).toBe('-0:00');
	});

	test('endsAt renders a 24 hour wall-clock time', () => {
		expect(trailing('endsAt')).toMatch(/^Ends at \d{2}:\d{2}$/);
	});

	test('endsAt honours the 12 hour clock preference', () => {
		expect(trailing('endsAt', {clockDisplay: '12-hour'})).toMatch(/^Ends at \d{1,2}:\d{2} (AM|PM)$/);
	});

	test('endsAt accounts for playback speed', () => {
		const args = {position: 0, duration: 2 * 3600, clockDisplay: '24-hour'};
		const normal = formatPlaybackEndsAt(args.duration, args.clockDisplay);
		const doubled = formatPlaybackEndsAt(args.duration, args.clockDisplay, 2);
		expect(normal).not.toBe(doubled);
	});

	test('every mode falls back to the duration when it is unknown', () => {
		PLAYBACK_TIME_DISPLAYS.forEach((mode) => {
			expect(formatPlaybackTrailingTime({
				mode,
				position: 0,
				duration: 0,
				clockDisplay: '24-hour'
			})).toBe('0:00');
		});
	});
});

describe('formatPlaybackTimeSlot', () => {
	const slot = (value) => formatPlaybackTimeSlot({
		slot: value,
		position: POSITION,
		duration: DURATION,
		clockDisplay: '24-hour'
	});

	test('none collapses to an empty label', () => {
		expect(slot('none')).toBe('');
	});

	test('elapsed shows how far into the item playback is', () => {
		expect(slot('elapsed')).toBe('42:10');
	});

	test('the remaining modes match the trailing labels', () => {
		expect(slot('totalDuration')).toBe('1:58:33');
		expect(slot('timeRemaining')).toBe('-1:16:23');
		expect(slot('endsAt')).toMatch(/^Ends at \d{2}:\d{2}$/);
	});

	test('only none renders nothing', () => {
		PLAYBACK_TIME_SLOTS.forEach((value) => {
			expect(slot(value) === '').toBe(value === 'none');
		});
	});

	// The slot is a string, so an unknown value is not a valid slot. It hides it rather than guessing.
	test('an unknown slot collapses rather than guessing', () => {
		expect(slot('somethingNewer')).toBe('');
	});
});

describe('playbackTimeDisplayForSlot', () => {
	test('maps the three trailing modes through unchanged', () => {
		expect(playbackTimeDisplayForSlot('timeRemaining')).toBe('timeRemaining');
		expect(playbackTimeDisplayForSlot('endsAt')).toBe('endsAt');
		expect(playbackTimeDisplayForSlot('totalDuration')).toBe('totalDuration');
	});

	test('falls back to the total duration for slot-only modes', () => {
		expect(playbackTimeDisplayForSlot('none')).toBe('totalDuration');
		expect(playbackTimeDisplayForSlot('elapsed')).toBe('totalDuration');
	});
});
