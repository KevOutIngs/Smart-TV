// The library filter panel keeps its choices as plain lists, and the server
// wants a query parameter per kind. Genres, ratings and tags are pipe
// delimited so a value holding a comma still arrives whole.

const list = (values, separator = ',') =>
	Array.isArray(values) && values.length > 0 ? values.join(separator) : undefined;

const flag = (values, key) => (Array.isArray(values) && values.includes(key) ? 'true' : undefined);

// One flag serves both standard and high definition, so asking for both is the
// same as asking for neither.
const hdParam = (qualityFilters) => {
	const wantsHd = Array.isArray(qualityFilters) && qualityFilters.includes('hd');
	const wantsSd = Array.isArray(qualityFilters) && qualityFilters.includes('sd');
	if (wantsHd === wantsSd) return undefined;
	return wantsHd ? 'true' : 'false';
};

const buildFilterParams = ({
	featureFilters = [],
	qualityFilters = [],
	videoSourceFilters = [],
	genreFilters = [],
	ratingFilters = [],
	tagFilters = [],
	yearFilters = [],
	audioLanguageFilters = [],
	subtitleLanguageFilters = []
} = {}) => {
	const params = {
		HasSubtitles: flag(featureFilters, 'HasSubtitles'),
		HasTrailer: flag(featureFilters, 'HasTrailer'),
		HasSpecialFeature: flag(featureFilters, 'HasSpecialFeature'),
		HasThemeSong: flag(featureFilters, 'HasThemeSong'),
		HasThemeVideo: flag(featureFilters, 'HasThemeVideo'),
		IsHD: hdParam(qualityFilters),
		Is4K: flag(qualityFilters, 'uhd'),
		Is3D: flag(qualityFilters, 'threeD'),
		VideoTypes: list(videoSourceFilters),
		Genres: list(genreFilters, '|'),
		OfficialRatings: list(ratingFilters, '|'),
		Tags: list(tagFilters, '|'),
		Years: list(yearFilters),
		AudioLanguages: list(audioLanguageFilters),
		SubtitleLanguages: list(subtitleLanguageFilters)
	};

	// A filter nobody picked is left out rather than sent as an empty value.
	Object.keys(params).forEach(key => {
		if (params[key] === undefined) delete params[key];
	});
	return params;
};

export {buildFilterParams};
