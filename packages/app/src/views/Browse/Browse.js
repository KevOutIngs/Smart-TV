import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';
import {useAuth} from '../../context/AuthContext';
import {useSettings, TV_TO_SERVER_ROW, SERVER_TO_TV_ROW} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {ClassicMediaRow, ModernMediaRow} from '../../components/MediaRow';
import SeerrTileRow from '../../components/SeerrTileRow';
import LibraryButtonRow from '../../components/LibraryButtonRow';
import {getExternalHomeRowConfigs, fetchExternalPresetRow, fetchCustomHomeRow, fetchCalendarRows} from '../../utils/externalHomeRows';
import {getSeerrHomeRowConfigs, fetchSeerrHomeRow, SEERR_SECTION_TO_CONFIG} from '../../utils/seerrHomeRows';
import {resolveItemsByProviderIds} from '../../services/jellyfinApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import {getImageUrl, getBackdropId} from '../../utils/helpers';
import {toCssColor} from '../../theme/themeSpec';
import DetailSection from './DetailSection';
import FeaturedBanner from './FeaturedBanner';
import MakdBanner from './MakdBanner';
import GalleryBanner from './GalleryBanner';
import BannerBar from './BannerBar';
import BookshelfBar from './BookshelfBar';
import BackdropLayer from './BackdropLayer';
import useBrowseData from './useBrowseData';
import {FAVORITE_ROW_CONFIGS, FAVORITE_ROW_IDS, isHiddenByMap, parseHiddenMap} from './browseFilters';

import css from './Browse.module.less';

const FOCUS_DELAY_MS = 100;
const TRANSITION_DELAY_MS = 450;

let lastFocusState = null;

