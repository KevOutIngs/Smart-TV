// Which Seerr title a library item stands for.
//
// Only movies and series have a counterpart. An episode or a season resolves through its series
// page instead, where the per-season markers say what is actually available.
//
// The id has to come out as a number. Jellyfin keeps provider ids as strings, while Seerr puts
// this straight into a request body and turns away anything that isn't a number.

export const IDLE = {mediaId: null, mediaType: null};

// How a Seerr title reaches the detail screen when the library has nothing to open for it.
export const seerrDetailStub = ({mediaId, mediaType}) => ({
	Id: `seerr-${mediaType}-${mediaId}`,
	Type: mediaType === 'tv' ? 'Series' : 'Movie',
	_seerrMediaId: mediaId,
	_seerrMediaType: mediaType
});

export const isSeerrOnlyItem = (item) => item?._seerrMediaId != null;

// Seerr hands back the media server's own id for a title it knows is already in
// the library. Opening that instead of the stand-in is what gives the screen its
// playback, ratings and everything else a synthetic item has none of.
export const libraryIdOf = (media) => media?.jellyfinMediaId || media?.jellyfinMediaId4k || null;

export const seerrTargetFor = (item) => {
	if (isSeerrOnlyItem(item)) {
		return {mediaId: Number(item._seerrMediaId), mediaType: item._seerrMediaType === 'tv' ? 'tv' : 'movie'};
	}
	if (item?.Type !== 'Movie' && item?.Type !== 'Series') return IDLE;
	const tmdbId = Number(item.ProviderIds?.Tmdb);
	if (!Number.isFinite(tmdbId) || tmdbId <= 0) return IDLE;
	return {mediaId: tmdbId, mediaType: item.Type === 'Series' ? 'tv' : 'movie'};
};
