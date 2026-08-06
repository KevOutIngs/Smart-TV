// Moving focus between the sections of the detail screen. Which sections exist depends on
// the title, so each move lists its targets in order and takes the first one that is there.

import {KEYS} from '../../utils/keys';
import {safeFocus} from './seerrFocus';

const focusFirst = (...spotlightIds) => spotlightIds.some((id) => safeFocus(id));

// An arrow with nothing listed for it is left to bubble, so the screen still scrolls.
const onArrow = ({up, down}) => (e) => {
	let targets = null;
	if (e.keyCode === KEYS.UP) targets = up;
	if (e.keyCode === KEYS.DOWN) targets = down;
	if (!targets) return;

	e.preventDefault();
	e.stopPropagation();
	focusFirst(...targets);
};

export const handleCollectionBannerKeyDown = onArrow({
	up: ['action-buttons'],
	down: ['cast-section', 'details-row-0', 'details-row-1']
});

export const handleActionButtonsKeyDown = onArrow({
	down: ['collection-banner', 'cast-section', 'details-row-0', 'details-row-1']
});

export const handleCastSectionKeyDown = onArrow({
	up: ['collection-banner', 'action-buttons'],
	down: ['details-row-0', 'details-row-1', 'keywords-section']
});

export const handleKeywordsSectionKeyDown = onArrow({
	up: ['details-row-1', 'details-row-0', 'cast-section', 'action-buttons']
});

// The rows are built from the title's own content, so the one above or below might not be
// there. Both moves fall back to the nearest fixed section instead.
export const handleRowNavigateUp = (fromRowIndex) => {
	const previousRow = fromRowIndex > 0 ? [`details-row-${fromRowIndex - 1}`] : [];
	focusFirst(...previousRow, 'cast-section', 'action-buttons');
};

export const handleRowNavigateDown = (fromRowIndex) => {
	focusFirst(`details-row-${fromRowIndex + 1}`, 'keywords-section', 'seasons-section');
};
