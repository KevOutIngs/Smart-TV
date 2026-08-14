// The pieces the favorites, genres and library grids all share: the alphabet strip, the
// arrow keys that carry focus in and out of the grid, and the settings each grid cycles
// through. The two key handlers are built once per view rather than per render, since the
// only thing they close over is the id they were given.

import Spotlight from '@enact/spotlight';

import {KEYS} from './keys';

export const LETTERS = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// The alphabet strip filters on the name the server sorts by, falling back to the display
// name when it sent no sort name. Hash collects everything that doesn't start with a letter,
// which is where numbers and non-latin titles land.
export const filterByStartLetter = (items, startLetter) => {
	if (!startLetter) return items;

	return items.filter((item) => {
		const firstChar = (item.SortName || item.Name || '').charAt(0).toUpperCase();
		if (startLetter === '#') return !/[A-Z]/.test(firstChar);
		return firstChar === startLetter;
	});
};

// What the image and layout rows on the settings panel step through.
export const IMAGE_SIZES = ['small', 'medium', 'large', 'extraLarge'];
export const IMAGE_TYPES = ['poster', 'thumbnail'];
export const GRID_DIRECTIONS = ['vertical', 'horizontal'];

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const stopPropagation = (e) => e.stopPropagation();

export const cycleValue = (values, current) => values[(values.indexOf(current) + 1) % values.length];

// Down out of the toolbar drops into the grid.
export const createToolbarKeyDown = (gridSpotlightId) => (e) => {
	if (e.keyCode !== KEYS.DOWN) return;

	e.preventDefault();
	e.stopPropagation();
	Spotlight.focus(gridSpotlightId);
};

// Up out of the grid goes back to the toolbar, but only from the top of the list. Further
// down it's left alone so the same key keeps scrolling.
export const createGridKeyDown = (gridClassName, aboveSpotlightId) => (e) => {
	if (e.keyCode !== KEYS.UP) return;

	const grid = document.querySelector(`.${gridClassName}`);
	if (!grid || (grid.scrollTop || 0) >= 50) return;

	e.preventDefault();
	e.stopPropagation();
	Spotlight.focus(aboveSpotlightId);
};
