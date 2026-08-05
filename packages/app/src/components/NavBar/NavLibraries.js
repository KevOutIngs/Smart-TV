import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';

import {LibrariesIcon} from '../icons/navIcons';
import NavPillButton from './NavPillButton';

import css from './NavBar.module.less';

const LibrariesContainer = SpotlightContainerDecorator({
	enterTo: 'default-element'
}, 'div');

const SpottableButton = Spottable('button');

const BLUR_GRACE = 100;
const FOCUS_DELAY = 50;

// The libraries drop down. It closes once focus leaves the group, after a short
// grace period so moving between its own buttons doesn't collapse it.
const NavLibraries = ({libraries, activeView, onSelectLibrary, leftTargetId}) => {
	const [expanded, setExpanded] = useState(false);
	const blurTimeoutRef = useRef(null);

	useEffect(() => {
		return () => {
			if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		if (!expanded) return undefined;
		const timer = setTimeout(() => {
			const firstLibBtn = document.querySelector(`.${css.libraryBtn}`);
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
				slot={8}
				label={$L('Libraries')}
				onClick={handleToggle}
				spotlightId="navbar-libraries"
				className={css.librariesBtn}
				onSpotlightLeft={handleSpotlightLeft}
			/>
			<div className={css.librariesList}>
				{expanded && libraries.map((lib) => (
					<SpottableButton
						key={lib.Id}
						className={`${css.navBtn} ${css.libraryBtn} ${activeView === lib.Id ? css.active : ''}`}
						onClick={handleLibraryClick}
						data-library-id={lib.Id}
					>
						<span className={css.navLabel}>{lib.Name}</span>
					</SpottableButton>
				))}
			</div>
		</LibrariesContainer>
	);
};

export default NavLibraries;
