import {resolveInitialSubtitle} from './initialSubtitle';
import {getItemSubtitlePref, getSeriesSubtitlePref} from '../../services/subtitlePrefs';

jest.mock('../../services/subtitlePrefs', () => ({
	getItemSubtitlePref: jest.fn(),
	getSeriesSubtitlePref: jest.fn()
}));

const eng = {index: 1, language: 'eng', isForced: false, isDefault: true};
const engForced = {index: 2, language: 'eng', isForced: true, isBurnIn: true};
const spa = {index: 3, language: 'spa', isForced: false};

const result = (extra) => ({subtitleStreams: [eng, engForced, spa], ...extra});
const item = {Id: 'item-1'};

beforeEach(() => {
	getItemSubtitlePref.mockResolvedValue(undefined);
	getSeriesSubtitlePref.mockResolvedValue(undefined);
});

describe('resolveInitialSubtitle', () => {
	test('forced mode picks the forced track', async () => {
		const picked = await resolveInitialSubtitle(result(), item, undefined, {subtitleMode: 'forced'});
		expect(picked).toBe(engForced);
	});

	test('forced mode leaves the selection alone when nothing is forced', async () => {
		const picked = await resolveInitialSubtitle({subtitleStreams: [eng, spa]}, item, undefined, {subtitleMode: 'forced'});
		expect(picked).toBeUndefined();
	});

	test('always mode prefers the default track', async () => {
		const picked = await resolveInitialSubtitle(result(), item, undefined, {subtitleMode: 'always'});
		expect(picked).toBe(eng);
	});

	test('always mode falls back to the first track', async () => {
		const picked = await resolveInitialSubtitle({subtitleStreams: [spa, engForced]}, item, undefined, {subtitleMode: 'always'});
		expect(picked).toBe(spa);
	});

	test('default mode follows the server resolved index', async () => {
		const picked = await resolveInitialSubtitle(result({defaultSubtitleStreamIndex: 3}), item, undefined, {subtitleMode: 'default'});
		expect(picked).toBe(spa);
	});

	test('an explicit index wins over the mode', async () => {
		const picked = await resolveInitialSubtitle(result(), item, 3, {subtitleMode: 'forced'});
		expect(picked).toBe(spa);
	});

	test('a negative explicit index means off', async () => {
		const picked = await resolveInitialSubtitle(result(), item, -1, {subtitleMode: 'always'});
		expect(picked).toBeNull();
	});

	test('a remembered item index wins over everything', async () => {
		getItemSubtitlePref.mockResolvedValue(3);
		const picked = await resolveInitialSubtitle(result(), item, 1, {subtitleMode: 'forced'});
		expect(picked).toBe(spa);
	});

	test('a remembered off choice means off', async () => {
		getItemSubtitlePref.mockResolvedValue(-1);
		const picked = await resolveInitialSubtitle(result(), item, undefined, {subtitleMode: 'always'});
		expect(picked).toBeNull();
	});

	test('a remembered index that is gone falls through to the mode', async () => {
		getItemSubtitlePref.mockResolvedValue(99);
		const picked = await resolveInitialSubtitle(result(), item, undefined, {subtitleMode: 'forced'});
		expect(picked).toBe(engForced);
	});

	test('a remembered series language matches by language', async () => {
		getSeriesSubtitlePref.mockResolvedValue('spa');
		const picked = await resolveInitialSubtitle(result(), {...item, SeriesId: 's1'}, undefined, {subtitleMode: 'forced'});
		expect(picked).toBe(spa);
	});

	test('the series preference is only read for episodes of a series', async () => {
		getSeriesSubtitlePref.mockResolvedValue('spa');
		await resolveInitialSubtitle(result(), item, undefined, {subtitleMode: 'forced'});
		expect(getSeriesSubtitlePref).not.toHaveBeenCalled();
	});

	test('no streams at all leaves the selection alone', async () => {
		const picked = await resolveInitialSubtitle({}, item, undefined, {subtitleMode: 'forced'});
		expect(picked).toBeUndefined();
	});
});
