import {memo, useCallback, useMemo} from 'react';
import $L from '@enact/i18n/$L';
import SpotlightContainerDecorator, {spotlightDefaultClass} from '@enact/spotlight/SpotlightContainerDecorator';
import {useSettings} from '../../context/SettingsContext';
import {useSeerr} from '../../context/SeerrContext';
import {useSyncPlay} from '../../context/SyncPlayContext';
import SeerrIcon from '../icons/SeerrIcon';
import SyncPlayIcon from '../icons/SyncPlayIcon';
import {FavoritesIcon, GenresIcon, HomeIcon, SearchIcon, SettingsIcon, ShuffleIcon} from '../icons/navIcons';
import useClock from '../../hooks/useClock';
import {toCssColor, toCssColorWithAlpha, toSafeCssColorWithAlpha} from '../../theme/themeSpec';
import {SIDEBAR_CONTENT_FOCUS_TARGETS, focusFirstContentTarget} from '../../utils/navFocusTargets';
import {KEYS} from '../../utils/keys';
import SidebarItem from './SidebarItem';
import SidebarLibraries from './SidebarLibraries';
import SidebarUserButton from './SidebarUserButton';
import useSidebarExpansion from './useSidebarExpansion';

import css from './Sidebar.module.less';

const SidebarContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	preserveId: true
}, 'nav');

// Up and down at the ends of the rail would otherwise leak out to whatever sits
// behind it, so those two presses get swallowed.
const trapVerticalEdges = (e) => {
	const items = Array.from(e.currentTarget.querySelectorAll('[data-spotlight-id], .spottable'))
		.filter(el => el.offsetParent !== null);
	if (items.length === 0) return;
	const focused = document.activeElement;
	const edge = e.keyCode === KEYS.UP ? items[0] : items[items.length - 1];
	if (focused === edge || edge.contains(focused)) {
		e.preventDefault();
		e.stopPropagation();
	}
};

const Sidebar = ({
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
	const clock = useClock();
	const {expanded, librariesExpanded, toggleLibraries, handlers} = useSidebarExpansion();

	const showShuffle = settings.showShuffleButton !== false;
	const showGenres = settings.showGenresButton !== false;
	const showFavorites = settings.showFavoritesButton !== false;
	const showSeerr = seerrEnabled && settings.showSeerrButton !== false;
	const showSyncPlay = settings.syncplayEnabled !== false && settings.showSyncPlayButton !== false;
	const showLibraries = settings.showLibrariesInToolbar !== false && libraries.length > 0;

	const navStyle = useMemo(() => {
		let navbarColor = activeTheme.transparentNavbarSurface ? 'transparent' : `linear-gradient(to right, ${toCssColorWithAlpha(activeTheme.colors.surface, 0.96)}, ${toCssColorWithAlpha(activeTheme.colors.surface, 0.88)}, ${toCssColorWithAlpha(activeTheme.colors.surface, 0.66)}, transparent)`;
		const c1 = toSafeCssColorWithAlpha(settings.navbarColor, settings.navbarOpacity/100);
		const c2 = toSafeCssColorWithAlpha(settings.navbarColor, settings.navbarOpacity/105);
		const c3 = toSafeCssColorWithAlpha(settings.navbarColor, settings.navbarOpacity/110);
		const c4 = toSafeCssColorWithAlpha(settings.navbarColor, settings.navbarOpacity/115);
		if (c1 && c2 && c3 && c4) {
			navbarColor = `linear-gradient(to right, ${c1}, ${c1}, ${c2}, ${c3}, ${c4}, transparent)`;
		}
		return {
			background: expanded ? navbarColor : 'transparent',
			backdropFilter: 'none',
			WebkitBackdropFilter: 'none',
			borderBottom: activeTheme.borders.navBorder
				? `${activeTheme.borders.navBorder.width}px solid ${toCssColor(activeTheme.borders.navBorder.color)}`
				: 'none',
			color: toCssColor(activeTheme.colors.onSurface),
			textShadow: activeTheme.textGlow.length ? 'var(--theme-text-glow)' : 'none'
		};
	}, [activeTheme, settings.navbarColor, settings.navbarOpacity, expanded]);

	const handleNavKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			focusFirstContentTarget(SIDEBAR_CONTENT_FOCUS_TARGETS, 'right');
		} else if (e.keyCode === KEYS.UP || e.keyCode === KEYS.DOWN) {
			trapVerticalEdges(e);
		}
	}, []);

	return (
		<SidebarContainer
			className={`${css.sidebar} ${expanded ? css.expanded : ''}`}
			style={navStyle}
			onKeyDown={handleNavKeyDown}
			onMouseEnter={handlers.onMouseEnter}
			onMouseLeave={handlers.onMouseLeave}
			onFocus={handlers.onFocus}
			onBlur={handlers.onBlur}
			spotlightId="navbar"
		>
			<div className={css.userSection}>
				<SidebarUserButton onClick={onUserMenu} />
			</div>

			<div className={css.navSection}>
				<div className={css.navItems}>
					<SidebarItem Icon={HomeIcon} slot={1} label={$L('Home')} onClick={onHome} spotlightId="navbar-home" className={spotlightDefaultClass} />
					<SidebarItem Icon={SearchIcon} slot={2} label={$L('Search')} onClick={onSearch} />

					{showShuffle && (
						<SidebarItem Icon={ShuffleIcon} slot={3} label={$L('Shuffle')} onClick={onShuffle} />
					)}

					{showGenres && (
						<SidebarItem Icon={GenresIcon} slot={4} label={$L('Genres')} onClick={onGenres} />
					)}

					{showFavorites && (
						<SidebarItem Icon={FavoritesIcon} slot={5} label={$L('Favorites')} onClick={onFavorites} />
					)}

					{showSeerr && (
						<SidebarItem Icon={SeerrIcon} slot={6} label={displayName} onClick={onDiscover} />
					)}

					{showSyncPlay && (
						<SidebarItem Icon={SyncPlayIcon} slot={7} label={$L('SyncPlay')} onClick={onSyncPlay} active={isInGroup} />
					)}

					{showLibraries && (
						<SidebarLibraries
							libraries={libraries}
							expanded={librariesExpanded}
							onToggle={toggleLibraries}
							onSelectLibrary={onSelectLibrary}
						/>
					)}

					<SidebarItem Icon={SettingsIcon} slot={9} label={$L('Settings')} onClick={onSettings} spotlightId="navbar-settings" />
				</div>
			</div>

			<div className={css.footerSection}>
				<div className={css.clock}>{clock}</div>
			</div>
		</SidebarContainer>
	);
};

export default memo(Sidebar);
