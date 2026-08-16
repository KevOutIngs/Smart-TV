import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';

import {LibrariesIcon} from '../icons/navIcons';
import NavPillButton from './NavPillButton';

import css from './NavBar.module.less';

const PILL_ID = 'navbar-libraries';

// Coming into the group lands on the pill rather than on whichever library button is
// nearest, so arriving from the right doesn't drop you at the end of an open list with
// the whole list to walk back through. enterTo does nothing without an element named
// alongside it.
const LibrariesContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: `.${css.librariesBtn}`
}, 'div');

const SpottableButton = Spottable('button');

const BLUR_GRACE = 100;
const FOCUS_DELAY = 50;

// The libraries drop down. It closes once focus leaves the group, after a short
// grace period so moving between its own buttons doesn't collapse it.
const NavLibraries = ({libraries, slot, activeView, onSelectLibrary, leftTargetId}) => {
	const [expanded, setExpanded] = useState(false);
	const blurTimeoutRef = useRef(null);
	const listRef = useRef(null);

	useEffect(() => {
		return () => {
			if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		if (!expanded) return undefined;
		const timer = setTimeout(() => {
			// A press that beats this timer keeps whatever it landed on, rather than being
			// undone by focus arriving late.
			const current = Spotlight.getCurrent();
			if (current && !current.classList.contains(css.librariesBtn)) return;
			const firstLibBtn = listRef.current?.firstElementChild;
			if (firstLibBtn) Spotlight.focus(firstLibBtn);
		}, FOCUS_DELAY);
		return () => clearTimeout(timer);
	}, [expanded]);

	const handleToggle = useCallback(() => {
		if (libraries?.length > 0) setExpanded(prev => !prev);
	}, [libraries]);

	const handleFocus = useCallback(() => {
		if (blurTimeoutRef.current) {
			clearTimeout(blurTimeoutRef.current);
			blurTimeoutRef.current = null;
		}
	}, []);

	const handleBlur = useCallback((e) => {
		const container = e.currentTarget;
		blurTimeoutRef.current = setTimeout(() => {
			if (!container.contains(document.activeElement)) setExpanded(false);
		}, BLUR_GRACE);
	}, []);

	const handleSpotlightLeft = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!Spotlight.focus(leftTargetId)) Spotlight.move('left');
	}, [leftTargetId]);

	// The pill sits alongside the list rather than above it, so up has nothing to find
	// on its own and gets sent back by hand.
	const handleLibraryUp = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		Spotlight.focus(PILL_ID);
	}, []);

	const handleLibraryClick = useCallback((e) => {
		const libId = e.currentTarget.dataset.libraryId;
		const lib = libraries.find(l => l.Id === libId);
		if (lib) onSelectLibrary?.(lib);
	}, [libraries, onSelectLibrary]);

	return (
		<LibrariesContainer
			className={`${css.librariesGroup} ${expanded ? css.expanded : ''}`}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<NavPillButton
				Icon={LibrariesIcon}
				slot={slot}
				label={$L('Libraries')}
				onClick={handleToggle}
				spotlightId={PILL_ID}
				className={css.librariesBtn}
				onSpotlightLeft={handleSpotlightLeft}
			/>
			<div className={css.librariesList} ref={listRef}>
				{expanded && libraries.map((lib, index) => (
					<SpottableButton
						key={lib.Id}
						className={`${css.navBtn} ${css.libraryBtn} ${activeView === lib.Id ? css.active : ''}`}
						onClick={handleLibraryClick}
						onSpotlightUp={handleLibraryUp}
						data-library-id={lib.Id}
						data-nav-slot={(index % 16) + 1}
					>
						<span className={css.navLabel}>{lib.Name}</span>
					</SpottableButton>
				))}
			</div>
		</LibrariesContainer>
	);
};

export default NavLibraries;
