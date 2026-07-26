/**
 * Watchlist response shape.
 *
 * Kept out of seerrApi.js so it can be unit tested on its own. That module pulls
 * in platform storage as soon as it is imported, which a plain unit test has no
 * way to stand up.
 *
 * /discover/watchlist is the one discover endpoint that doesn't return TMDB
 * shaped results. It uses tmdbId where the others use id, and media where they
 * use mediaInfo. normalizeMediaItem reads item.id, so without this every card
 * would come out as "seerr-{type}-undefined".
 */
export const normalizeWatchlistBody = (body) => {
	const results = (body?.results || []).map((raw) => {
		const item = {...raw};
		if (item.tmdbId != null && item.id == null) item.id = item.tmdbId;
		if (item.media && !item.mediaInfo) item.mediaInfo = item.media;
		return item;
	});
	return {...body, results};
};

export default normalizeWatchlistBody;
