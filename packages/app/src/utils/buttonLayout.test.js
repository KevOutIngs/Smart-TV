import {ordered, arrange, hiddenSet, withUnknownIds, DETAIL_BUTTONS, OSD_BUTTONS} from './buttonLayout';

const ids = (list) => list.map((item) => item.id);
const declare = (...list) => list.map((id) => ({id}));

describe('ordered', () => {
	const all = declare('a', 'b', 'c', 'd');

	it('leaves the declaration order alone when nothing is stored', () => {
		expect(ids(ordered(all, []))).toEqual(['a', 'b', 'c', 'd']);
		expect(ids(ordered(all, ''))).toEqual(['a', 'b', 'c', 'd']);
		expect(ids(ordered(all, null))).toEqual(['a', 'b', 'c', 'd']);
	});

	it('applies a stored order', () => {
		expect(ids(ordered(all, ['d', 'c', 'b', 'a']))).toEqual(['d', 'c', 'b', 'a']);
	});

	it('keeps a button the user never placed beside the one it was declared after', () => {
		// 'c' is new since the user last arranged this row. It was declared after 'b', so it
		// belongs behind 'b' wherever the user put 'b', not at the end of the row.
		expect(ids(ordered(all, ['d', 'b', 'a']))).toEqual(['d', 'b', 'c', 'a']);
	});

	it('puts a button declared before anything placed at the front', () => {
		expect(ids(ordered(all, ['b', 'c', 'd']))).toEqual(['a', 'b', 'c', 'd']);
		expect(ids(ordered(all, ['d', 'c', 'b']))).toEqual(['a', 'd', 'c', 'b']);
	});

	it('ignores stored ids the row no longer offers', () => {
		expect(ids(ordered(all, ['gone', 'c', 'a']))).toEqual(['c', 'd', 'a', 'b']);
	});

	it('accepts a comma joined string, which is how Core stores it locally', () => {
		expect(ids(ordered(all, 'd,c,b,a'))).toEqual(['d', 'c', 'b', 'a']);
	});
});

describe('hiddenSet', () => {
	it('holds the buttons switched off, so a newly offered one stays visible', () => {
		const off = hiddenSet(['b']);
		expect(off.has('b')).toBe(true);
		expect(off.has('brand-new')).toBe(false);
	});
});

describe('arrange', () => {
	const all = declare('a', 'b', 'c', 'd');

	it('orders then drops the hidden buttons', () => {
		expect(ids(arrange(all, {order: ['d', 'c', 'b', 'a'], hidden: ['c']}))).toEqual(['d', 'b', 'a']);
	});

	it('returns everything when nothing is stored', () => {
		expect(ids(arrange(all, {}))).toEqual(['a', 'b', 'c', 'd']);
	});

	it('can empty the row', () => {
		expect(arrange(all, {hidden: ['a', 'b', 'c', 'd']})).toEqual([]);
	});
});

describe('withUnknownIds', () => {
	const catalogue = declare('a', 'b', 'c');

	it('leaves a save alone when the stored arrangement holds nothing extra', () => {
		const merged = withUnknownIds(catalogue, {order: ['c', 'a', 'b'], hidden: ['a']}, {order: ['a', 'b', 'c'], hidden: []});
		expect(merged).toEqual({order: ['c', 'a', 'b'], hidden: ['a']});
	});

	it('puts an id this app has no button for back behind the one it was stored after', () => {
		const merged = withUnknownIds(catalogue, {order: ['c', 'b', 'a'], hidden: []}, {order: ['a', 'download', 'b', 'c'], hidden: []});
		expect(merged.order).toEqual(['c', 'b', 'a', 'download']);
	});

	it('leads the row with a carried id that was stored before anything this app offers', () => {
		const merged = withUnknownIds(catalogue, {order: ['b', 'a', 'c'], hidden: []}, {order: ['playOffline', 'a', 'b', 'c'], hidden: []});
		expect(merged.order).toEqual(['playOffline', 'b', 'a', 'c']);
	});

	it('keeps a carried id switched off, so hiding it on another device sticks', () => {
		const merged = withUnknownIds(catalogue, {order: ['a', 'b', 'c'], hidden: ['b']}, {order: ['a', 'b', 'c', 'cast'], hidden: ['cast']});
		expect(merged.hidden).toEqual(['b', 'cast']);
	});

	it('accepts the comma joined form Core stores locally', () => {
		const merged = withUnknownIds(catalogue, {order: ['a', 'b', 'c'], hidden: []}, {order: 'a,cast,b,c', hidden: 'cast'});
		expect(merged.order).toEqual(['a', 'cast', 'b', 'c']);
		expect(merged.hidden).toEqual(['cast']);
	});
});

describe('the button catalogues', () => {
	it('gives every button a unique id', () => {
		[DETAIL_BUTTONS, OSD_BUTTONS].forEach((list) => {
			expect(new Set(ids(list)).size).toBe(list.length);
		});
	});

	it('names the cast and crew button the way Core does, since Core uses cast for Chromecast', () => {
		expect(ids(OSD_BUTTONS)).toContain('castAndCrew');
		expect(ids(OSD_BUTTONS)).not.toContain('cast');
	});

	it('leaves the primary play button out, since it always leads the row', () => {
		expect(ids(DETAIL_BUTTONS)).not.toContain('play');
		expect(ids(DETAIL_BUTTONS)).not.toContain('restart');
	});
});
