// How a home row's sort setting turns into the sort order and item types the server wants.
// The settings editor and the home screen both ask, and they have to agree, or the rows the
// editor previews come back in a different order than the ones the home screen draws.

// Names read best A to Z and a shuffle has no direction, everything else newest first.
export const getSortOrderFromSortBy = (sortBy) => {
	const lower = (sortBy || '').toLowerCase();
	if (lower === 'sortname' || lower === 'name') return 'Ascending';
	if (lower === 'random') return 'Ascending';
	return 'Descending';
};

// A stored direction wins, and auto keeps the derived one above.
export const resolveSortOrder = (sortBy, storedOrder) => {
	if (storedOrder === 'Ascending' || storedOrder === 'Descending') return storedOrder;
	return getSortOrderFromSortBy(sortBy);
};

export const getGenresIncludeTypes = (filter) => {
	if (filter === 'Movie') return 'Movie';
	if (filter === 'Series') return 'Series';
	return 'Movie,Series';
};
