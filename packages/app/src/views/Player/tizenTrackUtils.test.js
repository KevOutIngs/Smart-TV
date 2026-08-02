 import {mapJellyfinTrackToTizen} from './tizenTrackUtils';

const avplayTrack = (index, type) => ({index, type});
const stream = (index, codec) => ({index, codec});

describe('mapJellyfinTrackToTizen', () => {
	it('pairs positionally when the counts agree', () => {
		const tracks = [avplayTrack(0, 'AUDIO'), avplayTrack(1, 'AUDIO')];
		const streams = [stream(1, 'ac3'), stream(2, 'aac')];

		expect(mapJellyfinTrackToTizen(tracks, streams, 'AUDIO', 2)).toBe(1);
	});

	it('ignores tracks of another type', () => {
		const tracks = [avplayTrack(0, 'TEXT'), avplayTrack(3, 'AUDIO')];
		const streams = [stream(5, 'ac3')];

		expect(mapJellyfinTrackToTizen(tracks, streams, 'AUDIO', 5)).toBe(3);
	});

	it('drops codecs AVPlay hides so the remaining pairing stays synced', () => {
		// AVPlay hides TrueHD and DTS
		const tracks = [avplayTrack(0, 'AUDIO'), avplayTrack(1, 'AUDIO')];
		const streams = [stream(1, 'dts'), stream(2, 'ac3'), stream(3, 'aac')];

		expect(mapJellyfinTrackToTizen(tracks, streams, 'AUDIO', 2)).toBe(0);
		expect(mapJellyfinTrackToTizen(tracks, streams, 'AUDIO', 3)).toBe(1);
	});

	it('keeps the requested stream even when its codec is one AVPlay hides', () => {
		const tracks = [avplayTrack(0, 'AUDIO'), avplayTrack(1, 'AUDIO')];
		const streams = [stream(1, 'truehd'), stream(2, 'dts'), stream(3, 'ac3')];

		expect(mapJellyfinTrackToTizen(tracks, streams, 'AUDIO', 1)).toBe(0);
	});

	it('keeps a requested DTS stream for the same reason', () => {
		const tracks = [avplayTrack(0, 'AUDIO'), avplayTrack(1, 'AUDIO')];
		const streams = [stream(1, 'ac3'), stream(2, 'dts'), stream(3, 'truehd')];

		expect(mapJellyfinTrackToTizen(tracks, streams, 'AUDIO', 2)).toBe(1);
	});

	it('returns null when AVPlay reports no tracks of that type', () => {
		expect(mapJellyfinTrackToTizen([], [stream(1, 'ac3')], 'AUDIO', 1)).toBeNull();
	});

	it('returns null when the requested index is not in the stream list', () => {
		const tracks = [avplayTrack(0, 'AUDIO')];

		expect(mapJellyfinTrackToTizen(tracks, [stream(1, 'ac3')], 'AUDIO', 9)).toBeNull();
	});

	it('returns null when the paired position exceeds the track list', () => {
		const tracks = [avplayTrack(0, 'TEXT')];
		const streams = [stream(1, 'srt'), stream(2, 'srt')];

		expect(mapJellyfinTrackToTizen(tracks, streams, 'TEXT', 2)).toBeNull();
	});

	it('maps an embedded text track positionally', () => {
		const tracks = [avplayTrack(0, 'TEXT'), avplayTrack(1, 'TEXT')];
		const streams = [stream(2, 'subrip'), stream(3, 'subrip')];

		expect(mapJellyfinTrackToTizen(tracks, streams, 'TEXT', 3)).toBe(1);
	});

	it('tolerates missing or malformed input', () => {
		expect(mapJellyfinTrackToTizen(null, null, 'AUDIO', 1)).toBeNull();
		expect(mapJellyfinTrackToTizen([avplayTrack(0, 'AUDIO')], [{index: 1}], 'AUDIO', 1)).toBe(0);
	});
});
