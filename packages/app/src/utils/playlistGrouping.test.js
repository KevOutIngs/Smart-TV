jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {
	groupPlaylists, playlistCategoryFromItems, playlistNeedsItemCheck,
	playlistSummaryCategory, resolveItemMediaType
} from './playlistGrouping';

describe('resolveItemMediaType', () => {
	it('lets the concrete type win over the media type', () => {
		expect(resolveItemMediaType({Type: 'MusicVideo', MediaType: 'Audio'})).toBe('Video');
		expect(resolveItemMediaType({Type: 'AudioBook', MediaType: 'Audio'})).toBe('AudioBook');
		expect(resolveItemMediaType({Type: 'Audio'})).toBe('Audio');
		expect(resolveItemMediaType({MediaType: 'Video'})).toBe('Video');
		expect(resolveItemMediaType({})).toBe('Unknown');
	});
});

describe('playlistSummaryCategory and playlistNeedsItemCheck', () => {
	it('takes specific summaries at face value', () => {
		const video = {Type: 'Playlist', MediaType: 'Video', ChildCount: 3};
		expect(playlistSummaryCategory(video)).toBe('Video');
		expect(playlistNeedsItemCheck(video)).toBe(false);
	});

	it('marks an empty playlist Mixed without a check', () => {
		const empty = {Type: 'Playlist', MediaType: 'Audio', ChildCount: 0};
		expect(playlistSummaryCategory(empty)).toBe('Mixed');
		expect(playlistNeedsItemCheck(empty)).toBe(false);
	});

	it('asks for an item check when the summary says Audio', () => {
		const audio = {Type: 'Playlist', MediaType: 'Audio', ChildCount: 5};
		expect(playlistSummaryCategory(audio)).toBe('Audio');
		expect(playlistNeedsItemCheck(audio)).toBe(true);
	});

	it('treats missing counts as holding something', () => {
		expect(playlistNeedsItemCheck({Type: 'Playlist', MediaType: 'Audio'})).toBe(true);
	});
});

describe('playlistCategoryFromItems', () => {
	it('settles on the one kind the items share', () => {
		expect(playlistCategoryFromItems([{Type: 'Audio'}, {Type: 'Audio'}])).toBe('Audio');
		expect(playlistCategoryFromItems([{Type: 'AudioBook'}, {Type: 'AudioBook'}])).toBe('AudioBook');
	});

	it('calls a blend of kinds Mixed', () => {
		expect(playlistCategoryFromItems([{Type: 'Audio'}, {Type: 'Movie'}])).toBe('Mixed');
		expect(playlistCategoryFromItems([])).toBe('Mixed');
	});
});

describe('groupPlaylists', () => {
	it('orders the sections and lets resolved categories override the summary', () => {
		const playlists = [
			{Id: 'a', Type: 'Playlist', MediaType: 'Audio', ChildCount: 2},
			{Id: 'b', Type: 'Playlist', MediaType: 'Video', ChildCount: 2},
			{Id: 'c', Type: 'Playlist', MediaType: 'Audio', ChildCount: 2}
		];
		const groups = groupPlaylists(playlists, {c: 'AudioBook'});
		expect(groups.map((g) => g.name)).toEqual(['Video Playlists', 'Audio Playlists', 'Audiobook Playlists']);
		expect(groups[1].items.map((i) => i.Id)).toEqual(['a']);
		expect(groups[2].items.map((i) => i.Id)).toEqual(['c']);
	});
});
