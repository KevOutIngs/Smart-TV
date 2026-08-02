import {isHdrVideoStream, findVideoStream, isHdrOutput} from './videoRange';

describe('isHdrVideoStream', () => {
	it.each(['HDR10', 'HDR10Plus', 'HLG', 'DOVI'])('treats %s as HDR', (rangeType) => {
		expect(isHdrVideoStream({VideoRangeType: rangeType})).toBe(true);
	});

	it('treats SDR as not HDR', () => {
		expect(isHdrVideoStream({VideoRangeType: 'SDR'})).toBe(false);
	});

	it('falls back to VideoRange when the type is missing', () => {
		expect(isHdrVideoStream({VideoRange: 'HDR'})).toBe(true);
		expect(isHdrVideoStream({VideoRange: 'SDR'})).toBe(false);
	});

	it('prefers the type over the coarse field', () => {
		expect(isHdrVideoStream({VideoRangeType: 'SDR', VideoRange: 'HDR'})).toBe(false);
	});

	it('handles missing input', () => {
		expect(isHdrVideoStream(null)).toBe(false);
		expect(isHdrVideoStream({})).toBe(false);
	});
});

describe('findVideoStream', () => {
	it('picks the video stream out of a media source', () => {
		const source = {MediaStreams: [{Type: 'Audio'}, {Type: 'Video', Codec: 'hevc'}]};

		expect(findVideoStream(source).Codec).toBe('hevc');
	});

	it('returns null when there is none', () => {
		expect(findVideoStream({MediaStreams: [{Type: 'Audio'}]})).toBeNull();
		expect(findVideoStream(null)).toBeNull();
	});
});

describe('isHdrOutput', () => {
	const hdrSource = {MediaStreams: [{Type: 'Video', VideoRangeType: 'HDR10'}]};

	it('is HDR when an HDR stream is not being transcoded', () => {
		expect(isHdrOutput(hdrSource, false)).toBe(true);
	});

	// if transcodng hdr is gone
	it('is not HDR while transcoding', () => {
		expect(isHdrOutput(hdrSource, true)).toBe(false);
	});

	it('is not HDR for an SDR source', () => {
		expect(isHdrOutput({MediaStreams: [{Type: 'Video', VideoRangeType: 'SDR'}]}, false)).toBe(false);
	});
});
