// How the home row editor decides what a viewer is allowed to see and reorder. The plugin
// sections for collections and genres are discovered from the server rather than declared,
// so they have to be merged into whatever order the viewer already arranged.

import $L from '@enact/i18n/$L';

const FAVORITES_ROW_IDS = [
	'favoriteMovies',
	'favoriteSeries',
	'favoriteEpisodes',
	'favoritePeople',
	'favoriteArtists',
	'favoriteMusicVideos',
	'favoriteAlbums',
	'favoriteSongs'
];

export const COLLECTIONS_SECTION_SOURCE = 'collections';
export const GENRES_SECTION_SOURCE = 'genres';

export const INITIAL_PLUGIN_SECTION_RENDER_COUNT = 60;
export const PLUGIN_SECTION_RENDER_STEP = 60;

// A row the viewer has switched off elsewhere still sits in the stored order, so the editor
// hides it rather than offering a reorder that would not show up anywhere.
export const isHomeRowVisibleByGates = (rowId, currentSettings) => {
	if (FAVORITES_ROW_IDS.includes(rowId)) return currentSettings.displayFavoritesRows;
	if (rowId === 'collections') return currentSettings.displayCollectionsRows;
	if (rowId === 'genres') return currentSettings.displayGenresRows;
	if (rowId === 'playlists') return currentSettings.displayPlaylistsRows;
	if (rowId === 'imdb-top250-movies') return currentSettings.imdbTop250MoviesEnabled;
	if (rowId === 'imdb-top250-tv') return currentSettings.imdbTop250TvShowsEnabled;
	if (rowId === 'imdb-popular-movies') return currentSettings.imdbMostPopularMoviesEnabled;
	if (rowId === 'imdb-popular-tv') return currentSettings.imdbMostPopularTvShowsEnabled;
	if (rowId === 'imdb-lowest-rated') return currentSettings.imdbLowestRatedMoviesEnabled;
	if (rowId === 'imdb-top-english') return currentSettings.imdbTopEnglishMoviesEnabled;
	if (rowId.startsWith('seerr_') || rowId.startsWith('tmdb_') || rowId === 'radarr_calendar' || rowId === 'sonarr_calendar') {
		return currentSettings.useMoonfinPlugin;
	}
	return true;
};

export const getSortOrderFromSortBy = (sortBy) => {
	if (sortBy === 'SortName') return 'Ascending';
	if (sortBy === 'Random') return 'Ascending';
	return 'Descending';
};

export const getGenresIncludeTypes = (filter) => {
	if (filter === 'Movie') return 'Movie';
	if (filter === 'Series') return 'Series';
	return 'Movie,Series';
};

export const mergeDiscoveredPluginSections = (existingSections, discoveredSections, source, toPluginSection) => {
	const existing = Array.isArray(existingSections) ? existingSections : [];
	const discovered = Array.isArray(discoveredSections) ? discoveredSections : [];

	if (discovered.length === 0) {
		return [...existing].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
	}

	const existingMap = new Map(existing.map((section) => [section.id, section]));
	let nextOrder = existing.length;

	const mergedSourceSections = discovered.map((section) => {
		const existingSection = existingMap.get(section.id);
		const fallbackOrder = existingSection?.order ?? nextOrder++;
		return toPluginSection(section, existingSection, fallbackOrder);
	});

	return [...existing.filter((section) => section.source !== source), ...mergedSourceSections]
		.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
		.map((section, index) => ({...section, order: index}));
};

const normalizeSectionToken = (value, fallback) => {
	if (value === undefined || value === null) return fallback;
	const normalized = String(value)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return normalized || fallback;
};

export const buildCollectionPluginSections = (collections, sortBy, sortOrder) => {
	const items = Array.isArray(collections) ? collections : [];
	return items.map((collection, index) => {
		const collectionId = collection?.Id || `collection-${index + 1}`;
		const displayText = collection?.Name || $L('Collection {index}').replace('{index}', String(index + 1));
		return {
			id: `collection:${normalizeSectionToken(collectionId, `collection-${index + 1}`)}`,
			displayText,
			order: index,
			source: COLLECTIONS_SECTION_SOURCE,
			specJson: JSON.stringify({
				kind: 'collection',
				collectionId: String(collectionId),
				collectionName: String(displayText),
				sortBy,
				sortOrder,
				limit: 40
			})
		};
	});
};

export const buildGenrePluginSections = (genres, includeItemTypes, sortBy, sortOrder) => {
	let items = Array.isArray(genres) ? genres : [];
	if (sortBy === 'SortName' || sortBy === 'Name') {
		items = [...items].sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
	} else if (sortBy === 'Random') {
		items = [...items].sort(() => Math.random() - 0.5);
	}
	return items.map((genre, index) => {
		const genreId = genre?.Id || genre?.Name || `genre-${index + 1}`;
		const genreName = genre?.Name || $L('Genre {index}').replace('{index}', String(index + 1));
		return {
			id: `genre:${normalizeSectionToken(genreId, normalizeSectionToken(genreName, `genre-${index + 1}`))}`,
			displayText: genreName,
			order: index,
			source: GENRES_SECTION_SOURCE,
			specJson: JSON.stringify({
				kind: 'genre',
				genreId: String(genreId),
				genreName: String(genreName),
				includeItemTypes,
				sortBy,
				sortOrder,
				limit: 40
			})
		};
	});
};

export const builtInSectionToPluginSection = (section, existingSection = null, fallbackOrder = 0) => ({
	id: section.id,
	name: section.displayText,
	enabled: existingSection?.enabled ?? false,
	order: existingSection?.order ?? fallbackOrder,
	source: section.source,
	specJson: section.specJson
});

export const getPluginSectionSourceLabel = (source) => {
	if (source === COLLECTIONS_SECTION_SOURCE) return $L('Collections');
	if (source === GENRES_SECTION_SOURCE) return $L('Genres');
	return $L('Home Screen Sections');
};
