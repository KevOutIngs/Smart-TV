import {Fragment, useCallback, useState, useEffect, useMemo, useRef} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import Button from '@enact/sandstone/Button';
import Slider from '@enact/sandstone/Slider';
import {useAuth} from '../../context/AuthContext';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {useDeviceInfo} from '../../hooks/useDeviceInfo';
import {isBackKey} from '../../utils/keys';
import {isWebOS} from '../../platform';
import ClearDataDialog from '../../components/ClearDataDialog';
import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {clearAllStorage} from '../../services/storage';
import {getSeerrHomeRowConfigs, SEERR_CONFIG_TO_SECTION} from '../../utils/seerrHomeRows';
import {TMDB_PRESETS, detectCustomSource, validateCustomRow} from '../../utils/externalHomeRows';
import {formatPlaybackTimeSlot} from '../../utils/playbackTimeLabels';
import {
	getHomeRowsStyleOptions,
	getLabel,
	getRatingSourceOptions
} from './settingsOptions';
import {KIND, SCHEMA_BY_KEY, SETTINGS_SCHEMA, resolve, spotlightIdOf} from './settingsSchema';
import {MIN_QUERY_LENGTH, buildSettingsIndex, matchSettings} from './settingsSearch';
import {CATEGORY_ICONS, IconArrowUp, IconArrowDown, renderSettingsIcon, renderToggle, renderRadio, renderChevron} from './settingsIcons';
import {PLUGIN_SECTION_RENDER_STEP, getPluginSectionSourceLabel, isHomeRowVisibleByGates} from './homeSectionsModel';
import useSeerrAccount from './useSeerrAccount';
import useThemeStore from './useThemeStore';
import useHomeRowsEditor from './useHomeRowsEditor';
import useButtonLayoutEditor from './useButtonLayoutEditor';
import useLibraryVisibility from './useLibraryVisibility';
import useMediaBarSources from './useMediaBarSources';
import useDiagnosticsLog, {LOG_FILTERS, LOG_RENDER_STEP, logLevelColor} from './useDiagnosticsLog';

import css from './Settings.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');
const ViewContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''}
}, 'div');

const hexToRgba = (hex) => {
	const clean = hex.replace('#', '');
	const a = parseInt(clean.slice(0, 2), 16) / 255;
	const r = parseInt(clean.slice(2, 4), 16);
	const g = parseInt(clean.slice(4, 6), 16);
	const b = parseInt(clean.slice(6, 8), 16);
	if (a >= 0.999) return `rgb(${r}, ${g}, ${b})`;
	return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
};

