// $L reaches for ilib, which a plain unit test has no way to load. Every key is its own
// English source string, so handing the string straight back is faithful enough here.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

// The real seerrApi reaches for platform storage on import. Only the row wiring is
// under test here, so the request layer is stubbed out.
jest.mock('../services/seerrApi', () => ({
	__esModule: true,
	default: {
		getWatchlist: jest.fn(),
		getImageUrl: (path, size) => `https://image.tmdb.org/t/p/${size}${path}`
	}
}));

import seerrApi from '../services/seerrApi';
import {normalizeWatchlistBody} from '../services/seerrApi.watchlistShape';
import {SEERR_SECTION_TO_CONFIG, fetchSeerrHomeRow, getSeerrHomeRowConfigs} from './seerrHomeRows';

// Jellyseerr's /discover/watchlist is the one discover endpoint that doesn't return
// TMDB shaped results. It uses tmdbId where the others use id, and media where they use
// mediaInfo. normalizeMediaItem reads item.id, so skipping the remap turns every card
// into "seerr-movie-undefined", which means duplicate React keys and a detail screen
// that can't resolve the title.

describe('watchlist response mapping', () => {
	it('promotes tmdbId to id and media to mediaInfo', () => {
		const {results} = normalizeWatchlistBody({
			page: 1,
			results: [
				{ratingKey: '1', tmdbId: 603, mediaType: 'movie', title: 'The Matrix', media: {status: 5}},
				{ratingKey: '2', tmdbId: 1396, mediaType: 'tv', title: 'Breaking Bad'}
			]
		});

		expect(results.map((r) => r.id)).toEqual([603, 1396]);
		expect(results[0].mediaInfo).toEqual({status: 5});
	});

	it('leaves an already TMDB shaped id alone and tolerates an empty body', () => {
		expect(normalizeWatchlistBody({results: [{id: 42, tmdbId: 99}]}).results[0].id).toBe(42);
		expect(normalizeWatchlistBody(undefined).results).toEqual([]);
		expect(normalizeWatchlistBody({}).results).toEqual([]);
	});
});

describe('seerr watchlist home row', () => {
	beforeEach(() => {
		seerrApi.getWatchlist.mockReset();
	});

	it('is wired into the home layout under the plugin section name', () => {
		expect(SEERR_SECTION_TO_CONFIG.seerr_watchlist).toBe('yourWatchlist');
		expect(getSeerrHomeRowConfigs().some((cfg) => cfg.id === 'yourWatchlist')).toBe(true);
	});

	it('gives every entry a distinct id and keeps the tmdb id for navigation', async () => {
		// Fed through the real mapping, exactly as getWatchlist would.
		seerrApi.getWatchlist.mockResolvedValue(normalizeWatchlistBody({
			results: [
				{tmdbId: 603, mediaType: 'movie', title: 'The Matrix', posterPath: '/a.jpg'},
				{tmdbId: 1396, mediaType: 'tv', name: 'Breaking Bad', posterPath: '/b.jpg'}
			]
		}));

		const items = await fetchSeerrHomeRow('yourWatchlist');

		expect(items.map((i) => i.Id)).toEqual(['seerr-movie-603', 'seerr-tv-1396']);
		expect(new Set(items.map((i) => i.Id)).size).toBe(items.length);
		expect(items.map((i) => i._seerrRaw.mediaId)).toEqual([603, 1396]);
		expect(items.map((i) => i.Name)).toEqual(['The Matrix', 'Breaking Bad']);
		expect(items.map((i) => i.Type)).toEqual(['Movie', 'Series']);
	});

	it('never lets a failed request break the home screen', async () => {
		seerrApi.getWatchlist.mockRejectedValue(new Error('502'));
		await expect(fetchSeerrHomeRow('yourWatchlist')).resolves.toEqual([]);
	});
});
