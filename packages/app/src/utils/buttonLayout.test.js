import {ordered, arrange, hiddenSet, DETAIL_BUTTONS, OSD_BUTTONS} from './buttonLayout';

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
