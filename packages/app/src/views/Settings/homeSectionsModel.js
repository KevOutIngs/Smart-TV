// How the home row editor decides what a viewer is allowed to see and reorder. The plugin
// sections for collections and genres are discovered from the server rather than declared,
// so they have to be merged into whatever order the viewer already arranged.

import $L from '@enact/i18n/$L';

import {isPluginSourcedRow, isRowEnabledBySetting} from '../../utils/homeRowGates';

export const COLLECTIONS_SECTION_SOURCE = 'collections';
export const GENRES_SECTION_SOURCE = 'genres';

export const INITIAL_PLUGIN_SECTION_RENDER_COUNT = 60;
export const PLUGIN_SECTION_RENDER_STEP = 60;

export const isHomeRowVisibleByGates = (rowId, settings) => {
	if (isPluginSourcedRow(rowId)) return settings.useMoonfinPlugin;
	return isRowEnabledBySetting(rowId, settings);
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
