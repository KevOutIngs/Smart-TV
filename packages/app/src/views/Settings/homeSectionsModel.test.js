// $L reaches for ilib, which a plain unit test has no way to load. Every key is its own
// English source string, so handing the string straight back is faithful enough here.
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {isHomeRowVisibleByGates} from './homeSectionsModel';

const settings = (over = {}) => ({
	displayFavoritesRows: true,
	displayCollectionsRows: true,
	displayGenresRows: true,
	displayPlaylistsRows: true,
	imdbTop250MoviesEnabled: true,
	imdbTop250TvShowsEnabled: true,
	imdbMostPopularMoviesEnabled: true,
	imdbMostPopularTvShowsEnabled: true,
	imdbLowestRatedMoviesEnabled: true,
	imdbTopEnglishMoviesEnabled: true,
	useMoonfinPlugin: true,
	...over
});

describe('isHomeRowVisibleByGates', () => {
	test('applies the settings that gate a whole group of rows', () => {
		expect(isHomeRowVisibleByGates('collections', settings({displayCollectionsRows: false}))).toBe(false);
		expect(isHomeRowVisibleByGates('favoriteMovies', settings({displayFavoritesRows: false}))).toBe(false);
		expect(isHomeRowVisibleByGates('imdb-top250-movies', settings({imdbTop250MoviesEnabled: false}))).toBe(false);
	});

	test('hides the plugin rows when the plugin is off', () => {
		const off = settings({useMoonfinPlugin: false});

		expect(isHomeRowVisibleByGates('seerr_trending', off)).toBe(false);
		expect(isHomeRowVisibleByGates('tmdb_popular', off)).toBe(false);
		expect(isHomeRowVisibleByGates('radarr_calendar', off)).toBe(false);
		expect(isHomeRowVisibleByGates('sonarr_calendar', off)).toBe(false);
	});

	test('shows the plugin rows when it is on', () => {
		expect(isHomeRowVisibleByGates('seerr_trending', settings())).toBe(true);
		expect(isHomeRowVisibleByGates('radarr_calendar', settings())).toBe(true);
	});

	test('leaves anything with no gate of its own alone', () => {
		expect(isHomeRowVisibleByGates('resume', settings())).toBe(true);
		expect(isHomeRowVisibleByGates('nextup', settings({useMoonfinPlugin: false}))).toBe(true);
	});
});
