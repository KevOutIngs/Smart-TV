import {buildFilterParams} from './libraryFilters';

describe('library filters', () => {
	it('asks for nothing when nothing is picked', () => {
		expect(buildFilterParams()).toEqual({});
		expect(buildFilterParams({featureFilters: [], tagFilters: []})).toEqual({});
	});

	it('sends each feature as its own flag', () => {
		const params = buildFilterParams({featureFilters: ['HasSubtitles', 'HasTrailer']});
		expect(params.HasSubtitles).toBe('true');
		expect(params.HasTrailer).toBe('true');
		expect(params.HasThemeSong).toBeUndefined();
	});

	it('cancels the definition flag when both sides are picked', () => {
		expect(buildFilterParams({qualityFilters: ['hd']}).IsHD).toBe('true');
		expect(buildFilterParams({qualityFilters: ['sd']}).IsHD).toBe('false');
		expect(buildFilterParams({qualityFilters: ['sd', 'hd']}).IsHD).toBeUndefined();
	});

	it('keeps 4K and 3D separate from the definition flag', () => {
		const params = buildFilterParams({qualityFilters: ['uhd', 'threeD']});
		expect(params.Is4K).toBe('true');
		expect(params.Is3D).toBe('true');
		expect(params.IsHD).toBeUndefined();
	});

	it('pipe delimits the values that can hold a comma', () => {
		const params = buildFilterParams({
			genreFilters: ['Action', 'Sci-Fi, Fantasy'],
			ratingFilters: ['PG-13'],
			tagFilters: ['imax', 'remux']
		});
		expect(params.Genres).toBe('Action|Sci-Fi, Fantasy');
		expect(params.OfficialRatings).toBe('PG-13');
		expect(params.Tags).toBe('imax|remux');
	});

	it('comma delimits the values that cant', () => {
		const params = buildFilterParams({
			yearFilters: ['1999', '2004'],
			videoSourceFilters: ['BluRay', 'Iso'],
			audioLanguageFilters: ['jpn'],
			subtitleLanguageFilters: ['eng', 'spa']
		});
		expect(params.Years).toBe('1999,2004');
		expect(params.VideoTypes).toBe('BluRay,Iso');
		expect(params.AudioLanguages).toBe('jpn');
		expect(params.SubtitleLanguages).toBe('eng,spa');
	});
});
