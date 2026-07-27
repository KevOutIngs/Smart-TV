import {getItemSubtitlePref, getSeriesSubtitlePref} from '../../services/subtitlePrefs';

/**
 * Works out which subtitle track a fresh playback should start on.
 *
 * Returns the stream to use, null to start with subtitles off, or undefined
 * when nothing applies and the caller should leave the selection alone.
 *
 * A remembered pick wins so a chosen track survives across plays and episodes.
 * The per item index restores the exact track on a replay, and the per series
 * language carries to other episodes, matched by language because the same
 * track sits at a different index in each episode.
 */
export const resolveInitialSubtitle = async (result, item, initialSubtitleIndex, settings) => {
	const streams = result?.subtitleStreams || [];

	const savedItemIndex = await getItemSubtitlePref(item.Id);
	if (savedItemIndex !== undefined) {
		if (savedItemIndex < 0) return null;
		const savedStream = streams.find((s) => s.index === savedItemIndex);
		if (savedStream) return savedStream;
	}

	if (item.SeriesId) {
		const savedLanguage = await getSeriesSubtitlePref(item.SeriesId);
		if (savedLanguage !== undefined) {
			if (!savedLanguage) return null;
			const savedStream = streams.find((s) => s.language === savedLanguage);
			if (savedStream) return savedStream;
		}
	}

	if (initialSubtitleIndex !== undefined && initialSubtitleIndex !== null) {
		if (initialSubtitleIndex < 0) return null;
		return streams.find((s) => s.index === initialSubtitleIndex);
	}

	if (settings.subtitleMode === 'always') {
		return streams.find((s) => s.isDefault) || streams[0];
	}

	if (settings.subtitleMode === 'forced') {
		return streams.find((s) => s.isForced);
	}

	// The Jellyfin user's own preference, worked out server side from their
	// subtitle mode and language.
	if (settings.subtitleMode === 'default' &&
			result?.defaultSubtitleStreamIndex != null && result.defaultSubtitleStreamIndex >= 0) {
		return streams.find((s) => s.index === result.defaultSubtitleStreamIndex);
	}

	return undefined;
};