const Settings = ({ onBack, onLibrariesChanged, panelMode }) => {
	const { api, serverUrl, accessToken, hasMultipleServers, logoutAll } = useAuth();
	const { settings, updateSetting, updateSettings, resetSettings, availableThemes, activeThemeId, selectThemeById, saveStoreTheme, deleteStoreTheme } = useSettings();
	const { capabilities } = useDeviceInfo();
	const seerr = useSeerr();
	const isSeerr = seerr.isMoonfin && seerr.variant === 'seerr';
	const bootLocaleRef = useRef(settings.uiLanguage);
	useEffect(() => {
		if (settings.uiLanguage !== bootLocaleRef.current &&
			typeof window !== 'undefined' && window.location) {
			window.location.reload();
		}
	}, [settings.uiLanguage]);
	const seerrLabel = isSeerr ? seerr.displayName || $L('Seerr') : $L('Seerr');
	// Category labels do not depend on anything but the locale, so they resolve without
	// the settings context, which is not built until further down.
	const categories = SETTINGS_SCHEMA.map((category) => ({
		id: category.id,
		label: resolve(category.label),
		description: resolve(category.description),
		Icon: CATEGORY_ICONS[category.icon]
	}));

	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedQuery, setDebouncedQuery] = useState('');
	// Read by the focus effect and the back handler, both of which are registered once.
	const searchResultsRef = useRef([]);
	const searchQueryRef = useRef('');

	const [navStack, setNavStack] = useState([{ view: 'categories' }]);
	const currentView = navStack[navStack.length - 1];
	const pendingFocusRef = useRef(null);
	const navStackRef = useRef(navStack);
	navStackRef.current = navStack;

	const pushView = useCallback((view) => {
		setNavStack((prev) => [...prev, view]);
	}, []);

	const popView = useCallback(() => {
		setNavStack((prev) => {
			if (prev.length <= 1) {
				onBack?.();
				return prev;
			}
			const popped = prev[prev.length - 1];
			pendingFocusRef.current = popped.returnFocusTo || null;
			return prev.slice(0, -1);
		});
	}, [onBack]);

	const [serverVersion, setServerVersion] = useState(null);
	const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);
	const [tempRatingSources, setTempRatingSources] = useState([]);
	const [tempExcludedGenresText, setTempExcludedGenresText] = useState('');
	const [customRowUrl, setCustomRowUrl] = useState('');
	const [customRowName, setCustomRowName] = useState('');
	const [customRowError, setCustomRowError] = useState('');
	const [customRowSaving, setCustomRowSaving] = useState(false);
	const [tempPinCode, setTempPinCode] = useState('0000');
	const [pinCodeError, setPinCodeError] = useState('');

	const focusViewDefault = useCallback((cv) => {
			if (cv.view === 'categories') {
				// With a query up the categories are not mounted, so the first result is
				// the only thing there is to land on.
				const results = searchResultsRef.current;
				if (searchQueryRef.current) {
					Spotlight.focus(results.length > 0
						? `settings-result-${results[0].id}`
						: 'settings-search-input');
					return;
				}
				Spotlight.focus(`cat-${categories[0]?.id || 'accountSecurity'}`);
			} else if (cv.view === 'category') {
				const subcats = getSubcategories(cv.id); // eslint-disable-line no-use-before-define
				Spotlight.focus(subcats.length > 0 ? `subcat-${subcats[0].id}` : 'category-view');
			} else if (cv.view === 'subcategory') {
				Spotlight.focus('subcategory-view');
			} else if (cv.view === 'options') {
				const idx = cv.options?.findIndex((o) => o.value === settings[cv.settingKey]);
				Spotlight.focus(idx >= 0 ? `opt-${idx}` : 'opt-0');
			} else if (cv.view === 'themes') {
				const selectedId = availableThemes.find((t) => t.id === activeThemeId)?.id;
				Spotlight.focus(selectedId ? `theme-card-${selectedId}` : 'themes-view');
			} else if (cv.view === 'themeStore') {
				Spotlight.focus('theme-store-view');
			} else if (cv.view === 'homeRows') {
				Spotlight.focus('homerows-view');
			} else if (cv.view === 'seerrHomeRows') {
				Spotlight.focus('seerr-home-rows-view');
			} else if (cv.view === 'imdbLists') {
				Spotlight.focus('imdb-lists-view');
			} else if (cv.view === 'externalTmdbLists') {
				Spotlight.focus('external-tmdb-lists-view');
			} else if (cv.view === 'externalCalendars') {
				Spotlight.focus('external-calendars-view');
			} else if (cv.view === 'externalCustomRows') {
				Spotlight.focus('external-custom-rows-view');
			} else if (cv.view === 'libraries') {
				Spotlight.focus('libraries-view');
			} else if (cv.view === 'ratingSources') {
				Spotlight.focus('rating-sources-view');
			} else if (cv.view === 'excludedGenres') {
				Spotlight.focus('excluded-genres-input');
			} else if (cv.view === 'pinCode') {
				Spotlight.focus('pin-code-input');
			} else if (cv.view === 'mediaBarLibraries') {
				Spotlight.focus('media-bar-libraries-view');
			} else if (cv.view === 'mediaBarCollections') {
				Spotlight.focus('media-bar-collections-view');
			} else {
				// Any screen not named above would otherwise leave focus where it
				// already was, which is outside the panel. Each screen is a single
				// container, so landing on that is always somewhere useful.
				const container = document.querySelector(`.${css.viewContainer}[data-spotlight-id]`);
				if (container) Spotlight.focus(container.getAttribute('data-spotlight-id'));
			}
	}, [categories, settings, availableThemes, activeThemeId]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		let retry = null;
		const timer = setTimeout(() => {
			const cv = navStack[navStack.length - 1];
			const target = pendingFocusRef.current;
			pendingFocusRef.current = null;
			if (!target) {
				focusViewDefault(cv);
				return;
			}
			// A deep linked row may not have attached yet on a slow TV, and its condition
			// could have flipped since the search index was built, so give it one more
			// frame before settling for the top of the screen.
			if (Spotlight.focus(target)) return;
			retry = setTimeout(() => {
				if (!Spotlight.focus(target)) focusViewDefault(cv);
			}, 180);
		}, 50);
		return () => {
			clearTimeout(timer);
			if (retry) clearTimeout(retry);
		};
	}, [navStack]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!isBackKey(e)) return;
			e.preventDefault();
			e.stopPropagation();
			// App.js stops back keys propagating before React sees them, so SpottableInput
			// never gets to close itself. Stepping out of the field is handled here
			// instead, which covers every input on these screens.
			if (e.target.tagName === 'INPUT') {
				let host = e.target.parentElement;
				while (host && !host.getAttribute('data-spotlight-id')) host = host.parentElement;
				e.target.blur();
				if (host) Spotlight.focus(host.getAttribute('data-spotlight-id'));
				return;
			}
			// A query is its own layer to back out of before leaving the screen.
			if (navStackRef.current.length === 1 && searchQueryRef.current) {
				setSearchQuery('');
				setDebouncedQuery('');
				Spotlight.focus('settings-search-input');
				return;
			}
			popView();
		};
		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [popView]);

	useEffect(() => {
		if (serverUrl && accessToken) {
			fetch(`${serverUrl}/System/Info`, {
				headers: { Authorization: `MediaBrowser Token="${accessToken}"` }
			})
				.then((res) => res.json())
				.then((data) => {
					if (data.Version) setServerVersion(data.Version);
				})
				.catch(() => {});
		}
	}, [serverUrl, accessToken]);

	const toggleSetting = useCallback(
		(key) => {
			updateSetting(key, !settings[key]);
		},
		[settings, updateSetting]
	);

	const handleOptionSelect = useCallback(
		(settingKey, value) => {
			if (settingKey === '__themeSelection') {
				selectThemeById(value);
				popView();
				return;
			}
			updateSetting(settingKey, value);
			popView();
		},
		[updateSetting, popView, selectThemeById]
	);

	const openRatingSources = useCallback(() => {
		setTempRatingSources(Array.isArray(settings.mdblistRatingSources) ? [...settings.mdblistRatingSources] : []);
		pushView({view: 'ratingSources', returnFocusTo: 'setting-ratingSources'});
	}, [settings.mdblistRatingSources, pushView]);

	const toggleRatingSource = useCallback((sourceValue) => {
		setTempRatingSources((prev) => {
			if (prev.includes(sourceValue)) {
				return prev.filter((value) => value !== sourceValue);
			}
			return [...prev, sourceValue];
		});
	}, []);

	const saveRatingSources = useCallback(() => {
		updateSetting('mdblistRatingSources', tempRatingSources);
		popView();
	}, [tempRatingSources, updateSetting, popView]);

	const openExcludedGenres = useCallback(() => {
		const excluded = Array.isArray(settings.excludedGenres) ? settings.excludedGenres : [];
		setTempExcludedGenresText(excluded.join(', '));
		pushView({view: 'excludedGenres', returnFocusTo: 'setting-excludedGenres'});
	}, [settings.excludedGenres, pushView]);

	const saveExcludedGenres = useCallback(() => {
		const parsed = tempExcludedGenresText
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
		const normalized = [...new Set(parsed.map((value) => value.toLowerCase()))];
		updateSetting('excludedGenres', normalized);
		popView();
	}, [tempExcludedGenresText, updateSetting, popView]);

	const openPinCode = useCallback(() => {
		const currentPin = typeof settings.pinCode === 'string' && /^\d{4}$/.test(settings.pinCode)
			? settings.pinCode
			: '0000';
		setTempPinCode(currentPin);
		setPinCodeError('');
		pushView({view: 'pinCode', returnFocusTo: 'setting-pinCode'});
	}, [settings.pinCode, pushView]);

	const savePinCode = useCallback(() => {
		if (!/^\d{4}$/.test(tempPinCode)) {
			setPinCodeError($L('PIN must be exactly 4 digits.'));
			return;
		}
		updateSetting('pinCode', tempPinCode);
		setPinCodeError('');
		popView();
	}, [tempPinCode, updateSetting, popView]);

	const openSeerrHomeRows = useCallback(() => {
		pushView({view: 'seerrHomeRows', returnFocusTo: 'setting-seerrHomeRows'});
	}, [pushView]);

	const openImdbLists = useCallback(() => {
		pushView({ view: 'imdbLists', returnFocusTo: 'setting-imdbLists' });
	}, [pushView]);

	const openExternalTmdbLists = useCallback(() => {
		pushView({view: 'externalTmdbLists', returnFocusTo: 'setting-externalTmdbLists'});
	}, [pushView]);

	const openExternalCalendars = useCallback(() => {
		pushView({view: 'externalCalendars', returnFocusTo: 'setting-externalCalendars'});
	}, [pushView]);

	const openExternalCustomRows = useCallback(() => {
		pushView({view: 'externalCustomRows', returnFocusTo: 'setting-externalCustomRows'});
	}, [pushView]);

	const {
		moonfinStatus, moonfinConnecting, seerrAuthType, seerrUsername, onSeerrUsernameChange,
		seerrPassword, onSeerrPasswordChange, seerrAuthSubmitting, seerrAuthMessage, seerrAuthError,
		handleMoonfinToggle, handleSeerrAuthTypeChange, handleSeerrLogin,
		handleSeerrPasswordKeyDown, handleSeerrLogout
	} = useSeerrAccount({seerr, seerrLabel, settings, updateSetting, serverUrl, accessToken});

	const {
		themeStoreCatalog, themeStoreLoading, themeStoreError, themeStoreBusyId,
		openThemes, openThemeStore, handleStoreThemeClick
	} = useThemeStore({
		currentViewName: currentView.view,
		pushView,
		availableThemes,
		selectThemeById,
		saveStoreTheme,
		deleteStoreTheme
	});

	const {
		tempHomeRows, tempPluginSections, pluginSectionRenderLimit, setPluginSectionRenderLimit,
		toggleHomeRowEnabled, toggleSeerrHomeRow, openHomeRows, saveHomeRows, resetHomeRows,
		toggleHomeRow, moveHomeRowUp, moveHomeRowDown,
		togglePluginSection, movePluginSectionUp, movePluginSectionDown
	} = useHomeRowsEditor({api, settings, updateSetting, updateSettings, pushView, popView});

	const {
		tempButtons, buttonLayoutKind, openDetailButtons, openOsdButtons,
		saveButtonLayout, resetButtonLayout, toggleLayoutButton, moveLayoutButton
	} = useButtonLayoutEditor({settings, updateSettings, pushView, popView});

	const {
		allLibraries, hiddenLibraries, libraryLoading, librarySaving,
		openLibraries, toggleLibraryVisibility, saveLibraryVisibility
	} = useLibraryVisibility({api, settings, hasMultipleServers, pushView, popView, onLibrariesChanged});

	const {
		mediaBarLibraries, mediaBarCollections, tempMediaBarLibraryIds, tempMediaBarCollectionIds,
		mediaBarSourcesLoading, openMediaBarLibraries, openMediaBarCollections,
		toggleMediaBarLibrary, toggleMediaBarCollection, saveMediaBarLibraries, saveMediaBarCollections
	} = useMediaBarSources({api, settings, updateSettings, pushView, popView});

	const {
		logEntries, logFilter, setLogFilter, logRenderLimit, setLogRenderLimit,
		logMessage, sendingReport, openDiagnostics, handleClearLogs, handleSendReport
	} = useDiagnosticsLog({currentViewName: currentView.view, pushView});

	// scrollIntoView options are ignored on older Tizen and webOS WebKit, which would
	// leave a deep linked row focused somewhere off screen, so the scroller is nudged by
	// hand instead. e.currentTarget is the .listContent element this is bound to.
	const handleListFocus = useCallback((e) => {
		const container = e.currentTarget;
		const el = e.target;
		if (!container || !el || !el.getBoundingClientRect) return;
		const pad = 24;
		const view = container.getBoundingClientRect();
		const row = el.getBoundingClientRect();
		if (row.top < view.top) {
			container.scrollTop -= (view.top - row.top) + pad;
		} else if (row.bottom > view.bottom) {
			container.scrollTop += (row.bottom - view.bottom) + pad;
		}
	}, []);

	const renderSectionTitle = (title) => <div className={css.sectionTitle}>{title}</div>;

	/* eslint-disable react/jsx-no-bind */
	const renderOptionItem = (settingKey, title, options, fallback, iconName) => (
		<SpottableDiv
			className={css.listItem}
			onClick={() => pushView({ view: 'options', title, options, settingKey, returnFocusTo: `setting-${settingKey}` })}
			spotlightId={`setting-${settingKey}`}
		>
			{renderSettingsIcon(iconName)}
			<div className={css.listItemBody}>
				<div className={css.listItemHeading}>{title}</div>
				<div className={css.listItemCaption}>{getLabel(options, settings[settingKey], fallback)}</div>
			</div>
			<div className={css.listItemTrailing}>{renderChevron()}</div>
		</SpottableDiv>
	);

	const renderToggleItem = (settingKey, title, desc, iconName, onToggle) => (
		<SpottableDiv
			className={css.listItem}
			onClick={() => (onToggle ? onToggle() : toggleSetting(settingKey))}
			spotlightId={`setting-${settingKey}`}
		>
			{renderSettingsIcon(iconName)}
			<div className={css.listItemBody}>
				<div className={css.listItemHeading}>{title}</div>
				{desc && <div className={css.listItemCaption}>{desc}</div>}
			</div>
			<div className={css.listItemTrailing}>{renderToggle(settings[settingKey])}</div>
		</SpottableDiv>
	);

	const renderNavItem = (id, title, desc, onClick, iconName) => (
		<SpottableDiv className={css.listItem} onClick={onClick} spotlightId={`setting-${id}`}>
			{renderSettingsIcon(iconName)}
			<div className={css.listItemBody}>
				<div className={css.listItemHeading}>{title}</div>
				{desc && <div className={css.listItemCaption}>{desc}</div>}
			</div>
			<div className={css.listItemTrailing}>{renderChevron()}</div>
		</SpottableDiv>
	);

	const renderThemePreviewCards = () => (
		<div className={css.themeCardList}>
			{availableThemes.map((theme) => {
				const isSelected = theme.id === activeThemeId;
				const bg = hexToRgba(theme.colors.background);
				const surface = hexToRgba(theme.colors.surface);
				const accent = hexToRgba(theme.colors.accent);
				const progress = hexToRgba(theme.colors.rangeProgress);
				return (
					<SpottableDiv
						key={theme.id}
						className={`${css.themeCard}${isSelected ? ` ${css.themeCardSelected}` : ''}`}
						onClick={() => selectThemeById(theme.id)}
						spotlightId={`theme-card-${theme.id}`}
					>
						<div className={css.themeCardHeader}>
							<div className={css.themeCardName}>{theme.displayName}</div>
							{isSelected && <div className={css.themeCardCheck}>✓</div>}
						</div>
						{theme.description ? (
							<div className={css.themeCardDescription}>{theme.description}</div>
						) : null}
						<div
							className={css.themeCardStripe}
							style={{background: `linear-gradient(to right, ${bg}, ${surface}, ${accent}, ${progress})`}}
						/>
					</SpottableDiv>
				);
			})}
		</div>
	);

	const renderInfoItem = (id, label, value, iconName) => (
		<SpottableDiv className={css.listItem} spotlightId={`info-${id}`}>
			{renderSettingsIcon(iconName)}
			<div className={css.listItemBody}>
				<div className={css.listItemHeading}>{label}</div>
			</div>
			<div className={css.listItemValue}>{value}</div>
		</SpottableDiv>
	);

	const renderSliderItem = (settingKey, title, min, max, step, format, iconName) => (
		<div className={css.sliderContainer}>
			<div className={css.sliderLabel}>
				<div className={css.sliderTitleGroup}>
					{renderSettingsIcon(iconName)}
					<span className={css.sliderTitle}>{title}</span>
				</div>
				<span className={css.sliderValue}>{format ? format(settings[settingKey]) : settings[settingKey]}</span>
			</div>
			<Slider
				min={min}
				max={max}
				step={step}
				value={settings[settingKey]}
				onChange={(e) => updateSetting(settingKey, e.value)}
				className={css.settingsSlider}
				tooltip={false}
				spotlightId={`setting-${settingKey}`}
			/>
		</div>
	);

	// The three blocks that do not fit a plain settings row, handed to the schema so it
	// can slot them back in where they used to sit.
	const renderMoonfinStatus = () => (
		<>
			{settings.useMoonfinPlugin && moonfinStatus && <div className={css.statusMessage}>{moonfinStatus}</div>}
			{moonfinConnecting && <div className={css.authHint}>{$L('Connecting to Moonfin...')}</div>}
			{!settings.useMoonfinPlugin && (
				<div className={css.authHint}>
					{$L('Enable the Moonfin plugin to access ratings, settings sync, and {seerrLabel} proxy features. The plugin must be installed on your Jellyfin server.').replace('{seerrLabel}', seerrLabel)}
				</div>
			)}
		</>
	);

	// Renders the six slots against a sample time so the layout can be judged without
	// starting playback to find out.
	const renderPlaybackTimePreview = () => {
		const previewArgs = {
			position: (42 * 60) + 10,
			duration: (1 * 3600) + (58 * 60) + 33,
			clockDisplay: settings.clockDisplay,
			timeOffsetHours: settings.timeOffsetHours
		};
		const cell = (settingKey, align) => (
			<span className={`${css.playbackTimeCell} ${css[align]}`}>
				{formatPlaybackTimeSlot({slot: settings[settingKey], ...previewArgs})}
			</span>
		);
		const row = (keys, rowClass) => (
			<div className={`${css.playbackTimeRow} ${rowClass}`}>
				{cell(keys[0], 'playbackTimeLeft')}
				{cell(keys[1], 'playbackTimeCenter')}
				{cell(keys[2], 'playbackTimeRight')}
			</div>
		);
		return (
			<div className={css.playbackTimePreview}>
				{row(['playbackTimeAboveLeft', 'playbackTimeAboveCenter', 'playbackTimeAboveRight'], css.playbackTimeAbove)}
				<div className={css.playbackTimeBar}>
					<div className={css.playbackTimeBarFill} style={{width: `${((previewArgs.position / previewArgs.duration) * 100).toFixed(1)}%`}} />
				</div>
				{row(['playbackTimeBelowLeft', 'playbackTimeBelowCenter', 'playbackTimeBelowRight'], css.playbackTimeBelow)}
			</div>
		);
	};

	const renderAboutDataActions = () => (
		<div className={css.actionBarInline}>
			<SpottableButton
				className={`${css.actionButton} ${css.dangerButton}`}
				onClick={() => setClearDataDialogOpen(true)}
				spotlightId='clear-all-data'
			>
				{$L('Clear All Data')}
			</SpottableButton>
		</div>
	);

	const renderExternalTmdbListsView = () => {
		const enabledMap = new Map((settings.homeRows || []).map((r) => [r.id, r.enabled]));
		return (
			<ViewContainer className={css.viewContainer} spotlightId='external-tmdb-lists-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle($L('TMDB Lists'))}
						<div className={css.viewDescription}>
							{$L('Choose which TMDB chart rows appear on the home screen.')}
						</div>
						{TMDB_PRESETS.map((cfg) => (
							<SpottableDiv
								key={cfg.id}
								className={css.listItem}
								onClick={() => toggleHomeRowEnabled(cfg.id)}
								spotlightId={`tmdbrow-${cfg.id}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{cfg.title}</div>
								</div>
								<div className={css.listItemTrailing}>{renderToggle(enabledMap.get(cfg.id) === true)}</div>
							</SpottableDiv>
						))}
					</div>
				</div>
			</ViewContainer>
		);
	};

	const renderExternalCalendarsView = () => {
		const enabledMap = new Map((settings.homeRows || []).map((r) => [r.id, r.enabled]));
		const radarrOn = enabledMap.get('radarr_calendar') === true;
		const sonarrOn = enabledMap.get('sonarr_calendar') === true;
		return (
			<ViewContainer className={css.viewContainer} spotlightId='external-calendars-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle($L('Upcoming Calendars'))}
						<div className={css.viewDescription}>
							{$L('Show upcoming releases from Radarr and Sonarr. Requires the servers to be configured in Seerr.')}
						</div>
						<SpottableDiv className={css.listItem} onClick={() => toggleHomeRowEnabled('radarr_calendar')} spotlightId='calendar-radarr'>
							{renderSettingsIcon('movie')}
							<div className={css.listItemBody}>
								<div className={css.listItemHeading}>{$L('Radarr Upcoming')}</div>
								<div className={css.listItemCaption}>{$L('Upcoming movie releases')}</div>
							</div>
							<div className={css.listItemTrailing}>{renderToggle(radarrOn)}</div>
						</SpottableDiv>
						{radarrOn && renderToggleItem('radarrCalendarShowCinema', $L('Show Cinema Releases'), '', 'movie')}
						{radarrOn && renderToggleItem('radarrCalendarShowDigital', $L('Show Digital Releases'), '', 'movie')}
						{radarrOn && renderToggleItem('radarrCalendarShowPhysical', $L('Show Physical Releases'), '', 'movie')}
						{radarrOn && renderToggleItem('radarrCalendarShowDate', $L('Show Release Date'), '', 'movie')}
						<SpottableDiv className={css.listItem} onClick={() => toggleHomeRowEnabled('sonarr_calendar')} spotlightId='calendar-sonarr'>
							{renderSettingsIcon('tv')}
							<div className={css.listItemBody}>
								<div className={css.listItemHeading}>{$L('Sonarr Upcoming')}</div>
								<div className={css.listItemCaption}>{$L('Upcoming episode releases')}</div>
							</div>
							<div className={css.listItemTrailing}>{renderToggle(sonarrOn)}</div>
						</SpottableDiv>
						{sonarrOn && renderToggleItem('sonarrCalendarShowEpisodeInfo', $L('Show Episode Information'), '', 'tv')}
						{sonarrOn && renderToggleItem('sonarrCalendarShowDate', $L('Show Release Date'), '', 'tv')}
						{radarrOn && sonarrOn &&
							renderToggleItem('mergeRadarrSonarrCalendars', $L('Merge Into One Row'), $L('Combine Radarr and Sonarr into a single upcoming row'), 'list')}
					</div>
				</div>
			</ViewContainer>
		);
	};

	const getSourceLabel = (source) => {
		if (source === 'tmdb') return $L('TMDB');
		if (source === 'mdblist') return $L('MDBList');
		if (source === 'letterboxd') return $L('Letterboxd');
		if (source === 'imdb') return $L('IMDb');
		return source;
	};

	const addCustomRow = async () => {
		setCustomRowError('');
		const detected = detectCustomSource(customRowUrl);
		if (detected.error) {
			setCustomRowError(detected.error);
			return;
		}
		const row = {
			id: `custom_${Date.now()}`,
			name: customRowName.trim() || detected.params.id || detected.params.listname || detected.params.user || $L('Custom List'),
			source: detected.source,
			type: detected.type,
			params: detected.params,
			enabled: true
		};
		setCustomRowSaving(true);
		const result = await validateCustomRow(row);
		setCustomRowSaving(false);
		if (result.error) {
			setCustomRowError(result.error);
			return;
		}
		updateSetting('customHomeRows', [...(settings.customHomeRows || []), row]);
		setCustomRowUrl('');
		setCustomRowName('');
	};

	const deleteCustomRow = (id) => {
		updateSetting('customHomeRows', (settings.customHomeRows || []).filter((r) => r.id !== id));
	};

	const toggleCustomRow = (id) => {
		updateSetting('customHomeRows', (settings.customHomeRows || []).map((r) => (r.id === id ? {...r, enabled: !r.enabled} : r)));
	};

	const renderExternalCustomRowsView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='external-custom-rows-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Custom Home Rows'))}
					<div className={css.viewDescription}>
						{$L('Add a home row from a TMDB list or collection, an MDBList list, or a Letterboxd profile by pasting its URL.')}
					</div>
					{(settings.customHomeRows || []).map((row) => (
						<div key={row.id} className={css.listItem}>
							<SpottableDiv
								className={css.listItemBody}
								onClick={() => toggleCustomRow(row.id)}
								spotlightId={`customrow-${row.id}`}
							>
								<div className={css.listItemHeading}>{row.name}</div>
								<div className={css.listItemCaption}>{getSourceLabel(row.source)}</div>
							</SpottableDiv>
							<div className={css.listItemTrailing}>{renderToggle(row.enabled === true)}</div>
							<SpottableDiv
								className={css.listItem}
								onClick={() => deleteCustomRow(row.id)}
								spotlightId={`customrow-del-${row.id}`}
							>
								<div className={css.listItemHeading}>{$L('Delete')}</div>
							</SpottableDiv>
						</div>
					))}
					<div className={css.inputGroup}>
						<label>{$L('List URL')}</label>
						<SpottableInput
							className={css.input}
							type='text'
							value={customRowUrl}
							onChange={(e) => { setCustomRowUrl(e.target.value); setCustomRowError(''); }}
							placeholder={$L('Paste a TMDB, MDBList, or Letterboxd URL')}
							spotlightId='custom-row-url-input'
						/>
					</div>
					<div className={css.inputGroup}>
						<label>{$L('Row Name (optional)')}</label>
						<SpottableInput
							className={css.input}
							type='text'
							value={customRowName}
							onChange={(e) => setCustomRowName(e.target.value)}
							placeholder={$L('Home row title')}
							spotlightId='custom-row-name-input'
						/>
					</div>
					{customRowError && <div className={css.viewDescription}>{customRowError}</div>}
					<SpottableDiv
						className={css.listItem}
						onClick={customRowSaving ? undefined : addCustomRow}
						spotlightId='custom-row-add'
					>
						<div className={css.listItemHeading}>{customRowSaving ? $L('Checking...') : $L('Add Row')}</div>
					</SpottableDiv>
				</div>
			</div>
		</ViewContainer>
	);

	const renderPluginSeerr = () => ( // eslint-disable-line no-unused-vars
		<>
			{!settings.useMoonfinPlugin && (
				<div className={css.authHint}>
					{$L('Enable the Moonfin plugin first to sign in to {seerrLabel}.').replace('{seerrLabel}', seerrLabel)}
				</div>
			)}
			{settings.useMoonfinPlugin && seerr.pluginInfo?.seerrEnabled === false && (
				<div className={css.authHint}>
					{$L('{seerrLabel} is disabled by your server administrator.').replace('{seerrLabel}', seerrLabel)}
				</div>
			)}
			{settings.useMoonfinPlugin && seerr.pluginInfo?.seerrEnabled !== false && seerr.isEnabled && seerr.isAuthenticated && seerr.isMoonfin && (
				<>
					{renderInfoItem('seerrConnStatus', $L('Status'), $L('Connected via Moonfin'))}
					{renderInfoItem('seerrAuthType', $L('Sign-In Method'), seerrAuthType === 'local' ? $L('Local Account') : $L('Jellyfin Account'))}
					{seerr.serverUrl && renderInfoItem('seerrUrl', $L('{seerrLabel} URL').replace('{seerrLabel}', seerrLabel), seerr.serverUrl)}
					{seerr.user && renderInfoItem('seerrUser', $L('User'), seerr.user.displayName || $L('Moonfin User'))}
					<div className={css.actionBarInline}>
						<SpottableButton
							className={`${css.actionButton} ${css.dangerButton}`}
							onClick={handleSeerrLogout}
							disabled={seerrAuthSubmitting}
							spotlightId='seerr-signout'
						>
							{seerrAuthSubmitting ? $L('Signing Out...') : $L('Sign Out')}
						</SpottableButton>
					</div>
				</>
			)}
			{settings.useMoonfinPlugin && seerr.pluginInfo?.seerrEnabled !== false && (!seerr.isEnabled || !seerr.isAuthenticated || !seerr.isMoonfin) && (
				<>
					<div className={css.viewDescription}>
						{$L('Sign in directly through the Moonfin plugin. No app backend is required.')}
					</div>
					<SpottableDiv
						className={`${css.listItem} ${seerrAuthType === 'jellyfin' ? css.listItemSelected : ''}`}
						onClick={() => handleSeerrAuthTypeChange('jellyfin')}
						spotlightId='seerr-auth-jellyfin'
					>
						<div className={css.listItemBody}>
							<div className={css.listItemHeading}>{$L('Jellyfin Account')}</div>
							<div className={css.listItemCaption}>{$L('Use your Jellyfin username and password')}</div>
						</div>
						<div className={css.listItemTrailing}>{renderRadio(seerrAuthType === 'jellyfin')}</div>
					</SpottableDiv>
					<SpottableDiv
						className={`${css.listItem} ${seerrAuthType === 'local' ? css.listItemSelected : ''}`}
						onClick={() => handleSeerrAuthTypeChange('local')}
						spotlightId='seerr-auth-local'
					>
						<div className={css.listItemBody}>
							<div className={css.listItemHeading}>{$L('Local Account')}</div>
							<div className={css.listItemCaption}>{$L('Use your local {seerrLabel} account credentials').replace('{seerrLabel}', seerrLabel)}</div>
						</div>
						<div className={css.listItemTrailing}>{renderRadio(seerrAuthType === 'local')}</div>
					</SpottableDiv>

					<div className={css.inputGroup}>
						<label>{$L('Username / Email')}</label>
						<SpottableInput
							className={css.input}
							type='text'
							value={seerrUsername}
							onChange={(e) => onSeerrUsernameChange(e.target.value)}
							placeholder={seerrAuthType === 'local' ? $L('Local username or email') : $L('Jellyfin username')}
							autoComplete='username'
							disabled={seerrAuthSubmitting}
							spotlightId='seerr-username-input'
						/>
					</div>

					<div className={css.inputGroup}>
						<label>{$L('Password')}</label>
						<SpottableInput
							className={css.input}
							type='password'
							value={seerrPassword}
							onChange={(e) => onSeerrPasswordChange(e.target.value)}
							onKeyDown={handleSeerrPasswordKeyDown}
							autoComplete='current-password'
							disabled={seerrAuthSubmitting}
							spotlightId='seerr-password-input'
						/>
					</div>

					<div className={css.actionBarInline}>
						<SpottableButton
							className={css.actionButton}
							onClick={handleSeerrLogin}
							disabled={seerrAuthSubmitting || !seerrUsername.trim()}
							spotlightId='seerr-signin'
						>
							{seerrAuthSubmitting ? $L('Signing In...') : $L('Sign In')}
						</SpottableButton>
					</div>
				</>
			)}
			{seerrAuthMessage && <div className={css.statusMessage}>{seerrAuthMessage}</div>}
			{seerrAuthError && <div className={`${css.statusMessage} ${css.statusError}`}>{seerrAuthError}</div>}
		</>
	);

	const handleClearAllData = useCallback(async () => {
		setClearDataDialogOpen(false);
		resetSettings();
		await clearAllStorage();
		await logoutAll();
	}, [resetSettings, logoutAll]);

	const settingsCtx = useMemo(() => ({
		settings,
		capabilities,
		seerr,
		seerrLabel,
		isSeerr,
		isWebOS: isWebOS(),
		serverUrl,
		serverVersion,
		availableThemes,
		activeThemeId,
		actions: {
			openThemes,
			openThemeStore,
			openHomeRows,
			openDetailButtons,
			openOsdButtons,
			openDiagnostics,
			openPinCode,
			openLibraries,
			openRatingSources,
			openExcludedGenres,
			openMediaBarLibraries,
			openMediaBarCollections,
			openImdbLists,
			openExternalTmdbLists,
			openExternalCalendars,
			openExternalCustomRows,
			openSeerrHomeRows,
			handleMoonfinToggle
		}
	}), [
		settings, capabilities, seerr, seerrLabel, isSeerr, serverUrl,
		serverVersion, availableThemes, activeThemeId, openThemes, openThemeStore, openHomeRows,
		openDetailButtons, openOsdButtons, openDiagnostics,
		openPinCode, openLibraries, openRatingSources, openExcludedGenres, openMediaBarLibraries,
		openMediaBarCollections, openImdbLists, openExternalTmdbLists, openExternalCalendars,
		openExternalCustomRows, openSeerrHomeRows, handleMoonfinToggle
	]);

	// Kept out of settingsCtx because the search index has no use for them and they are
	// rebuilt every render, which would defeat the memo above.
	const customRenderers = {
		moonfinStatus: renderMoonfinStatus,
		seerrPanel: renderPluginSeerr,
		aboutDataActions: renderAboutDataActions,
		playbackTimePreview: renderPlaybackTimePreview
	};

	// Only the debounced query drives the swap, so the categories do not blink out
	// between the second keystroke and the debounce landing.
	const showSearchResults = currentView.view === 'categories' &&
		debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

	const searchResults = useMemo(() => {
		if (!showSearchResults) return [];
		const index = buildSettingsIndex(SETTINGS_SCHEMA, settingsCtx, {resolve, spotlightIdOf});
		return matchSettings(index, debouncedQuery);
	}, [showSearchResults, debouncedQuery, settingsCtx]);

	searchResultsRef.current = searchResults;
	searchQueryRef.current = searchQuery;

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(searchQuery), 200);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	const handleSearchChange = useCallback((e) => {
		setSearchQuery(e.target.value);
	}, []);

	const handleSearchKeyDown = useCallback((e) => {
		// SpottableInput only forwards keys while the field is not being typed into, so
		// this is the not-typing case and Down should enter the results.
		if (e.keyCode === 40 && searchResultsRef.current.length > 0) {
			e.preventDefault();
			Spotlight.focus(`settings-result-${searchResultsRef.current[0].id}`);
		}
	}, []);

	const handleResultKeyDown = useCallback((e) => {
		if (e.keyCode !== 38) return;
		if (parseInt(e.currentTarget.dataset.resultIndex, 10) !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		Spotlight.focus('settings-search-input');
	}, []);

	const renderDescriptorRow = (row, ctx, index) => {
		if (row.when && !row.when(ctx)) return null;
		const text = (value) => resolve(value, ctx);
		switch (row.kind) {
			case KIND.SECTION:
				return <Fragment key={`section-${row.id}`}>{renderSectionTitle(text(row.label))}</Fragment>;
			case KIND.DIVIDER:
				return <div key={`divider-${row.id || index}`} className={css.divider} />;
			case KIND.TEXT:
				return <div key={`text-${row.id}`} className={css.viewDescription}>{text(row.text)}</div>;
			case KIND.TOGGLE:
				return (
					<Fragment key={row.key}>
						{renderToggleItem(row.key, text(row.label), text(row.desc), text(row.icon), row.onToggle && (() => row.onToggle(ctx)))}
					</Fragment>
				);
			case KIND.OPTION:
				return (
					<Fragment key={row.key}>
						{renderOptionItem(row.key, text(row.label), row.options(ctx), text(row.fallback), text(row.icon))}
					</Fragment>
				);
			case KIND.SLIDER:
				return (
					<Fragment key={row.key}>
						{renderSliderItem(row.key, text(row.label), row.min, row.max, row.step, row.format, text(row.icon))}
					</Fragment>
				);
			case KIND.NAV:
				return (
					<Fragment key={row.id}>
						{renderNavItem(row.id, text(row.label), text(row.desc), () => row.action(ctx), text(row.icon))}
					</Fragment>
				);
			case KIND.INFO:
				return (
					<Fragment key={row.id}>
						{renderInfoItem(row.id, text(row.label), text(row.value), text(row.icon))}
					</Fragment>
				);
			case KIND.CUSTOM:
				return <Fragment key={`custom-${row.render}`}>{customRenderers[row.render]?.()}</Fragment>;
			default:
				return null;
		}
	};

	const getSubcategories = (catId) => {
		const category = SETTINGS_SCHEMA.find((c) => c.id === catId);
		if (!category) return [];
		return category.subcategories
			.filter((sub) => !sub.when || sub.when(settingsCtx))
			.map((sub) => ({
				id: sub.id,
				label: resolve(sub.label, settingsCtx),
				description: resolve(sub.description, settingsCtx)
			}));
	};

	const getSubcategoryContent = (categoryId, subcategoryId) => {
		const screen = SCHEMA_BY_KEY[`${categoryId}.${subcategoryId}`];
		if (!screen) return null;
		return screen.rows.map((row, index) => renderDescriptorRow(row, settingsCtx, index));
	};

	const openSearchResult = (entry) => {
		// The focus effect consumes this before it falls back to a per-view default, which
		// is what lands the highlight on the exact row rather than the top of the screen.
		if (entry.spotlightId) pendingFocusRef.current = entry.spotlightId;
		pushView({
			view: 'subcategory',
			categoryId: entry.categoryId,
			subcategoryId: entry.subcategoryId,
			label: entry.subcategoryLabel,
			returnFocusTo: `settings-result-${entry.id}`
		});
	};

	const renderResultItem = (entry, index) => (
		<SpottableDiv
			key={entry.id}
			className={css.listItem}
			data-result-index={index}
			onClick={() => openSearchResult(entry)}
			onKeyDown={handleResultKeyDown}
			spotlightId={`settings-result-${entry.id}`}
		>
			{renderSettingsIcon(entry.icon)}
			<div className={css.listItemBody}>
				<div className={css.listItemHeading}>{entry.title}</div>
				<div className={css.listItemCaption}>{entry.breadcrumb}</div>
			</div>
			<div className={css.listItemTrailing}>{renderChevron()}</div>
		</SpottableDiv>
	);

	const renderCategoriesView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='categories-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Settings'))}
					<SpottableInput
						className={css.searchInput}
						type='text'
						value={searchQuery}
						onChange={handleSearchChange}
						onKeyDown={handleSearchKeyDown}
						placeholder={$L('Search settings')}
						spotlightId='settings-search-input'
						autoComplete='off'
					/>
					{showSearchResults
						? (searchResults.length > 0
							? searchResults.map(renderResultItem)
							: <div className={css.viewDescription}>{$L('No settings found')}</div>)
						: categories.map((cat) => (
							<SpottableDiv
								key={cat.id}
								className={css.listItem}
								onClick={() => pushView({ view: 'category', id: cat.id, returnFocusTo: `cat-${cat.id}` })}
								spotlightId={`cat-${cat.id}`}
							>
								<div className={css.listItemIcon}>
									<cat.Icon />
								</div>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{cat.label}</div>
									<div className={css.listItemCaption}>{cat.description}</div>
								</div>
								<div className={css.listItemTrailing}>{renderChevron()}</div>
							</SpottableDiv>
						))}
				</div>
			</div>
		</ViewContainer>
	);

	const renderCategoryView = () => {
		const catId = currentView.id;
		const cat = categories.find((c) => c.id === catId);
		const subcats = getSubcategories(catId);
		return (
			<ViewContainer className={css.viewContainer} spotlightId='category-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle(cat?.label || $L('Settings'))}
						{subcats.map((sub) => (
							<SpottableDiv
								key={sub.id}
								className={css.listItem}
								onClick={() =>
									pushView({
										view: 'subcategory',
										categoryId: catId,
										subcategoryId: sub.id,
										label: sub.label,
										returnFocusTo: `subcat-${sub.id}`
									})
								}
								spotlightId={`subcat-${sub.id}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{sub.label}</div>
									{sub.description && <div className={css.listItemCaption}>{sub.description}</div>}
								</div>
								<div className={css.listItemTrailing}>{renderChevron()}</div>
							</SpottableDiv>
						))}
					</div>
				</div>
			</ViewContainer>
		);
	};

	const renderOptionsView = () => {
		const { title, options, settingKey } = currentView;
		const currentValue = settingKey === '__themeSelection' ? activeThemeId : settings[settingKey];
		return (
			<ViewContainer className={css.viewContainer} spotlightId='options-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle(title)}
						{options.map((opt, idx) => (
							<SpottableDiv
								key={String(opt.value)}
								className={`${css.listItem} ${opt.value === currentValue ? css.listItemSelected : ''}`}
								onClick={() => handleOptionSelect(settingKey, opt.value)}
								spotlightId={`opt-${idx}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{opt.label}</div>
								</div>
								<div className={css.listItemTrailing}>{renderRadio(opt.value === currentValue)}</div>
							</SpottableDiv>
						))}
					</div>
				</div>
			</ViewContainer>
		);
	};

	const renderSubcategoryView = () => {
		const { categoryId, subcategoryId, label } = currentView;
		return (
			<ViewContainer className={css.viewContainer} spotlightId='subcategory-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle(label || $L('Settings'))}
						{getSubcategoryContent(categoryId, subcategoryId)}
					</div>
				</div>
			</ViewContainer>
		);
	};

	const renderThemesView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='themes-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Theme'))}
					{renderThemePreviewCards()}
				</div>
			</div>
		</ViewContainer>
	);

	const renderThemeStoreView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='theme-store-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Theme Store'))}
					{themeStoreLoading ? (
						<div className={css.themeStoreMessage}>{$L('Loading themes…')}</div>
					) : themeStoreError ? (
						<div className={css.themeStoreMessage}>{$L('Couldn’t load the Theme Store. Check your connection and try again.')}</div>
					) : themeStoreCatalog.length === 0 ? (
						<div className={css.themeStoreMessage}>{$L('No themes are available right now.')}</div>
					) : (
						<div className={css.themeCardList}>
							{themeStoreCatalog.map((entry) => {
								const saved = availableThemes.some((t) => t.id === entry.id);
								const busy = themeStoreBusyId === entry.id;
								return (
									<SpottableDiv
										key={entry.id}
										className={css.themeCard}
										onClick={() => handleStoreThemeClick(entry)}
										spotlightId={`store-theme-${entry.id}`}
									>
										<div className={css.themeCardHeader}>
											<div className={css.themeCardName}>{entry.displayName}</div>
											{saved && <div className={css.themeCardCheck}>✓</div>}
										</div>
										{entry.description ? (
											<div className={css.themeCardDescription}>{entry.description}</div>
										) : null}
										<div className={css.themeStoreCardAction}>
											{busy ? $L('Working…') : saved ? $L('Remove') : $L('Save & apply')}
										</div>
									</SpottableDiv>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</ViewContainer>
	);

	const renderSeerrHomeRowsView = () => {
		const enabledMap = new Map((settings.homeRows || []).map((r) => [r.id, r.enabled]));
		return (
			<ViewContainer className={css.viewContainer} spotlightId='seerr-home-rows-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle(`${seerrLabel} ${$L('Home Rows')}`)}
						<div className={css.viewDescription}>
							{$L('Choose which Seerr discover rows appear on the home screen.')}
						</div>
						{getSeerrHomeRowConfigs().map((cfg) => (
							<SpottableDiv
								key={cfg.id}
								className={css.listItem}
								onClick={() => toggleSeerrHomeRow(cfg.id)}
								spotlightId={`seerrrow-${cfg.id}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{cfg.title}</div>
								</div>
								<div className={css.listItemTrailing}>{renderToggle(enabledMap.get(SEERR_CONFIG_TO_SECTION[cfg.id]) === true)}</div>
							</SpottableDiv>
						))}
					</div>
				</div>
			</ViewContainer>
		);
	};

	const renderImdbListsView = () => {
		const configs = [
			{ id: 'imdbTop250MoviesEnabled', rowId: 'imdb-top250-movies', title: $L('IMDb Top 250 Movies') },
			{ id: 'imdbTop250TvShowsEnabled', rowId: 'imdb-top250-tv', title: $L('IMDb Top 250 TV Shows') },
			{ id: 'imdbMostPopularMoviesEnabled', rowId: 'imdb-popular-movies', title: $L('IMDb Most Popular Movies') },
			{ id: 'imdbMostPopularTvShowsEnabled', rowId: 'imdb-popular-tv', title: $L('IMDb Most Popular TV Shows') },
			{ id: 'imdbLowestRatedMoviesEnabled', rowId: 'imdb-lowest-rated', title: $L('IMDb Lowest Rated Movies') },
			{ id: 'imdbTopEnglishMoviesEnabled', rowId: 'imdb-top-english', title: $L('IMDb Top Rated English Movies') }
		];

		const toggleImdbList = (settingKey, rowId) => {
			const nextValue = !settings[settingKey];
			const updatedHomeRows = (settings.homeRows || []).map((row) =>
				row.id === rowId ? { ...row, enabled: nextValue } : row
			);
			updateSettings({
				[settingKey]: nextValue,
				homeRows: updatedHomeRows
			});
		};

		return (
			<ViewContainer className={css.viewContainer} spotlightId='imdb-lists-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle($L('IMDb Lists'))}
						<div className={css.viewDescription}>
							{$L('Choose which IMDb lists are active. Activating a list adds it to your Home Sections.')}
						</div>
						{configs.map((cfg) => (
							<SpottableDiv
								key={cfg.id}
								className={css.listItem}
								onClick={() => toggleImdbList(cfg.id, cfg.rowId)}
								spotlightId={`imdblist-${cfg.id}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{cfg.title}</div>
								</div>
								<div className={css.listItemTrailing}>{renderToggle(settings[cfg.id] === true)}</div>
							</SpottableDiv>
						))}
					</div>
				</div>
			</ViewContainer>
		);
	};

	const renderHomeRowsView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='homerows-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Configure Home Rows'))}
					<div className={css.viewDescription}>
						{$L('Enable/disable and reorder the rows that appear on your home screen.')}
					</div>
					{renderOptionItem('homeRowsStyle', $L('Rows Type'), getHomeRowsStyleOptions(), $L('Modern'), 'appscontents')}
					{tempHomeRows.filter((row) => isHomeRowVisibleByGates(row.id, settings)).map((row, index, visibleRows) => (
						<div key={row.id} className={css.homeRowItem}>
							<SpottableDiv
								className={css.listItem}
								onClick={() => toggleHomeRow(row.id)}
								spotlightId={`homerow-${row.id}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{$L(row.name)}</div>
								</div>
								<div className={css.listItemTrailing}>{renderToggle(row.enabled)}</div>
							</SpottableDiv>
							<div className={css.homeRowControls}>
								<Button
									onClick={() => moveHomeRowUp(row.id)}
									disabled={index === 0}
									size='small'
									aria-label={$L('Up')}
									spotlightId={`homerow-up-${row.id}`}
								>
									<IconArrowUp />
								</Button>
								<Button
									onClick={() => moveHomeRowDown(row.id)}
									disabled={index === visibleRows.length - 1}
									size='small'
									aria-label={$L('Down')}
									spotlightId={`homerow-down-${row.id}`}
								>
									<IconArrowDown />
								</Button>
							</div>
						</div>
					))}
					{tempPluginSections.length > 0 && (
						<>
							{renderSectionTitle($L('Plugin Sections'))}
							{tempPluginSections.slice(0, pluginSectionRenderLimit).map((section, index) => (
								<div key={section.id} className={css.homeRowItem}>
									<SpottableDiv
										className={css.listItem}
										onClick={() => togglePluginSection(section.id)}
										spotlightId={`pluginrow-${section.id}`}
									>
										<div className={css.listItemBody}>
											<div className={css.listItemHeading}>{section.name}</div>
											<div className={css.listItemCaption}>{getPluginSectionSourceLabel(section.source)}</div>
										</div>
										<div className={css.listItemTrailing}>{renderToggle(section.enabled)}</div>
									</SpottableDiv>
									<div className={css.homeRowControls}>
										<Button
											onClick={() => movePluginSectionUp(section.id)}
											disabled={index === 0}
											size='small'
											aria-label={$L('Up')}
											spotlightId={`pluginrow-up-${section.id}`}
										>
											<IconArrowUp />
										</Button>
										<Button
											onClick={() => movePluginSectionDown(section.id)}
											disabled={index === tempPluginSections.length - 1}
											size='small'
											aria-label={$L('Down')}
											spotlightId={`pluginrow-down-${section.id}`}
										>
											<IconArrowDown />
										</Button>
									</div>
								</div>
							))}
							{tempPluginSections.length > pluginSectionRenderLimit && (
								<div className={css.actionBar}>
									<Button
										onClick={() => setPluginSectionRenderLimit((prev) => Math.min(tempPluginSections.length, prev + PLUGIN_SECTION_RENDER_STEP))}
										size='small'
										spotlightId='pluginrow-show-more'
									>
										{$L('Show More')} ({tempPluginSections.length - pluginSectionRenderLimit})
									</Button>
								</div>
							)}
						</>
					)}
					<div className={css.actionBar}>
						<Button onClick={resetHomeRows} size='small' spotlightId='homerow-reset'>
							{$L('Reset to Default')}
						</Button>
						<Button onClick={saveHomeRows} size='small' spotlightId='homerow-save'>
							{$L('Save')}
						</Button>
					</div>
				</div>
			</div>
		</ViewContainer>
	);

	const renderDiagnosticsView = () => {
		const entries = logEntries
			.filter((entry) => logFilter === 'all' || entry.category === logFilter)
			.reverse();
		const shown = entries.slice(0, logRenderLimit);

		return (
			<ViewContainer className={css.viewContainer} spotlightId='diagnostics-view'>
				<div className={css.listContent} onFocus={handleListFocus}>
					<div className={css.listInner}>
						{renderSectionTitle($L('Logs'))}
						<div className={css.viewDescription}>
							{$L('Server requests recorded on this device. Video and image traffic is not included.')}
						</div>
						{logMessage && <div className={css.statusMessage}>{logMessage}</div>}
						<div className={css.actionBar}>
							{LOG_FILTERS.map((filter) => (
								<Button
									key={filter.id}
									onClick={() => setLogFilter(filter.id)}
									size='small'
									selected={logFilter === filter.id}
									spotlightId={`logfilter-${filter.id}`}
								>
									{$L(filter.label)}
								</Button>
							))}
						</div>
						{entries.length === 0 && (
							<div className={css.viewDescription}>
								{settings.diagnosticLoggingEnabled
									? $L('Nothing recorded yet.')
									: $L('Turn on Diagnostic Logging to start recording.')}
							</div>
						)}
						{shown.map((entry, index) => (
							<div key={`${entry.timestamp}-${index}`} className={css.listItem}>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading} style={{color: logLevelColor(entry.level)}}>
										{entry.message}
									</div>
									<div className={css.listItemCaption}>
										{`${entry.timestamp.slice(11, 23)}  ${entry.category}`}
									</div>
								</div>
							</div>
						))}
						{entries.length > logRenderLimit && (
							<div className={css.actionBar}>
								<Button
									onClick={() => setLogRenderLimit((prev) => prev + LOG_RENDER_STEP)}
									size='small'
									spotlightId='log-show-more'
								>
									{$L('Show More')} ({entries.length - logRenderLimit})
								</Button>
							</div>
						)}
						<div className={css.actionBar}>
							<Button onClick={handleClearLogs} size='small' spotlightId='log-clear'>
								{$L('Clear')}
							</Button>
							<Button onClick={handleSendReport} size='small' disabled={sendingReport} spotlightId='log-send'>
								{sendingReport ? $L('Sending...') : $L('Send Report')}
							</Button>
						</div>
					</div>
				</div>
			</ViewContainer>
		);
	};

	const renderButtonLayoutView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='button-layout-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle(buttonLayoutKind === 'osd' ? $L('Player Buttons') : $L('Details Buttons'))}
					<div className={css.viewDescription}>
						{buttonLayoutKind === 'osd'
							? $L('Enable/disable and reorder the buttons around the playback controls.')
							: $L('Enable/disable and reorder the buttons on the details screen action row.')}
					</div>
					{tempButtons.map((btn, index) => (
						<div key={btn.id} className={css.homeRowItem}>
							<SpottableDiv
								className={css.listItem}
								onClick={() => toggleLayoutButton(btn.id)}
								spotlightId={`layoutbtn-${btn.id}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{$L(btn.label)}</div>
								</div>
								<div className={css.listItemTrailing}>{renderToggle(btn.enabled)}</div>
							</SpottableDiv>
							<div className={css.homeRowControls}>
								<Button
									onClick={() => moveLayoutButton(btn.id, -1)}
									disabled={index === 0}
									size='small'
									aria-label={$L('Up')}
									spotlightId={`layoutbtn-up-${btn.id}`}
								>
									<IconArrowUp />
								</Button>
								<Button
									onClick={() => moveLayoutButton(btn.id, 1)}
									disabled={index === tempButtons.length - 1}
									size='small'
									aria-label={$L('Down')}
									spotlightId={`layoutbtn-down-${btn.id}`}
								>
									<IconArrowDown />
								</Button>
							</div>
						</div>
					))}
					<div className={css.actionBar}>
						<Button onClick={resetButtonLayout} size='small' spotlightId='layoutbtn-reset'>
							{$L('Reset to Default')}
						</Button>
						<Button onClick={saveButtonLayout} size='small' spotlightId='layoutbtn-save'>
							{$L('Save')}
						</Button>
					</div>
				</div>
			</div>
		</ViewContainer>
	);

	const renderRatingSourcesView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='rating-sources-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Enabled Rating Sources'))}
					<div className={css.viewDescription}>
						{$L('Choose which rating sources are shown in ratings rows.')}
					</div>
					{getRatingSourceOptions().map((option) => {
						const isEnabled = tempRatingSources.includes(option.value);
						return (
							<SpottableDiv
								key={option.value}
								className={css.listItem}
								onClick={() => toggleRatingSource(option.value)}
								spotlightId={`rating-source-${option.value}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{option.label}</div>
								</div>
								<div className={css.listItemTrailing}>{renderToggle(isEnabled)}</div>
							</SpottableDiv>
						);
					})}
					<div className={css.actionBar}>
						<Button onClick={popView} size='small' spotlightId='rating-sources-cancel'>
							{$L('Cancel')}
						</Button>
						<Button onClick={saveRatingSources} size='small' spotlightId='rating-sources-save'>
							{$L('Save')}
						</Button>
					</div>
				</div>
			</div>
		</ViewContainer>
	);

	const renderExcludedGenresView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='excluded-genres-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Excluded Genres'))}
					<div className={css.viewDescription}>
						{$L('Enter a comma-separated list of genre names to hide from the featured media bar.')}
					</div>
					<div className={css.inputGroup}>
						<label>{$L('Genres')}</label>
						<SpottableInput
							className={css.input}
							type='text'
							value={tempExcludedGenresText}
							onChange={(e) => setTempExcludedGenresText(e.target.value)}
							placeholder={$L('Example: horror, reality, documentary')}
							spotlightId='excluded-genres-input'
						/>
					</div>
					<div className={css.actionBar}>
						<Button onClick={popView} size='small' spotlightId='excluded-genres-cancel'>
							{$L('Cancel')}
						</Button>
						<Button onClick={saveExcludedGenres} size='small' spotlightId='excluded-genres-save'>
							{$L('Save')}
						</Button>
					</div>
				</div>
			</div>
		</ViewContainer>
	);

	const renderPinCodeView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='pin-code-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Set PIN Code'))}
					<div className={css.viewDescription}>
						{$L('Enter a 4-digit PIN used to unlock the app when PIN protection is enabled.')}
					</div>
					<div className={css.inputGroup}>
						<label>{$L('PIN')}</label>
						<SpottableInput
							className={css.input}
							type='password'
							value={tempPinCode}
							onChange={(e) => {
								const next = String(e.target.value || '').replace(/\D/g, '').slice(0, 4);
								setTempPinCode(next);
								setPinCodeError('');
							}}
							placeholder={$L('4 digits')}
							maxLength={4}
							spotlightId='pin-code-input'
						/>
					</div>
					{pinCodeError && <div className={`${css.statusMessage} ${css.statusError}`}>{pinCodeError}</div>}
					<div className={css.actionBar}>
						<Button onClick={popView} size='small' spotlightId='pin-code-cancel'>
							{$L('Cancel')}
						</Button>
						<Button onClick={savePinCode} size='small' spotlightId='pin-code-save'>
							{$L('Save')}
						</Button>
					</div>
				</div>
			</div>
		</ViewContainer>
	);

	const isUnifiedModal = settings.unifiedLibraryMode && hasMultipleServers;

	const renderLibrariesView = () => (
		<ViewContainer className={css.viewContainer} spotlightId='libraries-view'>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle($L('Hide Libraries'))}
					<div className={css.viewDescription}>
						{$L('Hidden libraries are removed from all Jellyfin clients. This is a server-level setting.')}
					</div>
					{libraryLoading ? (
						<div className={css.loadingMessage}>{$L('Loading libraries...')}</div>
					) : (
						allLibraries.map((lib) => {
							const isHidden = hiddenLibraries.includes(lib.Id);
							return (
								<SpottableDiv
									key={`${lib._serverUrl || 'local'}-${lib.Id}`}
									className={css.listItem}
									onClick={() => toggleLibraryVisibility(lib.Id)}
									spotlightId={`lib-${lib.Id}`}
								>
									<div className={css.listItemBody}>
										<div className={css.listItemHeading}>
											{lib.Name}
											{isUnifiedModal && lib._serverName ? ` (${lib._serverName})` : ''}
										</div>
										<div className={css.listItemCaption}>{isHidden ? $L('Hidden') : $L('Visible')}</div>
									</div>
									<div className={css.listItemTrailing}>{renderToggle(!isHidden)}</div>
								</SpottableDiv>
							);
						})
					)}
					{!libraryLoading && (
						<div className={css.actionBar}>
							<Button onClick={popView} size='small' spotlightId='lib-cancel'>
								{$L('Cancel')}
							</Button>
							<Button onClick={saveLibraryVisibility} size='small' disabled={librarySaving} spotlightId='lib-save'>
								{librarySaving ? $L('Saving...') : $L('Save')}
							</Button>
						</div>
					)}
				</div>
			</div>
		</ViewContainer>
	);

	const renderMediaBarSourceView = ({
		viewSpotlightId,
		title,
		description,
		loadingLabel,
		items,
		itemIdKey,
		itemNameKey,
		selectedIds,
		toggleSelection,
		cancelSpotlightId,
		saveSpotlightId,
		onSave,
		itemSpotlightPrefix
	}) => (
		<ViewContainer className={css.viewContainer} spotlightId={viewSpotlightId}>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{renderSectionTitle(title)}
					<div className={css.viewDescription}>{description}</div>
					{mediaBarSourcesLoading ? (
						<div className={css.loadingMessage}>{loadingLabel}</div>
					) : (
						items.map((item) => {
							const itemId = item[itemIdKey];
							const itemName = item[itemNameKey];
							const isSelected = selectedIds.includes(itemId);
							return (
								<SpottableDiv
									key={itemId}
									className={css.listItem}
									onClick={() => toggleSelection(itemId)}
									spotlightId={`${itemSpotlightPrefix}-${itemId}`}
								>
									<div className={css.listItemBody}>
										<div className={css.listItemHeading}>{itemName}</div>
									</div>
									<div className={css.listItemTrailing}>{renderToggle(isSelected)}</div>
								</SpottableDiv>
							);
						})
					)}
					{!mediaBarSourcesLoading && (
						<div className={css.actionBar}>
							<Button onClick={popView} size='small' spotlightId={cancelSpotlightId}>
								{$L('Cancel')}
							</Button>
							<Button onClick={onSave} size='small' spotlightId={saveSpotlightId}>
								{$L('Save')}
							</Button>
						</div>
					)}
				</div>
			</div>
		</ViewContainer>
	);

	const renderMediaBarLibrariesView = () => (
		renderMediaBarSourceView({
			viewSpotlightId: 'media-bar-libraries-view',
			title: $L('Media Bar Source Libraries'),
			description: $L('Choose which libraries are used for featured media when source type is Libraries.'),
			loadingLabel: $L('Loading libraries...'),
			items: mediaBarLibraries,
			itemIdKey: 'Id',
			itemNameKey: 'Name',
			selectedIds: tempMediaBarLibraryIds,
			toggleSelection: toggleMediaBarLibrary,
			cancelSpotlightId: 'media-bar-lib-cancel',
			saveSpotlightId: 'media-bar-lib-save',
			onSave: saveMediaBarLibraries,
			itemSpotlightPrefix: 'media-bar-lib'
		})
	);

	const renderMediaBarCollectionsView = () => (
		renderMediaBarSourceView({
			viewSpotlightId: 'media-bar-collections-view',
			title: $L('Media Bar Source Collections'),
			description: $L('Choose which collections are used for featured media when source type is Collections.'),
			loadingLabel: $L('Loading collections...'),
			items: mediaBarCollections,
			itemIdKey: 'Id',
			itemNameKey: 'Name',
			selectedIds: tempMediaBarCollectionIds,
			toggleSelection: toggleMediaBarCollection,
			cancelSpotlightId: 'media-bar-collection-cancel',
			saveSpotlightId: 'media-bar-collection-save',
			onSave: saveMediaBarCollections,
			itemSpotlightPrefix: 'media-bar-collection'
		})
	);
	/* eslint-enable react/jsx-no-bind */

	return (
		<div className={`${css.page}${panelMode ? ` ${css.pagePanel}` : ''}`}>
			{currentView.view === 'categories' && renderCategoriesView()}
			{currentView.view === 'category' && renderCategoryView()}
			{currentView.view === 'subcategory' && renderSubcategoryView()}
			{currentView.view === 'options' && renderOptionsView()}
			{currentView.view === 'themes' && renderThemesView()}
			{currentView.view === 'themeStore' && renderThemeStoreView()}
			{currentView.view === 'homeRows' && renderHomeRowsView()}
			{currentView.view === 'buttonLayout' && renderButtonLayoutView()}
			{currentView.view === 'diagnostics' && renderDiagnosticsView()}
			{currentView.view === 'seerrHomeRows' && renderSeerrHomeRowsView()}
			{currentView.view === 'imdbLists' && renderImdbListsView()}
			{currentView.view === 'externalTmdbLists' && renderExternalTmdbListsView()}
			{currentView.view === 'externalCalendars' && renderExternalCalendarsView()}
			{currentView.view === 'externalCustomRows' && renderExternalCustomRowsView()}
			{currentView.view === 'ratingSources' && renderRatingSourcesView()}
			{currentView.view === 'excludedGenres' && renderExcludedGenresView()}
			{currentView.view === 'pinCode' && renderPinCodeView()}
			{currentView.view === 'libraries' && renderLibrariesView()}
			{currentView.view === 'mediaBarLibraries' && renderMediaBarLibrariesView()}
			{currentView.view === 'mediaBarCollections' && renderMediaBarCollectionsView()}
			<ClearDataDialog
				open={clearDataDialogOpen}
				onCancel={() => setClearDataDialogOpen(false)} // eslint-disable-line react/jsx-no-bind
				onConfirm={handleClearAllData}
			/>
		</div>
	);
};

export default Settings;
