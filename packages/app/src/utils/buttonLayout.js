// How a row of buttons is arranged. The details action row and the player controls each get
// their own arrangement, and both follow the user between devices through the plugin, so the
// ids and the storage shape here have to match what Moonfin Core writes. Renaming an id drops
// whatever the user had arranged for it.
//
// Labels are plain English and get translated where they are shown, with $L(button.label).

// Only the TV variants are read and written here. Core keeps a separate arrangement per kind
// of device, because a phone and a TV want very different rows.
export const DETAIL_ORDER_KEY = 'detailButtonOrderTv';
export const DETAIL_HIDDEN_KEY = 'hiddenDetailButtonsTv';
export const OSD_ORDER_KEY = 'osdButtonOrderTv';
export const OSD_HIDDEN_KEY = 'hiddenOsdButtonsTv';

// Play, Resume and Restart are absent on purpose. They are one button wearing different
// labels, it always leads the row, and it anchors the focus the screen hands out.
export const DETAIL_BUTTONS = [
	{id: 'shuffle', label: 'Shuffle'},
	{id: 'version', label: 'Version'},
	{id: 'audio', label: 'Audio'},
	{id: 'subtitles', label: 'Subtitle'},
	{id: 'trailer', label: 'Trailer'},
	{id: 'watched', label: 'Mark Watched'},
	{id: 'favorite', label: 'Favorite'},
	{id: 'goToSeries', label: 'Series'},
	{id: 'mediaInfo', label: 'Media Info'},
	{id: 'playlist', label: 'Add to Playlist'},
	{id: 'collection', label: 'Add to Collection'},
	{id: 'deleteFiles', label: 'Delete'},
	{id: 'artwork', label: 'Change Artwork'},
	{id: 'admin', label: 'Admin Controls'}
];

// Play, pause, seek and track skip are absent on purpose, the player always keeps those.
export const OSD_BUTTONS = [
	{id: 'speed', label: 'Playback Speed'},
	{id: 'chapters', label: 'Chapters'},
	{id: 'subtitles', label: 'Subtitles'},
	{id: 'audio', label: 'Audio'},
	{id: 'castAndCrew', label: 'Cast and Crew'},
	{id: 'quality', label: 'Playback Quality'},
	{id: 'zoom', label: 'Zoom'},
	{id: 'sleep', label: 'Sleep Timer'},
	{id: 'info', label: 'Playback Information'}
];

// The plugin sends an array, but a comma joined string is accepted too since that is how Core
// stores these locally.
const toIds = (stored) => {
	if (Array.isArray(stored)) return stored.filter(Boolean).map(String);
	if (typeof stored === 'string') return stored.split(',').filter(Boolean);
	return [];
};

// Holds the buttons switched off rather than the ones left on, so a button the app starts
// offering later shows up for people who already have a list.
export const hiddenSet = (stored) => new Set(toIds(stored));

// `all` rearranged into the order the user put this row in. Anything they never placed, such
// as a button added since they last touched this, follows the placed button it was declared
// after, so it lands where it belongs rather than at the end of the row.
export const ordered = (all, stored) => {
	const ids = toIds(stored);
	if (ids.length === 0) return all;

	const placed = new Map(ids.map((id, index) => [id, index]));
	let carried = -1;
	const ranked = all.map((item, declared) => {
		const rank = placed.get(item.id);
		if (rank !== undefined) carried = rank;
		return {rank: carried, declared, item};
	});
	ranked.sort((a, b) => (a.rank - b.rank) || (a.declared - b.declared));
	return ranked.map((entry) => entry.item);
};

// The visible buttons for a row, in the user's order. `all` has to be in declaration order.
export const arrange = (all, {order, hidden} = {}) => {
	const off = hiddenSet(hidden);
	return ordered(all, order).filter((item) => !off.has(item.id));
};
