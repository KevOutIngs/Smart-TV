import {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';
import {useAuth} from '../../context/AuthContext';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {ClassicMediaRow, ModernMediaRow} from '../../components/MediaRow';
import SeerrTileRow from '../../components/SeerrTileRow';
import LibraryButtonRow from '../../components/LibraryButtonRow';
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
import useSeerrRows from './useSeerrRows';
import useExternalRows from './useExternalRows';
import {buildBrowseRows, sameRowList} from './buildBrowseRows';

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
	const seerrRows = useSeerrRows({
		seerrEnabled,
		seerrAuthenticated,
		seerrUserId,
		homeRows: settings.homeRows
	});
	const externalRows = useExternalRows({settings});
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

	// Only the parts a theme owns belong here. Painting a surface color or clearing
	// the filter would flatten the frosted treatment the stylesheet applies.
	const uiPanelStyle = useMemo(() => {
		return {
			boxShadow: 'var(--theme-focus-glow)'
		};
	}, []);

	const uiButtonStyle = useMemo(() => {
		return {
			color: toCssColor(activeTheme.colors.onButtonNormal),
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

	// Only the settings the row list is built from, so a change to any other one doesn't
	// rebuild every row.
	const rowBuildSettings = useMemo(() => ({
		mergeContinueWatchingNextUp: settings.mergeContinueWatchingNextUp,
		hiddenContinueWatchingItems: settings.hiddenContinueWatchingItems,
		hiddenNextUpSeries: settings.hiddenNextUpSeries,
		displayFavoritesRows: settings.displayFavoritesRows,
		displayCollectionsRows: settings.displayCollectionsRows,
		displayGenresRows: settings.displayGenresRows,
		displayPlaylistsRows: settings.displayPlaylistsRows,
		imdbTop250MoviesEnabled: settings.imdbTop250MoviesEnabled,
		imdbTop250TvShowsEnabled: settings.imdbTop250TvShowsEnabled,
		imdbMostPopularMoviesEnabled: settings.imdbMostPopularMoviesEnabled,
		imdbMostPopularTvShowsEnabled: settings.imdbMostPopularTvShowsEnabled,
		imdbLowestRatedMoviesEnabled: settings.imdbLowestRatedMoviesEnabled,
		imdbTopEnglishMoviesEnabled: settings.imdbTopEnglishMoviesEnabled,
		blockedRatings: settings.blockedRatings
	}), [settings.mergeContinueWatchingNextUp, settings.hiddenContinueWatchingItems, settings.hiddenNextUpSeries,
		settings.displayFavoritesRows, settings.displayCollectionsRows, settings.displayGenresRows, settings.displayPlaylistsRows,
		settings.imdbTop250MoviesEnabled, settings.imdbTop250TvShowsEnabled, settings.imdbMostPopularMoviesEnabled,
		settings.imdbMostPopularTvShowsEnabled, settings.imdbLowestRatedMoviesEnabled, settings.imdbTopEnglishMoviesEnabled,
		settings.blockedRatings]);

	const filteredRows = useMemo(() => {
		const result = buildBrowseRows({
			allRowData,
			seerrRows,
			externalRows,
			homeRowsConfig,
			pluginSectionsConfig,
			settings: rowBuildSettings
		});
		const prev = prevFilteredRowsRef.current;
		if (sameRowList(prev, result)) return prev;
		prevFilteredRowsRef.current = result;
		return result;
	}, [allRowData, seerrRows, externalRows, homeRowsConfig, pluginSectionsConfig, rowBuildSettings]);

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

	// External row items that resolved to a library item open as the library item, and the ones
	// that did not open as the Seerr title they came from.
	const handleSelectExternalItem = useCallback((item) => {
		if (item && item._seerr && !item._resolvedFromExternal) {
			handleSelectSeerrItem(item);
		} else {
			handleSelectItem(item);
		}
	}, [handleSelectSeerrItem, handleSelectItem]);

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
						// Per library rows share one override under the id that gates them.
						// Overrides are a classic rows feature, the modern layout keeps its
						// own arrangement untouched.
						const imageTypeKey = row.isLatestRow ? 'latest-media'
							: row.isRecentlyReleasedRow ? 'recently-released' : row.id;
						const rowImageOverride = settings.homeRowsStyle === 'v1'
							? (settings.homeRowImageTypes || {})[imageTypeKey]
							: undefined;
						return (
							<RowComponent
								key={row.id}
								rowId={row.id}
								title={row.title}
								items={row.items}
								serverUrl={serverUrl}
								cardType={row.type}
								rowImageType={rowImageOverride || settings.homeRowsImageType}
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
