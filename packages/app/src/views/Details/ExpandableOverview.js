import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';

import {KEYS} from '../../utils/keys';

import css from './ExpandableOverview.module.less';

const SpottableDiv = Spottable('div');

const SCROLL_STEP = 58;

// The overview with a Read More toggle, shared by both detail styles. Text short
// enough for its four line clamp renders as plain copy. Longer text gets a
// focusable box that expands in place, capped at a fixed height the d-pad
// scrolls through.
const ExpandableOverview = ({text, itemId, className, variant, backRef}) => {
	const [canToggle, setCanToggle] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const textRef = useRef(null);

	// Keyed on the id so an in-place update to the same item doesn't collapse
	// the text.
	useEffect(() => {
		setIsExpanded(false);
		setCanToggle(false);
	}, [itemId]);

	useEffect(() => {
		const el = textRef.current;
		if (el && !isExpanded) {
			setCanToggle(el.scrollHeight > el.clientHeight);
		}
	}, [text, isExpanded]);

	// Back closes the box in place rather than leaving the screen. The global
	// back handling runs in a capture listener, so this answers through the
	// screen's back chain instead of a key handler of its own.
	useEffect(() => {
		if (!backRef || !isExpanded) return undefined;
		const collapse = () => {
			setIsExpanded(false);
			return true;
		};
		backRef.current = collapse;
		return () => {
			if (backRef.current === collapse) backRef.current = null;
		};
	}, [backRef, isExpanded]);

	const handleToggle = useCallback(() => setIsExpanded((prev) => !prev), []);

	// While open, up and down page through the text instead of moving focus.
	const handleKeyDown = useCallback((ev) => {
		if (!isExpanded) return;
		if (ev.keyCode === KEYS.UP || ev.keyCode === KEYS.DOWN) {
			const el = ev.currentTarget;
			el.scrollTop += ev.keyCode === KEYS.DOWN ? SCROLL_STEP : -SCROLL_STEP;
			ev.preventDefault();
			ev.stopPropagation();
		}
	}, [isExpanded]);

	if (!text) return null;

	return (
		<SpottableDiv
			className={`${css.container} ${canToggle ? css.spottable : ''} ${canToggle && isExpanded ? css.expanded : ''} ${className || ''}`}
			onClick={canToggle ? handleToggle : null}
			onKeyDown={handleKeyDown}
			spotlightDisabled={!canToggle}
		>
			<p ref={textRef} className={`${css.text} ${variant === 'classic' ? css.textClassic : ''} ${!isExpanded ? css.collapsed : ''}`}>
				{text}
			</p>
			{canToggle && <div className={css.readMoreBtn}>{isExpanded ? $L('Read Less') : $L('Read More')}</div>}
		</SpottableDiv>
	);
};

export default ExpandableOverview;
