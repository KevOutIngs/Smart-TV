import {memo, useCallback, useMemo} from 'react';
import $L from '@enact/i18n/$L';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {useSyncPlay} from '../../context/SyncPlayContext';
import SeerrIcon from '../icons/SeerrIcon';
import SyncPlayIcon from '../icons/SyncPlayIcon';
import {FavoritesIcon, GenresIcon, HomeIcon, SearchIcon, SettingsIcon, ShuffleIcon} from '../icons/navIcons';
import useClock from '../../hooks/useClock';
import {toCssColor, toSafeCssColorWithAlpha} from '../../theme/themeSpec';
import {CONTENT_FOCUS_TARGETS, focusFirstContentTarget} from '../../utils/navFocusTargets';
import {KEYS} from '../../utils/keys';
import NavLibraries from './NavLibraries';
import NavPillButton from './NavPillButton';
import NavUserButton from './NavUserButton';

import css from './NavBar.module.less';

const NavContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '.spottable-default',
	preserveId: true
}, 'nav');

const NavBar = ({
	activeView = 'home',
	libraries = [],
	onHome,
	onSearch,
	onShuffle,
	onGenres,
	onFavorites,
	onDiscover,
	onSettings,
	onSelectLibrary,
	onUserMenu,
	onSyncPlay
}) => {
	const {settings, activeTheme} = useSettings();
	const {isEnabled: seerrEnabled, displayName} = useSeerr();
	const {isInGroup} = useSyncPlay();
	const showClock = settings.showClock !== false;
	const clock = useClock(showClock);

	const showShuffle = settings.showShuffleButton !== false;
	const showGenres = settings.showGenresButton !== false;
	const showFavorites = settings.showFavoritesButton !== false;
	const showSeerr = seerrEnabled && settings.showSeerrButton !== false;
	const showSyncPlay = settings.syncplayEnabled !== false && settings.showSyncPlayButton !== false;
	const showLibraries = settings.showLibrariesInToolbar !== false && libraries.length > 0;

	const navPillStyle = useMemo(() => {
		let navbarColor = activeTheme.transparentNavbarSurface ? 'transparent' : toCssColor(activeTheme.colors.surface);
		const safeColor = toSafeCssColorWithAlpha(settings.navbarColor, settings.navbarOpacity/100);
		if (safeColor) navbarColor = safeColor;
		return {
			background: navbarColor,
			backdropFilter: 'none',
			WebkitBackdropFilter: 'none',
			borderBottom: activeTheme.borders.navBorder
				? `${activeTheme.borders.navBorder.width}px solid ${toCssColor(activeTheme.borders.navBorder.color)}`
				: 'none',
			color: toCssColor(activeTheme.colors.onSurface),
			textShadow: activeTheme.textGlow.length ? 'var(--theme-text-glow)' : 'none'
		};
	}, [activeTheme, settings.navbarColor, settings.navbarOpacity]);

	// Whatever sits immediately left of the libraries group, which depends on how
	// many of the optional buttons are turned on.
	const librariesLeftTargetId = useMemo(() => {
		if (showSyncPlay) return 'navbar-syncplay';
		if (seerrEnabled) return 'navbar-discover';
		if (showFavorites) return 'navbar-favorites';
		if (showGenres) return 'navbar-genres';
		if (showShuffle) return 'navbar-shuffle';
		return 'navbar-search';
	}, [showSyncPlay, seerrEnabled, showFavorites, showGenres, showShuffle]);

	const handlePillFocus = useCallback((e) => {
		e.target?.scrollIntoView?.({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
	}, []);

	const handleNavKeyDown = useCallback((e) => {
		if (e.keyCode !== KEYS.DOWN) return;
		e.preventDefault();
		e.stopPropagation();
		focusFirstContentTarget(CONTENT_FOCUS_TARGETS, 'down');
	}, []);

	return (
		<NavContainer className={css.topNav} onKeyDown={handleNavKeyDown} spotlightId="navbar">
			<div className={css.navLeft}>
				<NavUserButton onClick={onUserMenu} />
			</div>

			<div className={css.navCenter}>
				<div className={css.navPill} style={navPillStyle} onFocus={handlePillFocus}>
					<NavPillButton Icon={HomeIcon} slot={1} label={$L('Home')} onClick={onHome} spotlightId="navbar-home" isDefault />
					<NavPillButton Icon={SearchIcon} slot={2} label={$L('Search')} onClick={onSearch} spotlightId="navbar-search" />

					{showShuffle && (
						<NavPillButton Icon={ShuffleIcon} slot={3} label={$L('Shuffle')} onClick={onShuffle} spotlightId="navbar-shuffle" />
					)}

					{showGenres && (
						<NavPillButton Icon={GenresIcon} slot={4} label={$L('Genres')} onClick={onGenres} spotlightId="navbar-genres" />
					)}

					{showFavorites && (
						<NavPillButton Icon={FavoritesIcon} slot={5} label={$L('Favorites')} onClick={onFavorites} spotlightId="navbar-favorites" />
					)}

					{showSeerr && (
						<NavPillButton Icon={SeerrIcon} slot={6} label={displayName} onClick={onDiscover} spotlightId="navbar-discover" />
					)}

					{showSyncPlay && (
						<NavPillButton Icon={SyncPlayIcon} slot={7} label={$L('SyncPlay')} onClick={onSyncPlay} spotlightId="navbar-syncplay" active={isInGroup} />
					)}

					{showLibraries && (
						<NavLibraries
							libraries={libraries}
							activeView={activeView}
							onSelectLibrary={onSelectLibrary}
							leftTargetId={librariesLeftTargetId}
						/>
					)}

					<NavPillButton Icon={SettingsIcon} slot={9} label={$L('Settings')} onClick={onSettings} spotlightId="navbar-settings" />
				</div>
			</div>

			<div className={css.navRight}>
				{showClock && <div className={css.clock}>{clock}</div>}
			</div>
		</NavContainer>
	);
};

export default memo(NavBar);
