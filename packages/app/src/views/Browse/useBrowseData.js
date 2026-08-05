import {useCallback, useEffect, useMemo, useReducer, useRef} from 'react';
import $L from '@enact/i18n/$L';

import {getLogoUrl} from '../../utils/helpers';
import {HOME_ROW_ITEM_FIELDS} from '../../services/jellyfinApi';
import {loadSinceYouWatchedRows, loadRewatchItems} from '../../services/homeRecommendations';
import * as connectionPool from '../../services/connectionPool';
import * as seerrApi from '../../services/seerrApi';
import {getGenresIncludeTypes, getSortOrderFromSortBy} from '../../utils/homeRowSorting';
import browseReducer, {browseInitialState, mergeRowsById} from './browseReducer';
import {
	EXCLUDED_COLLECTION_TYPES, FAVORITE_ROW_CONFIGS,
	filterItemsByExcludedGenres, getItemGenreNames, parsePluginSpec, stableIndex
} from './browseFilters';
import {
	CACHE_TTL_LIBRARIES, CACHE_TTL_VOLATILE, VOLATILE_REFRESH_COOLDOWN_MS,
	cancelPendingCacheSave, clearMemoryCache, isCacheValid, loadBrowseCache, memoryCache, saveBrowseCache
} from './browseCache';