const Browse = ({
	onSelectItem,
	onSelectLibrary,
	onOpenRecordings,
	onPlayRecording,
	onSelectGenre,
	onSelectSeerrItem,
	onSelectSeerrGenre,
	onSelectSeerrStudio,
	onSelectSeerrNetwork,
	isVisible = true,
	onFocusItemThemeMusic,
	onBlurItemThemeMusic,
	onLeaveThemeMusic
}) => {
	const {api, serverUrl, accessToken, hasMultipleServers, user} = useAuth();
	const {settings, activeTheme, loaded: settingsLoaded} = useSettings();
	const {isEnabled: seerrEnabled, isAuthenticated: seerrAuthenticated, user: seerrUser} = useSeerr();
	const seerrUserId = seerrUser?.seerrUserId;
	const [seerrRows, setSeerrRows] = useState([]);
	const [externalRows, setExternalRows] = useState([]);
	const unifiedMode = settings.unifiedLibraryMode && hasMultipleServers;
	const isLegacy = typeof document !== 'undefined' && (' ' + document.documentElement.className + ' ').indexOf(' legacy ') >= 0;
	const [focusedItemForBackdrop, setFocusedItemForBackdrop] = useState(null);
	const mainContentRef = useRef(null);
	const detailSectionRef = useRef(null);
	const lastFocusedRowRef = useRef(null);
	const wasVisibleRef = useRef(true);
	const prevFilteredRowsRef = useRef([]);
	const filteredRowsLengthRef = useRef(0);
	const filteredRowsRef = useRef([]);
	const rowRefsMap = useRef(new Map());
	const initialFocusSetRef = useRef(false);
	const scrollTimeoutRef = useRef(null);
	const contentRowsRef = useRef(null);

	const showFeaturedBar = (settings.featuredBarStyle !== 'off');

	const registerRowRef = useCallback((rowIndex, element) => {
		if (element) {
			rowRefsMap.current.set(rowIndex, element);
		} else {
			rowRefsMap.current.delete(rowIndex);
		}
	}, []);

	const getItemServerUrl = useCallback((item) => {
		return item?._serverUrl || serverUrl;
	}, [serverUrl]);


	const uiPanelStyle = useMemo(() => {
		return {
			background: toCssColor(activeTheme.colors.surface),
			backdropFilter: 'none',
			WebkitBackdropFilter: 'none',
			border: 'var(--theme-card-border)',
			boxShadow: 'var(--theme-focus-glow)'
		};
	}, [activeTheme]);

	const uiButtonStyle = useMemo(() => {
		return {
			background: toCssColor(activeTheme.colors.buttonNormal),
			color: toCssColor(activeTheme.colors.onButtonNormal),
			backdropFilter: 'none',
			WebkitBackdropFilter: 'none',
			border: 'var(--theme-chip-border)',
			borderRadius: 'var(--theme-chip-radius)'
		};
	}, [activeTheme]);

	const useModernRows = settings.homeRowsStyle !== 'v1';
	const RowComponent = useModernRows ? ModernMediaRow : ClassicMediaRow;
	const showTopInfoArea = !useModernRows;

	const homeRowsConfig = useMemo(() => {
		return [...(settings.homeRows || [])].sort((a, b) => a.order - b.order);
	}, [settings.homeRows]);

	const pluginSectionsConfig = useMemo(() => {
		return [...(settings.pluginSections || [])].sort((a, b) => a.order - b.order);
	}, [settings.pluginSections]);

	const {
		isLoading, browseMode, allRowData, featuredItems,
		setBrowseMode, fetchFreshFeaturedItems, refreshVolatileData
	} = useBrowseData({
		api,
		serverUrl,
		accessToken,
		userId: user?.Id || null,
		settings,
		unifiedMode,
		seerrEnabled,
		seerrAuthenticated,
		getItemServerUrl,
		homeRowsConfig
	});

	const isRowVisibleByGates = useCallback((rowId) => {
		if (FAVORITE_ROW_IDS.includes(rowId)) return settings.displayFavoritesRows;
		if (rowId === 'collections') return settings.displayCollectionsRows;
		if (rowId === 'genres') return settings.displayGenresRows;
		if (rowId === 'playlists') return settings.displayPlaylistsRows;
		if (rowId === 'imdb-top250-movies') return settings.imdbTop250MoviesEnabled;
		if (rowId === 'imdb-top250-tv') return settings.imdbTop250TvShowsEnabled;
		if (rowId === 'imdb-popular-movies') return settings.imdbMostPopularMoviesEnabled;
		if (rowId === 'imdb-popular-tv') return settings.imdbMostPopularTvShowsEnabled;
		if (rowId === 'imdb-lowest-rated') return settings.imdbLowestRatedMoviesEnabled;
		if (rowId === 'imdb-top-english') return settings.imdbTopEnglishMoviesEnabled;
		return true;
	}, [settings.displayFavoritesRows, settings.displayCollectionsRows, settings.displayGenresRows, settings.displayPlaylistsRows,
		settings.imdbTop250MoviesEnabled, settings.imdbTop250TvShowsEnabled, settings.imdbMostPopularMoviesEnabled,
		settings.imdbMostPopularTvShowsEnabled, settings.imdbLowestRatedMoviesEnabled, settings.imdbTopEnglishMoviesEnabled]);

	const filteredRows = useMemo(() => {
		const enabledRowIds = homeRowsConfig.filter(r => r.enabled).map(r => r.id);
		const enabledRowIdsSet = new Set(enabledRowIds);
		enabledRowIds.forEach((id) => {
			const mappedId = TV_TO_SERVER_ROW[id] || SERVER_TO_TV_ROW[id];
			if (mappedId) enabledRowIdsSet.add(mappedId);
		});
		const enabledPluginIds = pluginSectionsConfig.filter((section) => section.enabled).map((section) => section.id);
		const rowOrderMap = new Map();
		homeRowsConfig.forEach((row) => {
			rowOrderMap.set(row.id, row.order);
			const mappedId = TV_TO_SERVER_ROW[row.id] || SERVER_TO_TV_ROW[row.id];
			if (mappedId) rowOrderMap.set(mappedId, row.order);
		});
		pluginSectionsConfig.forEach((section, index) => rowOrderMap.set(section.id, (section.order ?? index) + 1000));

		const hiddenCWMap = parseHiddenMap(settings.hiddenContinueWatchingItems);
		const hiddenNUMap = parseHiddenMap(settings.hiddenNextUpSeries);

		let result;

		if (settings.mergeContinueWatchingNextUp) {
			const mergeResumeRow = allRowData.find(r => r.id === 'resume');
			const nextUpRow = allRowData.find(r => r.id === 'nextup');
			const recentlyPlayed = allRowData.find(r => r.id === 'recentlyplayed');

			result = allRowData.filter(r => r.id !== 'resume' && r.id !== 'nextup');

			if (mergeResumeRow || nextUpRow) {
				const resumeItems = (mergeResumeRow?.items || []).filter(item => !isHiddenByMap(item, hiddenCWMap, false));
				const nextUpItems = (nextUpRow?.items || []).filter(item => !isHiddenByMap(item, hiddenNUMap, true));
				const recentlyPlayedItems = recentlyPlayed?.items || [];

				const seriesLastPlayedMap = new Map();
				resumeItems.forEach(item => {
					const seriesId = item.SeriesId;
					const lastPlayed = item.UserData?.LastPlayedDate;
					if (seriesId && lastPlayed) {
						const existing = seriesLastPlayedMap.get(seriesId);
						if (!existing || lastPlayed > existing) {
							seriesLastPlayedMap.set(seriesId, lastPlayed);
						}
					}
				});

				recentlyPlayedItems.forEach(item => {
					const seriesId = item.SeriesId;
					const lastPlayed = item.UserData?.LastPlayedDate;
					if (seriesId && lastPlayed) {
						const existing = seriesLastPlayedMap.get(seriesId);
						if (!existing || lastPlayed > existing) {
							seriesLastPlayedMap.set(seriesId, lastPlayed);
						}
					}
				});

				const mergeResumeItemIds = new Set(resumeItems.map(item => item.Id));

				const filteredNextUp = nextUpItems
					.filter(item => !mergeResumeItemIds.has(item.Id))
					.map(item => {
						const seriesLastPlayed = seriesLastPlayedMap.get(item.SeriesId);
						if (seriesLastPlayed && !item.UserData?.LastPlayedDate) {
							return {
								...item,
								UserData: {
									...item.UserData,
									LastPlayedDate: seriesLastPlayed
								}
							};
						}
						return item;
					});

				const combinedItems = [...resumeItems, ...filteredNextUp].sort((a, b) => {
					const aLastPlayed = a.UserData?.LastPlayedDate;
					const bLastPlayed = b.UserData?.LastPlayedDate;

					if (aLastPlayed && bLastPlayed) {
						return bLastPlayed.localeCompare(aLastPlayed);
					}
					if (aLastPlayed) return -1;
					if (bLastPlayed) return 1;
					return 0;
				});

				if (combinedItems.length > 0) {
					if (enabledRowIdsSet.has('resume') || enabledRowIdsSet.has('nextup')) {
						result = [{
							id: 'continue-nextup',
							title: $L('Continue Watching'),
							items: combinedItems,
							type: 'landscape'
						}, ...result];
					}
				}
			}

			result = result.filter((row) => {
				if (row.id === 'continue-nextup') return true;
				if (row.isPluginRow) return enabledPluginIds.includes(row.id);
				if (!isRowVisibleByGates(row.id)) return false;
				if (row.isLatestRow) return enabledRowIdsSet.has('latest-media') || enabledRowIdsSet.has('latestmedia');
				if (row.isRecentlyReleasedRow) return enabledRowIdsSet.has('recently-released') || enabledRowIdsSet.has('recentlyreleased');
				return enabledRowIdsSet.has(row.id) || enabledRowIdsSet.has(TV_TO_SERVER_ROW[row.id]) || enabledRowIdsSet.has(SERVER_TO_TV_ROW[row.id]);
			});
		} else {
			const resumeRow = allRowData.find(r => r.id === 'resume');
			const resumeItems = (resumeRow?.items || []).filter(item => !isHiddenByMap(item, hiddenCWMap, false));
			const resumeItemIds = new Set(resumeItems.map(item => item.Id));

			result = allRowData
				.map(row => {
					if (row.id === 'resume') {
						return resumeItems.length > 0 ? {...row, items: resumeItems} : null;
					}
					if (row.id === 'nextup') {
						const filteredItems = row.items.filter(item => !resumeItemIds.has(item.Id) && !isHiddenByMap(item, hiddenNUMap, true));
						return filteredItems.length > 0 ? {...row, items: filteredItems} : null;
					}
					return row;
				})
				.filter(row => {
					if (!row) return false;
					if (row.isPluginRow) {
						return enabledPluginIds.includes(row.id);
					}
					if (row.id === 'resume' || row.id === 'nextup') {
						return enabledRowIdsSet.has(row.id);
					}
					if (row.isLatestRow) {
						return enabledRowIdsSet.has('latest-media') || enabledRowIdsSet.has('latestmedia');
					}
					if (row.isRecentlyReleasedRow) {
						return enabledRowIdsSet.has('recently-released') || enabledRowIdsSet.has('recentlyreleased');
					}
					if (!isRowVisibleByGates(row.id)) {
						return false;
					}
					return enabledRowIdsSet.has(row.id) || enabledRowIdsSet.has(TV_TO_SERVER_ROW[row.id]) || enabledRowIdsSet.has(SERVER_TO_TV_ROW[row.id]);
				});
		}

		// Re-translate titles so cached rows pick up the current locale
		const favoriteLabelMap = new Map(FAVORITE_ROW_CONFIGS.map((row) => [row.id, $L(row.title)]));
		result = result.map(row => {
			let title;
			if (row.id === 'resume' || row.id === 'continue-nextup') title = $L('Continue Watching');
			else if (row.id === 'nextup') title = $L('Next Up');
			else if (row.id === 'library-tiles') title = $L('My Media');
			else if (row.id === 'librarybuttons') title = $L('Library Buttons');
			else if (row.id === 'collections') title = $L('Collections');
			else if (row.id === 'genres') title = $L('Genres');
			else if (row.id === 'playlists') title = $L('Playlists');
			else if (row.id === 'audioartists') title = $L('Music Artists');
			else if (row.id === 'audioalbums') title = $L('Music Albums');
			else if (row.id === 'audioplaylists') title = $L('Music Playlists');
			else if (row.id === 'resumeaudio') title = $L('Continue Listening');
			else if (row.id === 'activerecordings') title = $L('Recordings');
			else if (row.id === 'livetv') title = $L('Live TV');
			else if (favoriteLabelMap.has(row.id)) title = favoriteLabelMap.get(row.id);
			else if (row.isLatestRow && row.library) {
				const libName = row.library._serverName
					? `${row.library.Name} (${row.library._serverName})`
					: row.library.Name;
				title = $L('Recently Added in {libraryTitle}').replace('{libraryTitle}', libName);
			} else if (row.isRecentlyReleasedRow && row.library) {
				const libName = row.library._serverName
					? `${row.library.Name} (${row.library._serverName})`
					: row.library.Name;
				title = $L('Recently Released in {libraryTitle}').replace('{libraryTitle}', libName);
			}
			return title && title !== row.title ? {...row, title} : row;
		});

		result = [...result, ...seerrRows, ...externalRows];

		const resumeOrder = rowOrderMap.get('resume');
		const nextUpOrder = rowOrderMap.get('nextup');
		const continueOrder = Math.min(
			Number.isFinite(resumeOrder) ? resumeOrder : Number.MAX_SAFE_INTEGER,
			Number.isFinite(nextUpOrder) ? nextUpOrder : Number.MAX_SAFE_INTEGER
		);

		result = result
			.map((row, index) => {
				let order = rowOrderMap.get(row.id);
				if (row.id === 'continue-nextup') {
					order = Number.isFinite(continueOrder) ? continueOrder : 0;
				} else if (row.isLatestRow) {
					order = rowOrderMap.get('latest-media');
				} else if (row.isRecentlyReleasedRow) {
					order = rowOrderMap.get('recently-released');
				} else if (row.isCalendarMerged) {
					const radarrOrder = rowOrderMap.get('radarr_calendar');
					const sonarrOrder = rowOrderMap.get('sonarr_calendar');
					order = Math.min(
						Number.isFinite(radarrOrder) ? radarrOrder : Number.MAX_SAFE_INTEGER,
						Number.isFinite(sonarrOrder) ? sonarrOrder : Number.MAX_SAFE_INTEGER
					);
				} else if (row.isCustomRow) {
					order = 6000 + index;
				}
				if (!Number.isFinite(order)) {
					order = row.isPluginRow ? 2000 + index : 1000 + index;
				}
				return {row, index, order};
			})
			.sort((left, right) => left.order - right.order || left.index - right.index)
			.map((entry) => entry.row);

		const prev = prevFilteredRowsRef.current;
		if (prev.length === result.length) {
			let unchanged = true;
			for (let i = 0; i < result.length; i++) {
				if (result[i].id !== prev[i].id || result[i].items.length !== prev[i].items.length || result[i].title !== prev[i].title) {
					unchanged = false;
					break;
				}
				const rItems = result[i].items;
				const pItems = prev[i].items;
				if (rItems[0]?.Id !== pItems[0]?.Id || rItems[rItems.length - 1]?.Id !== pItems[pItems.length - 1]?.Id) {
					unchanged = false;
					break;
				}
			}
			if (unchanged) return prev;
		}

		prevFilteredRowsRef.current = result;
		return result;
	}, [allRowData, seerrRows, externalRows, homeRowsConfig, pluginSectionsConfig, settings.mergeContinueWatchingNextUp, settings.hiddenContinueWatchingItems, settings.hiddenNextUpSeries, isRowVisibleByGates]);

	const focusRow = useCallback((rowIndex) => {
		if (Spotlight.focus(`row-${rowIndex}`)) {
			return true;
		}

		const row = filteredRowsRef.current[rowIndex];
		const firstItemId = row?.items?.[0]?.Id;
		const keyPrefix = row?.id || rowIndex;

		if (firstItemId !== undefined && firstItemId !== null) {
			const firstCardSpotlightId = `media-${keyPrefix}-${firstItemId}`;
			if (Spotlight.focus(firstCardSpotlightId)) {
				return true;
			}
		}

		return false;
	}, []);

	const scrollToRow = useCallback((rowIndex, thenFocus) => {
		if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

		const targetRow = rowRefsMap.current.get(rowIndex);
		const container = contentRowsRef.current;
		if (!targetRow || !container) {
			if (thenFocus) focusRow(rowIndex);
			return;
		}

		const topbarOffset = settings.navbarPosition !== 'left' ? 130 : 0;
		container.scrollTop = Math.max(0, targetRow.offsetTop - topbarOffset);

		if (thenFocus) {
			let attempts = 0;
			const tryFocus = () => {
				attempts += 1;
				if (focusRow(rowIndex)) {
					return;
				}
				if (attempts < 6) {
					scrollTimeoutRef.current = setTimeout(tryFocus, 16);
				}
			};
			scrollTimeoutRef.current = setTimeout(tryFocus, 0);
		}
	}, [focusRow, settings.navbarPosition]);

	const handleNavigateUp = useCallback((fromRowIndex) => {
		if (fromRowIndex === 0) {
			if (showFeaturedBar !== false) {
				setBrowseMode('featured');
				setTimeout(() => Spotlight.focus('featured-banner'), 50);
			} else if (settings.navbarPosition !== 'left') {
				Spotlight.focus('navbar-home');
			}
			return;
		}
		const targetIndex = fromRowIndex - 1;
		scrollToRow(targetIndex, true);
	}, [showFeaturedBar, settings.navbarPosition, scrollToRow, setBrowseMode]);

	filteredRowsRef.current = filteredRows;
	filteredRowsLengthRef.current = filteredRows.length;

	const handleNavigateDown = useCallback((fromRowIndex) => {
		const targetIndex = fromRowIndex + 1;
		if (targetIndex >= filteredRowsLengthRef.current) return;
		scrollToRow(targetIndex, true);
	}, [scrollToRow]);

	useEffect(() => {
		if (showFeaturedBar === false) {
			setBrowseMode('rows');
		}
	}, [showFeaturedBar, setBrowseMode]);

	useEffect(() => {
		if (!isVisible) {
			wasVisibleRef.current = false;
			return;
		}
		if (wasVisibleRef.current || isLoading || filteredRows.length === 0) return;
		wasVisibleRef.current = true;

		fetchFreshFeaturedItems();
		refreshVolatileData(true);

		setTimeout(() => {
			if (lastFocusState && lastFocusState.rowIndex > 0) {
				const {rowIndex} = lastFocusState;
				const targetRowIndex = Math.min(rowIndex, filteredRows.length - 1);
				scrollToRow(targetRowIndex, true);
			} else if (showFeaturedBar !== false && featuredItems.length > 0) {
				setBrowseMode('featured');
				setTimeout(() => Spotlight.focus('featured-banner'), 50);
			} else {
				scrollToRow(0, true);
			}
			lastFocusState = null;
		}, FOCUS_DELAY_MS);
	}, [isVisible, isLoading, filteredRows.length, fetchFreshFeaturedItems, refreshVolatileData, showFeaturedBar, featuredItems.length, scrollToRow, setBrowseMode]);

	useEffect(() => {
		if (!isVisible) return;
		if (!isLoading && !initialFocusSetRef.current) {
			setTimeout(() => {
				if (lastFocusState || initialFocusSetRef.current) {
					return;
				}
				if (showFeaturedBar !== false && featuredItems.length > 0) {
					Spotlight.focus('featured-banner');
					initialFocusSetRef.current = true;
				} else if (filteredRows.length > 0) {
					Spotlight.focus('row-0');
					initialFocusSetRef.current = true;
				}
			}, FOCUS_DELAY_MS);
		}
	}, [isVisible, isLoading, featuredItems.length, filteredRows.length, showFeaturedBar, setBrowseMode]);

	useEffect(() => {
		initialFocusSetRef.current = false;
	}, [accessToken]);



	const targetBackdropUrl = useMemo(() => {
		if (browseMode === 'featured') return '';
		if (!focusedItemForBackdrop || isLegacy || settings.showHomeBackdrop === false) return '';

		if (focusedItemForBackdrop._externalBackdropUrl) {
			return focusedItemForBackdrop._externalBackdropUrl;
		}

		let targetItem = focusedItemForBackdrop;
		if (focusedItemForBackdrop.Type === 'Genre' && focusedItemForBackdrop._representative) {
			targetItem = focusedItemForBackdrop._representative;
		}

		const backdropId = getBackdropId(targetItem);
		if (!backdropId) return '';
		const itemUrl = getItemServerUrl(targetItem);
		return getImageUrl(itemUrl, backdropId, 'Backdrop', {maxWidth: 1280, quality: 80});
	}, [browseMode, focusedItemForBackdrop, isLegacy, settings.showHomeBackdrop, getItemServerUrl]);

	const handleSelectItem = useCallback((item) => {
		onBlurItemThemeMusic?.();
		onLeaveThemeMusic?.();
		if (lastFocusedRowRef.current !== null) {
			lastFocusState = {
				rowIndex: lastFocusedRowRef.current
			};
		}
		if (item.isRecordingsShortcut) {
			onOpenRecordings?.();
		} else if (item.isLibraryTile) {
			onSelectLibrary?.(item);
		} else if (item.Type === 'Recording') {
			onPlayRecording?.(item);
		} else {
			onSelectItem?.(item);
		}
	}, [onSelectItem, onSelectLibrary, onOpenRecordings, onPlayRecording, onBlurItemThemeMusic, onLeaveThemeMusic]);

	const handleSelectGenreItem = useCallback((item) => {
		onBlurItemThemeMusic?.();
		onLeaveThemeMusic?.();
		if (lastFocusedRowRef.current !== null) {
			lastFocusState = {
				rowIndex: lastFocusedRowRef.current
			};
		}
		onSelectGenre?.({
			id: item.Id,
			name: item.Name,
			_serverUrl: item._serverUrl,
			_serverType: item._serverType,
			_serverName: item._serverName,
			_serverAccessToken: item._serverAccessToken,
			_serverUserId: item._serverUserId,
			_serverId: item._serverId
		});
	}, [onSelectGenre, onBlurItemThemeMusic, onLeaveThemeMusic]);

	const handleSelectSeerrItem = useCallback((item) => {
		const raw = item._seerrRaw || {};
		switch (item._seerrType) {
			case 'genre':
				onSelectSeerrGenre?.(raw.genreId, raw.genreName, raw.mediaType);
				break;
			case 'studio':
				onSelectSeerrStudio?.(raw.studioId, raw.studioName);
				break;
			case 'network':
				onSelectSeerrNetwork?.(raw.networkId, raw.networkName);
				break;
			default:
				onSelectSeerrItem?.(raw);
				break;
		}
	}, [onSelectSeerrItem, onSelectSeerrGenre, onSelectSeerrStudio, onSelectSeerrNetwork]);

	// External row items that resolved to a library item are real Jellyfin items
	// and open normally, unresolved ones fall back to the Seerr detail.
	const handleSelectExternalItem = useCallback((item) => {
		if (item && item._seerr && !item._resolvedFromExternal) {
			handleSelectSeerrItem(item);
		} else {
			handleSelectItem(item);
		}
	}, [handleSelectSeerrItem, handleSelectItem]);

	useEffect(() => {
		if (!seerrEnabled || !seerrAuthenticated) {
			setSeerrRows([]);
			return;
		}
		const enabledSections = (settings.homeRows || []).filter((r) => r.enabled && SEERR_SECTION_TO_CONFIG[r.id]);
		if (enabledSections.length === 0) {
			setSeerrRows([]);
			return;
		}

		let cancelled = false;
		const configs = getSeerrHomeRowConfigs();

		(async () => {
			const built = await Promise.all(enabledSections.map(async (section) => {
				const configId = SEERR_SECTION_TO_CONFIG[section.id];
				const cfg = configs.find((c) => c.id === configId);
				if (!cfg) return null;
				const items = await fetchSeerrHomeRow(configId, {userId: seerrUserId});
				if (!items.length) return null;
				return {
					id: section.id,
					title: cfg.title,
					items,
					type: cfg.cardType,
					isSeerrRow: true,
					isTileRow: cfg.type === 'genre' || cfg.type === 'studio' || cfg.type === 'network'
				};
			}));
			if (!cancelled) setSeerrRows(built.filter(Boolean));
		})();

		return () => {
			cancelled = true;
		};
	}, [seerrEnabled, seerrAuthenticated, seerrUserId, settings.homeRows]);

	// External home rows (TMDB/IMDb presets and user custom rows). Items come back
	// as provider ids, so each row is resolved against the local library before
	// rendering: owned titles become playable, unowned fall back to Seerr.
	useEffect(() => {
		if (!settings.useMoonfinPlugin) {
			setExternalRows([]);
			return;
		}
		const enabledPresets = (settings.homeRows || []).filter((r) => r.enabled && (r.id.startsWith('tmdb_') || r.id.startsWith('imdb-'))).map((r) => r.id);
		const customRows = (settings.customHomeRows || []).filter((r) => r.enabled);
		const radarrEnabled = (settings.homeRows || []).some((r) => r.enabled && r.id === 'radarr_calendar');
		const sonarrEnabled = (settings.homeRows || []).some((r) => r.enabled && r.id === 'sonarr_calendar');
		const calendarsEnabled = radarrEnabled || sonarrEnabled;
		if (enabledPresets.length === 0 && customRows.length === 0 && !calendarsEnabled) {
			setExternalRows([]);
			return;
		}

		let cancelled = false;
		const presetConfigs = getExternalHomeRowConfigs();

		(async () => {
			try {
				const presetData = await Promise.all(enabledPresets.map(async (id) => {
					const cfg = presetConfigs.find((c) => c.id === id);
					if (!cfg) return null;
					const items = await fetchExternalPresetRow(id);
					return {id, title: cfg.title, items: items || []};
				}));

				const customData = await Promise.all(customRows.map(async (row) => {
					const items = await fetchCustomHomeRow(row);
					return {id: `external-${row.id}`, title: row.name || row.title || $L('Custom'), items: items || [], isCustomRow: true};
				}));

				const calendarSettings = {
					mergeRadarrSonarrCalendars: settings.mergeRadarrSonarrCalendars,
					radarrCalendarShowCinema: settings.radarrCalendarShowCinema,
					radarrCalendarShowDigital: settings.radarrCalendarShowDigital,
					radarrCalendarShowPhysical: settings.radarrCalendarShowPhysical,
					radarrCalendarShowDate: settings.radarrCalendarShowDate,
					sonarrCalendarShowDate: settings.sonarrCalendarShowDate,
					sonarrCalendarShowEpisodeInfo: settings.sonarrCalendarShowEpisodeInfo
				};
				const calendarRows = calendarsEnabled ? await fetchCalendarRows(calendarSettings, {radarrEnabled, sonarrEnabled}) : [];

				const allRows = [
					...presetData,
					...customData,
					...calendarRows.map(r => ({...r, isCalendarRow: true}))
				].filter(r => r && r.items && r.items.length > 0);

				const allItemsToResolve = [];
				const rowIndices = [];
				for (const r of allRows) {
					rowIndices.push({
						start: allItemsToResolve.length,
						count: r.items.length
					});
					allItemsToResolve.push(...r.items);
				}

				const resolvedAllItems = await resolveItemsByProviderIds(allItemsToResolve);

				const presetRows = [];
				const builtCustomRows = [];
				const resolvedCalendarRows = [];

				for (let i = 0; i < allRows.length; i++) {
					const r = allRows[i];
					const sliceInfo = rowIndices[i];
					const resolvedItems = resolvedAllItems.slice(sliceInfo.start, sliceInfo.start + sliceInfo.count);

					if (r.isCalendarRow) {
						resolvedCalendarRows.push({
							...r,
							items: resolvedItems
						});
					} else {
						const resolvedRow = {
							id: r.id,
							title: r.title,
							items: resolvedItems,
							isExternalRow: true,
							isCustomRow: r.isCustomRow
						};
						if (r.isCustomRow) {
							builtCustomRows.push(resolvedRow);
						} else {
							presetRows.push(resolvedRow);
						}
					}
				}

				if (!cancelled) {
					setExternalRows([...presetRows, ...builtCustomRows, ...resolvedCalendarRows].filter(Boolean));
				}
			} catch (err) {
				console.warn('[Browse] Failed to fetch and resolve external rows:', err);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [settings.useMoonfinPlugin, settings.homeRows, settings.customHomeRows,
		settings.mergeRadarrSonarrCalendars,
		settings.radarrCalendarShowCinema, settings.radarrCalendarShowDigital, settings.radarrCalendarShowPhysical,
		settings.radarrCalendarShowDate, settings.sonarrCalendarShowDate, settings.sonarrCalendarShowEpisodeInfo]);

	const handleNavigateDownFromFeatured = useCallback(() => {
		setBrowseMode('rows');
		setTimeout(() => {
			scrollToRow(0, true);
		}, TRANSITION_DELAY_MS);
	}, [scrollToRow, setBrowseMode]);

	const handleFeaturedFocusCallback = useCallback(() => {
		setBrowseMode('featured');
		detailSectionRef.current?.clearFocusedItem();
	}, [setBrowseMode]);

	const handleRowFocus = useCallback((rowIndex) => {
		if (browseMode !== 'rows') {
			setBrowseMode('rows');
		}
		if (typeof rowIndex === 'number') {
			lastFocusedRowRef.current = rowIndex;
		}
	}, [browseMode, setBrowseMode]);

	const handleFocusItem = useCallback((item) => {
		if (showTopInfoArea) {
			detailSectionRef.current?.handleFocusItem(item);
		}
		if (item?.Id && (item.Type === 'Movie' || item.Type === 'Series')) {
			onFocusItemThemeMusic?.(item.Id);
		} else {
			onBlurItemThemeMusic?.();
		}
	}, [onFocusItemThemeMusic, onBlurItemThemeMusic, showTopInfoArea]);

	if (isLoading) {
		return (
			<div className={css.page}>
				<div className={css.loadingContainer}>
					<LoadingSpinner />
					<p>{$L('Loading your library...')}</p>
				</div>
			</div>
		);
	}

	return (
		<div className={css.page}>
			<div className={`${css.mainContent} ${settings.navbarPosition === 'left' ? css.sidebarOffset : css.topbarOffset}`} ref={mainContentRef}>
				<BackdropLayer
					targetUrl={targetBackdropUrl}
					blurAmount={settings.backdropBlurHome}
				/>

				{featuredItems.length > 0 && showFeaturedBar !== false && (
					settings.featuredBarStyle === 'gallery' ? (
						<GalleryBanner
							isVisible={browseMode === 'featured'}
							browseVisible={isVisible}
							featuredItems={featuredItems}
							api={api}
							settings={settings}
							settingsLoaded={settingsLoaded}
							getItemServerUrl={getItemServerUrl}
							onSelectItem={handleSelectItem}
							onNavigateDown={handleNavigateDownFromFeatured}
							onFeaturedFocus={handleFeaturedFocusCallback}
						/>
					) : settings.featuredBarStyle === 'banner' ? (
						<BannerBar
							isVisible={browseMode === 'featured'}
							featuredItems={featuredItems}
							settings={settings}
							getItemServerUrl={getItemServerUrl}
							onSelectItem={handleSelectItem}
							onNavigateDown={handleNavigateDownFromFeatured}
							onFeaturedFocus={handleFeaturedFocusCallback}
						/>
					) : settings.featuredBarStyle === 'bookshelf' ? (
						<BookshelfBar
							isVisible={browseMode === 'featured'}
							featuredItems={featuredItems}
							settings={settings}
							getItemServerUrl={getItemServerUrl}
							onSelectItem={handleSelectItem}
							onNavigateDown={handleNavigateDownFromFeatured}
							onFeaturedFocus={handleFeaturedFocusCallback}
						/>
					) : settings.featuredBarStyle === 'makd' ? (
						<MakdBanner
							isVisible={browseMode === 'featured'}
							featuredItems={featuredItems}
							serverUrl={serverUrl}
							settings={settings}
							getItemServerUrl={getItemServerUrl}
							onSelectItem={handleSelectItem}
							onNavigateDown={handleNavigateDownFromFeatured}
							onFeaturedFocus={handleFeaturedFocusCallback}
						/>
					) : (
						<FeaturedBanner
							isVisible={browseMode === 'featured'}
							browseVisible={isVisible}
							featuredItems={featuredItems}
							serverUrl={serverUrl}
							api={api}
							settings={settings}
							settingsLoaded={settingsLoaded}
							getItemServerUrl={getItemServerUrl}
							onSelectItem={handleSelectItem}
							onNavigateDown={handleNavigateDownFromFeatured}
							onFeaturedFocus={handleFeaturedFocusCallback}
							uiPanelStyle={uiPanelStyle}
							uiButtonStyle={uiButtonStyle}
						/>
					)
				)}

				{showTopInfoArea && (
					<DetailSection
						ref={detailSectionRef}
						browseMode={browseMode}
						api={api}
						getItemServerUrl={getItemServerUrl}
						settings={settings}
						onFocusedItemChange={setFocusedItemForBackdrop}
					/>
				)}

				<div
					ref={contentRowsRef}
					className={`${css.contentRows} ${browseMode === 'rows' ? css.rowsMode : ''}`}
				>
					{filteredRows.map((row, index) => {
						if (row.isButtonRow) {
							return (
								<LibraryButtonRow
									key={row.id}
									rowId={row.id}
									title={row.title}
									items={row.items}
									onSelectItem={handleSelectItem}
									onFocus={handleRowFocus}
									onFocusItem={handleFocusItem}
									rowIndex={index}
									onNavigateUp={handleNavigateUp}
									onNavigateDown={handleNavigateDown}
									registerRowRef={registerRowRef}
								/>
							);
						}
						if (row.isTileRow) {
							return (
								<SeerrTileRow
									key={row.id}
									rowId={row.id}
									title={row.title}
									items={row.items}
									cardType={row.type}
									onSelectItem={handleSelectSeerrItem}
									onFocus={handleRowFocus}
									onFocusItem={handleFocusItem}
									rowIndex={index}
									onNavigateUp={handleNavigateUp}
									onNavigateDown={handleNavigateDown}
									registerRowRef={registerRowRef}
								/>
							);
						}
						let selectHandler = handleSelectItem;
						if (row.isSeerrRow || row.isOnlineRecoRow) selectHandler = handleSelectSeerrItem;
						else if (row.isExternalRow) selectHandler = handleSelectExternalItem;
						else if (row.isGenreRow) selectHandler = handleSelectGenreItem;
						return (
							<RowComponent
								key={row.id}
								rowId={row.id}
								title={row.title}
								items={row.items}
								serverUrl={serverUrl}
								cardType={row.type}
								rowImageType={settings.homeRowsImageType}
								onSelectItem={selectHandler}
								onFocus={handleRowFocus}
								onFocusItem={handleFocusItem}
								rowIndex={index}
								onNavigateUp={handleNavigateUp}
								onNavigateDown={handleNavigateDown}
								showServerBadge={unifiedMode}
								showOverview={settings.homeRowOverlay === 'on'}
								registerRowRef={registerRowRef}
							/>
						);
					})}
					{filteredRows.length === 0 && (
						<div className={css.empty}>{$L('No content found')}</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Browse;