// Everything the home screen shows and how it gets there. Rows come from three places, the
// in memory cache, the stored cache and the server, and each one dispatches as it arrives so
// the screen fills in rather than waiting for the slowest.
const useBrowseData = ({
	api,
	serverUrl,
	accessToken,
	userId,
	settings,
	unifiedMode,
	seerrEnabled,
	seerrAuthenticated,
	getItemServerUrl,
	homeRowsConfig
}) => {
	const [state, dispatch] = useReducer(browseReducer, browseInitialState);

	const cacheOwner = useMemo(() => ({serverUrl, userId}), [serverUrl, userId]);

	const lastVolatileRefreshRef = useRef(0);

	const settingsRef = useRef(settings);
	settingsRef.current = settings;

	const fetchFreshFeaturedItems = useCallback(async (fallbackItems = null) => {
		const s = settingsRef.current;
		const sourceType = s.mediaBarSourceType || 'library';
		const libraryIds = s.mediaBarLibraryIds || [];
		const collectionIds = s.mediaBarCollectionIds || [];
		const hasSourceFilter = (sourceType === 'collection' && collectionIds.length > 0) || libraryIds.length > 0;

		try {
			let items = [];

			if (s.useMoonfinPlugin) {
				const mediaBarResult = await seerrApi.getMoonfinMediaBar(serverUrl, accessToken, 'tv');
				if (mediaBarResult?.Items?.length) {
					items = mediaBarResult.Items;
				}
			}

			if (items.length === 0) {
				if (sourceType === 'collection' && collectionIds.length > 0) {
					const results = await Promise.all(
						collectionIds.map(cid => api.getCollectionItems(cid, 50).catch(() => null))
					);
					const allItems = [];
					results.forEach(r => { if (r?.Items) allItems.push(...r.Items); });
					items = allItems
						.filter(item => item.Type !== 'BoxSet' && item.BackdropImageTags?.length)
						.sort(() => Math.random() - 0.5)
						.slice(0, s.featuredItemCount);
				} else if (unifiedMode) {
					items = await connectionPool.getRandomItemsFromAllServers(s.featuredContentType, s.featuredItemCount, libraryIds);
				} else if (libraryIds.length > 0) {
					const perLib = Math.ceil((s.featuredItemCount * 2) / libraryIds.length);
					const results = await Promise.all(
						libraryIds.map(lid => api.getRandomItems(s.featuredContentType, perLib, lid).catch(() => null))
					);
					const allItems = [];
					results.forEach(r => { if (r?.Items) allItems.push(...r.Items); });
					items = allItems.sort(() => Math.random() - 0.5).slice(0, s.featuredItemCount);
				} else {
					const randomItems = await api.getRandomItems(s.featuredContentType, s.featuredItemCount);
					items = randomItems?.Items || [];
				}
			}

			if (items.length > 0) {
				const filteredItems = filterItemsByExcludedGenres(
					items.filter(item => item.Type !== 'BoxSet'),
					s.excludedGenres
				);
				const featuredWithLogos = filteredItems.map(item => ({
					...item,
					LogoUrl: getLogoUrl(getItemServerUrl(item), item, {maxWidth: 800, quality: 90})
				}));
				dispatch({type: 'SET_FEATURED_ITEMS', items: featuredWithLogos});
				memoryCache.featuredItems = featuredWithLogos;
				return featuredWithLogos;
			} else if (fallbackItems && !hasSourceFilter) {
				dispatch({type: 'SET_FEATURED_ITEMS', items: fallbackItems});
				memoryCache.featuredItems = fallbackItems;
				return fallbackItems;
			}
		} catch (e) {
			console.warn('[Browse] Failed to fetch fresh featured items:', e);
			if (fallbackItems && !hasSourceFilter) {
				dispatch({type: 'SET_FEATURED_ITEMS', items: fallbackItems});
				memoryCache.featuredItems = fallbackItems;
				return fallbackItems;
			}
		}
		return null;
	}, [api, serverUrl, accessToken, unifiedMode, getItemServerUrl]);

	const refreshVolatileData = useCallback(async (force = false) => {
		if (!force && Date.now() - lastVolatileRefreshRef.current < VOLATILE_REFRESH_COOLDOWN_MS) return;
		lastVolatileRefreshRef.current = Date.now();
		try {
			let resumeItems, nextUp;

			if (unifiedMode) {
				[resumeItems, nextUp] = await Promise.all([
					connectionPool.getResumeItemsFromAllServers(),
					connectionPool.getNextUpFromAllServers(settings.nextUpMaxDays)
				]);
				resumeItems = {Items: resumeItems};
				nextUp = {Items: nextUp};
			} else {
				[resumeItems, nextUp] = await Promise.all([
					api.getResumeItems(),
					api.getNextUp(24, null, settings.nextUpMaxDays)
				]);
			}

			const volatileRows = [];

			if (resumeItems.Items?.length > 0) {
				volatileRows.push({
					id: 'resume',
					title: $L('Continue Watching'),
					items: resumeItems.Items,
					type: 'landscape'
				});
			}

			if (nextUp.Items?.length > 0) {
				volatileRows.push({
					id: 'nextup',
					title: $L('Next Up'),
					items: nextUp.Items,
					type: 'landscape'
				});
			}

			dispatch({type: 'REFRESH_VOLATILE', volatileRows});
			if (memoryCache.rowData) {
				const filtered = memoryCache.rowData.filter(r => r.id !== 'resume' && r.id !== 'nextup');
				memoryCache.rowData = [...volatileRows, ...filtered];
				memoryCache.timestamp = Date.now();
				if (!unifiedMode) {
					saveBrowseCache(memoryCache.rowData, memoryCache.libraries, memoryCache.featuredItems, cacheOwner);
				}
			}
		} catch (e) {
			console.warn('[Browse] Background refresh failed:', e);
		}
	}, [api, unifiedMode, cacheOwner, settings.nextUpMaxDays]);

	useEffect(() => {
		clearMemoryCache();
	}, [accessToken]);

	useEffect(() => {
		const handleBrowseRefresh = () => {
			clearMemoryCache();
		};

		window.addEventListener('moonfin:browseRefresh', handleBrowseRefresh);
		return () => {
			window.removeEventListener('moonfin:browseRefresh', handleBrowseRefresh);
		};
	}, []);

	useEffect(() => cancelPendingCacheSave, []);

	useEffect(() => {
		let cancelled = false;
		const loadData = async () => {
			// Recommendation rows are only built by fetchAllData, so treat an enabled one
			// as dynamic config. Otherwise enabling it shows nothing until the cache expires.
			const hasEnabledRecommendationRow = homeRowsConfig.some(
				(row) => row.enabled && (row.id.startsWith('sinceyouwatched') || row.id === 'rewatch')
			);
			const hasEnabledMediaSectionRow = homeRowsConfig.some(
				(row) => row.enabled && ['audioartists', 'audioalbums', 'audioplaylists', 'resumeaudio', 'activerecordings'].includes(row.id)
			);
			const hasDynamicRowConfig =
				settings.displayFavoritesRows ||
				settings.displayCollectionsRows ||
				settings.displayGenresRows ||
				settings.displayPlaylistsRows ||
				hasEnabledRecommendationRow ||
				hasEnabledMediaSectionRow ||
				(settings.pluginSections || []).some((section) => section?.enabled);

			if (hasDynamicRowConfig || unifiedMode) {
				dispatch({type: 'SET_LOADING', value: true});
				await fetchAllData(); // eslint-disable-line no-use-before-define
				return;
			}

			if (memoryCache.rowData && memoryCache.libraries && memoryCache.featuredItems && isCacheValid(memoryCache.timestamp, CACHE_TTL_VOLATILE)) {
				dispatch({type: 'SET_ROW_DATA', rowData: memoryCache.rowData});
				await fetchFreshFeaturedItems(memoryCache.featuredItems);
				dispatch({type: 'SET_LOADING', value: false});
				return;
			}

			const persistedCache = await loadBrowseCache(cacheOwner.serverUrl, cacheOwner.userId);
			const hasValidPersistedCache = persistedCache &&
				isCacheValid(persistedCache.timestamp, CACHE_TTL_LIBRARIES) &&
				Array.isArray(persistedCache.libraries) &&
				persistedCache.libraries.length > 0;

			if (hasValidPersistedCache) {
				dispatch({type: 'SET_ROW_DATA', rowData: persistedCache.rowData});
				await fetchFreshFeaturedItems(persistedCache.featuredItems);
				memoryCache.libraries = persistedCache.libraries;
				memoryCache.rowData = persistedCache.rowData;
				memoryCache.timestamp = persistedCache.timestamp;
				dispatch({type: 'SET_LOADING', value: false});

				if (!isCacheValid(persistedCache.timestamp, CACHE_TTL_VOLATILE)) {
					refreshVolatileData(true);
				}
				return;
			}

			dispatch({type: 'SET_LOADING', value: true});
			await fetchAllData(); // eslint-disable-line no-use-before-define
		};

		const fetchAllData = async () => {
			try {
				let libs, resumeItems, nextUp, userConfig, recentlyPlayed;

				if (unifiedMode) {
					const [libsArray, resumeArray, nextUpArray] = await Promise.all([
						connectionPool.getLibrariesFromAllServers(),
						connectionPool.getResumeItemsFromAllServers(),
						connectionPool.getNextUpFromAllServers(settings.nextUpMaxDays)
					]);
					libs = libsArray;
					resumeItems = {Items: resumeArray};
					nextUp = {Items: nextUpArray};
					userConfig = null; // Not supported in unified mode
					recentlyPlayed = null;
					// IMDb custom rows are single-server only, so imdbResults stays empty in unified mode.
				} else {
					const results = await Promise.all([
						api.getLibraries().catch(() => ({Items: []})),
						api.getResumeItems().catch(() => ({Items: []})),
						api.getNextUp(24, null, settings.nextUpMaxDays).catch(() => ({Items: []})),
						api.getUserConfiguration().catch(() => null),
						settings.mergeContinueWatchingNextUp ? api.getItems({
							IncludeItemTypes: 'Episode',
							Filters: 'IsPlayed',
							Recursive: true,
							SortBy: 'DatePlayed',
							SortOrder: 'Descending',
							Limit: 100,
							Fields: 'UserData,SeriesId'
						}).catch(() => null) : Promise.resolve(null)
					]);
					libs = results[0].Items || [];
					resumeItems = results[1];
					nextUp = results[2];
					userConfig = results[3];
					recentlyPlayed = results[4];
				}

				memoryCache.libraries = libs;

				const latestItemsExcludes = userConfig?.Configuration?.LatestItemsExcludes || [];

				const rowData = [];

				if (resumeItems.Items?.length > 0) {
					rowData.push({
						id: 'resume',
						title: $L('Continue Watching'),
						items: resumeItems.Items,
						type: 'landscape'
					});
				}

				if (nextUp.Items?.length > 0) {
					rowData.push({
						id: 'nextup',
						title: $L('Next Up'),
						items: nextUp.Items,
						type: 'landscape'
					});
				}

				if (libs.length > 0) {
					const visibleLibs = libs.filter(lib => !EXCLUDED_COLLECTION_TYPES.includes(lib.CollectionType?.toLowerCase()));
					if (visibleLibs.length > 0) {
						const libraryItems = visibleLibs.map(lib => ({
							...lib,
							Type: 'CollectionFolder',
							isLibraryTile: true
						}));
						rowData.push({
							id: 'library-tiles',
							title: $L('My Media'),
							items: libraryItems,
							type: 'landscape',
							isLibraryRow: true
						});
						// The same libraries drawn as icon buttons instead of artwork tiles.
						// Like every other row here it is built either way and dropped
						// later if the user has not enabled it.
						rowData.push({
							id: 'librarybuttons',
							title: $L('Library Buttons'),
							items: libraryItems,
							type: 'square',
							isLibraryRow: true,
							isButtonRow: true
						});
					}

					const liveTvLibrary = libs.find(lib => lib.CollectionType?.toLowerCase() === 'livetv');
					if (liveTvLibrary) {
						rowData.push({
							id: 'livetv',
							title: $L('Live TV'),
							items: [
								{...liveTvLibrary, Name: $L('Guide'), Type: 'CollectionFolder', isLibraryTile: true},
								{Id: 'livetv-recordings', Name: $L('Recordings'), Type: 'CollectionFolder', isRecordingsShortcut: true}
							],
							type: 'landscape',
							isLiveTvRow: true
						});
					}
				}

				if (recentlyPlayed?.Items?.length > 0) {
					rowData.push({
						id: 'recentlyplayed',
						items: recentlyPlayed.Items
					});
				}

				dispatch({type: 'SET_ROW_DATA', rowData});
				memoryCache.rowData = [...rowData];
				// The Mediabar is populated only by the settings-aware loader so it can
				// never show a library outside the selected sources. When it is enabled,
				// wait for it before clearing loading so the initial focus lands on the
				// media bar rather than the first row, matching the cache path.
				if (settingsRef.current.featuredBarStyle !== 'off') {
					await fetchFreshFeaturedItems();
				} else {
					fetchFreshFeaturedItems();
				}
				dispatch({type: 'SET_LOADING', value: false});

				const eligibleLibraries = libs.filter(lib => {
					if (EXCLUDED_COLLECTION_TYPES.includes(lib.CollectionType?.toLowerCase())) {
						return false;
					}
					if (latestItemsExcludes.includes(lib.Id)) {
						return false;
					}
					return true;
				});

				if (unifiedMode) {
					const latestResults = await connectionPool.getLatestPerLibraryFromAllServers(
						latestItemsExcludes,
						EXCLUDED_COLLECTION_TYPES
					);
					const newRows = [];
					for (const result of latestResults) {
						if (result && result.latest?.length > 0) {
							const libraryTitle = result.lib._serverName
								? `${result.lib.Name} (${result.lib._serverName})`
								: result.lib.Name;
							const rowId = `latest-${result.lib.Id}${result.lib._serverName ? '-' + result.lib._serverName : ''}`;

							newRows.push({
								id: rowId,
								title: $L('Recently Added in {libraryTitle}').replace('{libraryTitle}', libraryTitle),
								items: result.latest,
								library: result.lib,
								type: result.lib.CollectionType?.toLowerCase() === 'music' ? 'square' : 'portrait',
								isLatestRow: true
							});
						}
					}
					dispatch({type: 'APPEND_ROWS', rows: newRows});
					memoryCache.rowData = [...rowData, ...newRows];
					memoryCache.timestamp = Date.now();
					dispatch({type: 'SET_LOADING', value: false});
					return;
				}

				const favoriteSortBy = settings.favoritesRowSortBy || 'SortName';
				const favoriteSortOrder = getSortOrderFromSortBy(favoriteSortBy);
				const collectionsSortBy = settings.collectionsRowSortBy || 'SortName';
				const collectionsSortOrder = getSortOrderFromSortBy(collectionsSortBy);
				const genresSortBy = settings.genresRowSortBy || 'SortName';
				const genresSortOrder = getSortOrderFromSortBy(genresSortBy);
				const genresIncludeTypes = getGenresIncludeTypes(settings.genresRowItemFilter);
				const playlistsSortBy = settings.playlistsRowSortBy || 'SortName';
				const playlistsSortOrder = getSortOrderFromSortBy(playlistsSortBy);
				const audioRowsSortBy = settings.audioRowsSortBy || 'SortName';
				const audioRowsSortOrder = getSortOrderFromSortBy(audioRowsSortBy);
				const audioArtistsEnabled = homeRowsConfig.some((row) => row.enabled && row.id === 'audioartists');
				const audioAlbumsEnabled = homeRowsConfig.some((row) => row.enabled && row.id === 'audioalbums');
				const audioPlaylistsEnabled = homeRowsConfig.some((row) => row.enabled && row.id === 'audioplaylists');
				const resumeAudioEnabled = homeRowsConfig.some((row) => row.enabled && row.id === 'resumeaudio');
				const recordingsEnabled = homeRowsConfig.some((row) => row.enabled && row.id === 'activerecordings');
				const enabledPluginSections = (settings.pluginSections || []).filter((section) => section.enabled);
				const sinceYouWatchedIndexes = homeRowsConfig
					.filter((row) => row.enabled && row.id.startsWith('sinceyouwatched'))
					.map((row) => parseInt(row.id.replace('sinceyouwatched', ''), 10))
					.filter((idx) => idx >= 1)
					.sort((a, b) => a - b);
				const rewatchEnabled = homeRowsConfig.some((row) => row.enabled && row.id === 'rewatch');

				const appendRows = (rows) => {
					if (cancelled || rows.length === 0) return;
					dispatch({type: 'APPEND_ROWS', rows});
					memoryCache.rowData = mergeRowsById(memoryCache.rowData || [], rows);
					memoryCache.timestamp = Date.now();
					// Unified mode spans several servers, so its rows never go to the disk cache.
					if (!unifiedMode) {
						saveBrowseCache(memoryCache.rowData, libs, memoryCache.featuredItems, cacheOwner);
					}
				};

				const loadLatestAndRecentlyReleased = async () => {
					try {
						const [latestResults, recentlyReleasedResults] = await Promise.all([
							Promise.all(
								eligibleLibraries.map(lib =>
									api.getLatest(lib.Id, 16)
										.then(latest => ({lib, latest}))
										.catch(() => null)
								)
							),
							Promise.all(
								eligibleLibraries.map(lib =>
									api.getRecentlyReleased(lib.Id, 16)
										.then(latest => ({lib, latest}))
										.catch(() => null)
								)
							)
						]);

						const rows = [];
						for (const result of latestResults) {
							if (result && result.latest?.length > 0) {
								const libraryTitle = result.lib.Name;
								const rowId = `latest-${result.lib.Id}`;
								rows.push({
									id: rowId,
									title: $L('Recently Added in {libraryTitle}').replace('{libraryTitle}', libraryTitle),
									items: result.latest,
									library: result.lib,
									type: result.lib.CollectionType?.toLowerCase() === 'music' ? 'square' : 'portrait',
									isLatestRow: true
								});
							}
						}
						for (const result of recentlyReleasedResults) {
							if (result && result.latest?.Items?.length > 0) {
								const libraryTitle = result.lib.Name;
								const rowId = `recently-released-${result.lib.Id}`;
								rows.push({
									id: rowId,
									title: $L('Recently Released in {libraryTitle}').replace('{libraryTitle}', libraryTitle),
									items: result.latest.Items,
									library: result.lib,
									type: result.lib.CollectionType?.toLowerCase() === 'music' ? 'square' : 'portrait',
									isRecentlyReleasedRow: true
								});
							}
						}
						appendRows(rows);
					} catch (e) {
						console.warn('[Browse] Failed to load latest items:', e);
					}
				};

				const loadCollections = async () => {
					if (!settings.displayCollectionsRows) return;
					try {
						const collectionsResult = await api.getCollections(20, collectionsSortBy, collectionsSortOrder).catch(() => null);
						if (collectionsResult?.Items?.length > 0) {
							appendRows([{
								id: 'collections',
								title: $L('Collections'),
								items: collectionsResult.Items,
								type: 'portrait'
							}]);
						}
					} catch (e) {
						console.warn('[Browse] Failed to load collections:', e);
					}
				};

				const loadFavorites = async () => {
					if (!settings.displayFavoritesRows) return;
					try {
						const favoriteResults = await Promise.all(
							FAVORITE_ROW_CONFIGS.map((rowConfig) =>
								api.getItems({
									IncludeItemTypes: rowConfig.includeItemTypes,
									Filters: 'IsFavorite',
									SortBy: favoriteSortBy,
									SortOrder: favoriteSortOrder,
									Recursive: true,
									Limit: 20,
									Fields: HOME_ROW_ITEM_FIELDS
								})
								.then((result) => ({rowConfig, result}))
								.catch(() => null)
							)
						);
						const rows = [];
						favoriteResults.filter(Boolean).forEach((favoriteResult) => {
							const items = favoriteResult?.result?.Items || [];
							if (items.length === 0) return;
							rows.push({
								id: favoriteResult.rowConfig.id,
								title: $L(favoriteResult.rowConfig.title),
								items,
								type: favoriteResult.rowConfig.type
							});
						});
						appendRows(rows);
					} catch (e) {
						console.warn('[Browse] Failed to load favorites:', e);
					}
				};

				const loadGenres = async () => {
					if (!settings.displayGenresRows) return;
					try {
						const genresResult = await api.getGenres(undefined, genresIncludeTypes, genresSortBy, genresSortOrder).catch(() => null);
						if (genresResult?.Items?.length > 0) {
							let enrichedItems = genresResult.Items;
							const genresSortByLower = (settings.genresRowSortBy || 'SortName').toLowerCase();
							if (genresSortByLower === 'sortname' || genresSortByLower === 'name') {
								enrichedItems = [...enrichedItems].sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
							} else if (genresSortByLower === 'random') {
								enrichedItems = [...enrichedItems].sort(() => Math.random() - 0.5);
							}

							try {
								const genreNames = enrichedItems.map((genre) => genre.Name).filter(Boolean);
								// One query, filtered to the genres we actually have. Sorting at
								// random turns into ORDER BY RANDOM() on the server, a full scan of
								// the item table that no index can help, which is far too expensive
								// to run on every home load. Any stable sort avoids it.
								const repResult = await api.getItems({
									IncludeItemTypes: genresIncludeTypes,
									Recursive: true,
									Fields: 'PrimaryImageAspectRatio,Genres,ImageTags,BackdropImageTags',
									Genres: genreNames.join('|'),
									Limit: Math.min(Math.max(genreNames.length * 8, 50), 300),
									SortBy: 'SortName'
								});
								const repItems = repResult?.Items || [];

								enrichedItems = enrichedItems.map(genre => {
									const genreLower = genre.Name.toLowerCase();
									const matchingItems = repItems.filter(item =>
										getItemGenreNames(item).includes(genreLower)
									);
									const matchingWithBackdrop = matchingItems.filter(item =>
										item.BackdropImageTags?.length > 0 || item.ImageTags?.Thumb
									);
									const pool = matchingWithBackdrop.length > 0 ? matchingWithBackdrop : matchingItems;
									const rep = pool.length > 0 ? pool[stableIndex(genre.Name, pool.length)] : null;

									if (rep) {
										return {
											...genre,
											Type: 'Genre',
											_representative: rep
										};
									}
									return {
										...genre,
										Type: 'Genre'
									};
								});

								// Fallback resolution for any genres that missed the bulk query
								const missingGenres = enrichedItems.filter(g => !g._representative);
								if (missingGenres.length > 0) {
									const fallbackResults = await Promise.all(
										missingGenres.map(async (genre) => {
											try {
												const res = await api.getItems({
													IncludeItemTypes: genresIncludeTypes,
													Recursive: true,
													Fields: 'PrimaryImageAspectRatio,Genres,ImageTags,BackdropImageTags',
													Genres: genre.Name,
													Limit: 1,
													SortBy: 'SortName'
												});
												return { genreId: genre.Id, rep: res?.Items?.[0] || null };
											} catch (err) {
												return { genreId: genre.Id, rep: null };
											}
										})
									);

									enrichedItems = enrichedItems.map(genre => {
										if (genre._representative) return genre;
										const found = fallbackResults.find(r => r.genreId === genre.Id);
										if (found && found.rep) {
											return {
												...genre,
												Type: 'Genre',
												_representative: found.rep
											};
										}
										return genre;
									});
								}
							} catch (e) {
								console.warn('[Browse] Failed to enrich genres:', e);
							}

							appendRows([{
								id: 'genres',
								title: $L('Genres'),
								items: enrichedItems,
								type: 'portrait',
								isGenreRow: true
							}]);
						}
					} catch (e) {
						console.warn('[Browse] Failed to load genres:', e);
					}
				};

				const loadPlaylistsAndMusic = async () => {
					try {
						const [playlistsResult, audioArtistsResult, audioAlbumsResult, audioPlaylistsResult, resumeAudioResult, recordingsResult] = await Promise.all([
							settings.displayPlaylistsRows ? api.getPlaylists(playlistsSortBy, playlistsSortOrder).catch(() => null) : Promise.resolve(null),
							audioArtistsEnabled ? api.getAlbumArtists({Limit: 20, SortBy: audioRowsSortBy, SortOrder: audioRowsSortOrder, Fields: HOME_ROW_ITEM_FIELDS}).catch(() => null) : Promise.resolve(null),
							audioAlbumsEnabled ? api.getItems({IncludeItemTypes: 'MusicAlbum', Recursive: true, SortBy: audioRowsSortBy, SortOrder: audioRowsSortOrder, Limit: 20, Fields: HOME_ROW_ITEM_FIELDS}).catch(() => null) : Promise.resolve(null),
							audioPlaylistsEnabled ? api.getPlaylists(audioRowsSortBy, audioRowsSortOrder).catch(() => null) : Promise.resolve(null),
							resumeAudioEnabled ? api.getResumeAudioItems(20).catch(() => null) : Promise.resolve(null),
							recordingsEnabled ? api.getLiveTvRecordings().catch(() => null) : Promise.resolve(null)
						]);

						const rows = [];
						if (playlistsResult?.Items?.length > 0) {
							rows.push({
								id: 'playlists',
								title: $L('Playlists'),
								items: playlistsResult.Items,
								type: 'square'
							});
						}
						if (audioArtistsResult?.Items?.length > 0) {
							rows.push({
								id: 'audioartists',
								title: $L('Music Artists'),
								items: audioArtistsResult.Items,
								type: 'square'
							});
						}
						if (audioAlbumsResult?.Items?.length > 0) {
							rows.push({
								id: 'audioalbums',
								title: $L('Music Albums'),
								items: audioAlbumsResult.Items,
								type: 'square'
							});
						}
						if (audioPlaylistsResult?.Items?.length > 0) {
							const audioPlaylists = audioPlaylistsResult.Items.filter(item => item.MediaType === 'Audio');
							if (audioPlaylists.length > 0) {
								rows.push({
									id: 'audioplaylists',
									title: $L('Music Playlists'),
									items: audioPlaylists,
									type: 'square'
								});
							}
						}
						if (resumeAudioResult?.Items?.length > 0) {
							rows.push({
								id: 'resumeaudio',
								title: $L('Continue Listening'),
								items: resumeAudioResult.Items,
								type: 'square'
							});
						}
						if (recordingsResult?.Items?.length > 0) {
							rows.push({
								id: 'activerecordings',
								title: $L('Recordings'),
								items: recordingsResult.Items,
								type: 'landscape'
							});
						}
						appendRows(rows);
					} catch (e) {
						console.warn('[Browse] Failed to load playlists/music:', e);
					}
				};

				const loadPluginsAndRecos = async () => {
					const fetchPluginSectionRow = async (section) => {
						if (!section?.enabled) return null;
						const spec = parsePluginSpec(section.specJson);
						if (!spec || typeof spec !== 'object') return null;
						const limit = Number.isFinite(Number(spec.limit)) ? Number(spec.limit) : 20;
						const title = section.name || section.displayText || $L('Plugin Section');
						const fields = HOME_ROW_ITEM_FIELDS;

						try {
							let items = [];
							switch (spec.kind) {
								case 'recentlyReleasedMovies': {
									const result = await api.getItems({
										IncludeItemTypes: 'Movie',
										SortBy: 'PremiereDate',
										SortOrder: 'Descending',
										Recursive: true,
										Limit: limit,
										Fields: fields
									});
									items = result?.Items || [];
									break;
								}
								case 'recentlyReleasedEpisodes': {
									const result = await api.getItems({
										IncludeItemTypes: 'Episode',
										SortBy: 'PremiereDate',
										SortOrder: 'Descending',
										Recursive: true,
										Limit: limit,
										Fields: fields
									});
									items = result?.Items || [];
									break;
								}
								case 'watchAgain': {
									const result = await api.getItems({
										IncludeItemTypes: 'Movie,Series',
										Filters: 'IsPlayed',
										SortBy: 'DatePlayed',
										SortOrder: 'Descending',
										Recursive: true,
										Limit: limit,
										Fields: fields
									});
									items = result?.Items || [];
									break;
								}
								case 'recentlyAddedInLibrary': {
									const libraryIds = Array.isArray(spec.libraryIds) ? spec.libraryIds : [];
									const responses = await Promise.all(
										libraryIds.map((libraryId) => api.getItems({
											ParentId: libraryId,
											IncludeItemTypes: 'Movie,Series',
											SortBy: 'DateCreated',
											SortOrder: 'Descending',
											Recursive: true,
											Limit: limit,
											Fields: fields
										}).catch(() => null))
									);
									items = responses.flatMap((response) => response?.Items || []).slice(0, limit);
									break;
								}
								case 'custom': {
									const includeItemTypes = Array.isArray(spec.includeItemTypes)
										? spec.includeItemTypes.join(',')
										: 'Movie,Series';
									const sortBy = spec.sortBy || 'Random';
									const sortOrder = spec.sortOrderDirection || 'Ascending';
									const params = {
										IncludeItemTypes: includeItemTypes,
										SortBy: sortBy,
										SortOrder: sortOrder,
										Recursive: true,
										Limit: limit,
										Fields: fields
									};
									if (spec.type === 'genre' && spec.source) params.Genres = spec.source;
									if (spec.type === 'person' && spec.source) params.PersonIds = spec.source;
									if (spec.type === 'studio' && spec.source) params.StudioIds = spec.source;
									if (spec.type === 'collection' && spec.source) params.ParentId = spec.source;
									const result = await api.getItems(params);
									items = result?.Items || [];
									break;
								}
								case 'collection': {
									const collectionId = spec.collectionId || null;
									if (!collectionId) {
										items = [];
										break;
									}
									const result = await api.getCollectionItems(collectionId, limit);
									items = result?.Items || [];
									break;
								}
								case 'genre': {
									const params = {
										IncludeItemTypes: spec.includeItemTypes || 'Movie,Series',
										SortBy: spec.sortBy || 'SortName',
										SortOrder: spec.sortOrder || 'Ascending',
										Recursive: true,
										Limit: limit,
										Fields: fields
									};
									if (spec.genreId) {
										params.GenreIds = spec.genreId;
									} else if (spec.genreName) {
										params.Genres = spec.genreName;
									}
									const result = await api.getItems(params);
									items = result?.Items || [];
									break;
								}
								default:
									items = [];
							}

							if (items.length === 0) return null;
							const cardTypeHint = spec.cardType || spec.section?.CardType || spec.section?.cardType || spec.section?.Layout || spec.section?.layout;
							const normalizedCardType = typeof cardTypeHint === 'string' ? cardTypeHint.toLowerCase() : '';
							const viewModeHint = spec.viewMode || spec.section?.ViewMode || spec.section?.viewMode || '';
							const normalizedViewMode = typeof viewModeHint === 'string' ? viewModeHint.toLowerCase() : '';
							let rowType = 'portrait';
							if (normalizedViewMode.includes('portrait')) {
								rowType = 'portrait';
							} else if (normalizedViewMode.includes('square')) {
								rowType = 'square';
							} else if (
								normalizedViewMode.includes('landscape') ||
								normalizedViewMode.includes('small') ||
								normalizedViewMode.includes('backdrop') ||
								normalizedCardType.includes('landscape') ||
								normalizedCardType.includes('thumb') ||
								spec.kind === 'recentlyReleasedEpisodes'
							) {
								rowType = 'landscape';
							}
							return {
								id: section.id,
								title,
								items,
								type: rowType,
								isPluginRow: true,
								pluginSource: section.source
							};
						} catch (_error) {
							return null;
						}
					};

					try {
						const [pluginRows, sinceYouWatchedRows, rewatchItems] = await Promise.all([
							Promise.all(enabledPluginSections.map((section) => fetchPluginSectionRow(section))),
							sinceYouWatchedIndexes.length
								? loadSinceYouWatchedRows(api, {
									sinceYouWatchedSource: settings.sinceYouWatchedSource,
									sinceYouWatchedSourceItem: settings.sinceYouWatchedSourceItem,
									sinceYouWatchedSourceType: settings.sinceYouWatchedSourceType,
									sinceYouWatchedIncludeWatched: settings.sinceYouWatchedIncludeWatched,
									tmdbApiKey: settings.tmdbApiKey
								}, sinceYouWatchedIndexes, seerrEnabled && seerrAuthenticated).catch(() => [])
								: Promise.resolve([]),
							rewatchEnabled
								? loadRewatchItems(api, {
									rewatchIncludeMovies: settings.rewatchIncludeMovies,
									rewatchIncludeShows: settings.rewatchIncludeShows,
									rewatchIncludeCollections: settings.rewatchIncludeCollections,
									rewatchSortBy: settings.rewatchSortBy
								}).catch(() => null)
								: Promise.resolve(null)
						]);

						const rows = [];
						pluginRows.filter(Boolean).forEach((pluginRow) => rows.push(pluginRow));
						sinceYouWatchedRows.forEach((row) => {
							rows.push({
								id: row.id,
								title: $L('Because you watched {name}').replace('{name}', row.seedName),
								items: row.items,
								type: 'portrait',
								isOnlineRecoRow: row.isSeerr === true
							});
						});
						if (rewatchItems && rewatchItems.length > 0) {
							rows.push({
								id: 'rewatch',
								title: $L('Rewatch'),
								items: rewatchItems,
								type: 'portrait'
							});
						}
						appendRows(rows);
					} catch (e) {
						console.warn('[Browse] Failed to load plugins/recos:', e);
					}
				};

				dispatch({type: 'SET_LOADING', value: false});
				// Each loader appends its rows as it finishes. They start together and their
				// requests line up in the media server queue, so holding the later ones back
				// would only delay those rows without easing the load.
				if (!cancelled) {
					[
						loadLatestAndRecentlyReleased,
						loadCollections,
						loadFavorites,
						loadGenres,
						loadPlaylistsAndMusic,
						loadPluginsAndRecos
					].forEach((loader) => loader());
				}

			} catch (err) {
				console.error('Failed to load browse data:', err);
			} finally {
				dispatch({type: 'SET_LOADING', value: false});
			}
		};

		loadData();
		return () => {
			cancelled = true;
		};
	}, [
		api,
		serverUrl,
		accessToken,
		settings.featuredContentType,
		settings.featuredItemCount,
		settings.displayFavoritesRows,
		settings.displayCollectionsRows,
		settings.displayGenresRows,
		settings.displayPlaylistsRows,
		settings.favoritesRowSortBy,
		settings.collectionsRowSortBy,
		settings.genresRowSortBy,
		settings.genresRowItemFilter,
		settings.playlistsRowSortBy,
		settings.audioRowsSortBy,
		settings.uiLanguage,
		settings.pluginSections,
		settings.mergeContinueWatchingNextUp,
		settings.nextUpMaxDays,
		settings.sinceYouWatchedSource,
		settings.sinceYouWatchedSourceItem,
		settings.sinceYouWatchedSourceType,
		settings.sinceYouWatchedIncludeWatched,
		settings.tmdbApiKey,
		seerrEnabled,
		seerrAuthenticated,
		settings.rewatchIncludeMovies,
		settings.rewatchIncludeShows,
		settings.rewatchIncludeCollections,
		settings.rewatchSortBy,
		cacheOwner,
		fetchFreshFeaturedItems,
		unifiedMode,
		getItemServerUrl,
		refreshVolatileData,
		homeRowsConfig
	]); // eslint-disable-line no-use-before-define

	const setBrowseMode = useCallback((mode) => dispatch({type: 'SET_BROWSE_MODE', mode}), []);

	return {
		isLoading: state.isLoading,
		browseMode: state.browseMode,
		allRowData: state.allRowData,
		featuredItems: state.featuredItems,
		setBrowseMode,
		fetchFreshFeaturedItems,
		refreshVolatileData
	};
};

export default useBrowseData;
