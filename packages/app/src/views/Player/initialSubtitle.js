import {getItemSubtitlePref, getSeriesSubtitlePref} from '../../services/subtitlePrefs';
import {normalizeLanguageCode} from '../../utils/audioLanguage';

const COMMENTARY = /\b(commentary|commentaries|jump\s*scare)\b/i;
const SDH = /\b(sdh|cc|hoh|hearing\s*impaired|closed\s*caption)\b/i;

const titleOf = (stream) => stream?.displayTitle || '';
const isCommentary = (stream) => COMMENTARY.test(titleOf(stream));
const isSdh = (stream) => stream?.isHearingImpaired === true || SDH.test(titleOf(stream));

const languageRank = (stream, preferred, fallback) => {
	const language = normalizeLanguageCode(stream?.language);
	if (preferred && language === preferred) return 0;
	if (fallback && language === fallback) return 1;
	if (language === 'eng') return 2;
	return 3;
};

/**
 * Orders candidates the way the other clients do, so the same file lands on the
 * same track everywhere. The preferred language wins over the fallback language,
 * which wins over English, and the SDH preference flips whether hearing impaired
 * tracks sort ahead of or behind the rest.
 */
export const bestSubtitle = (streams, preferredLanguage, options = {}) => {
	if (!streams?.length) return undefined;
	const preferred = normalizeLanguageCode(preferredLanguage);
	const fallback = normalizeLanguageCode(options.fallbackLanguage);
	const preferSdh = options.preferSdh === true;
	const ordered = streams.map((stream, position) => ({stream, position}));
	ordered.sort((a, b) => {
		const left = a.stream;
		const right = b.stream;
		return (languageRank(left, preferred, fallback) - languageRank(right, preferred, fallback)) ||
			// Commentary reads as dialogue until it starts, so it goes last.
			(isCommentary(left) - isCommentary(right)) ||
			// A bad external download must not beat the track already in the file.
			(Boolean(left.isExternal) - Boolean(right.isExternal)) ||
			(preferSdh ? (isSdh(right) - isSdh(left)) : (isSdh(left) - isSdh(right))) ||
			// Only matters when full subtitles were asked for, since a forced pick has
			// already narrowed the list to forced tracks.
			(Boolean(left.isForced) - Boolean(right.isForced)) ||
			(Boolean(right.isDefault) - Boolean(left.isDefault)) ||
			(a.position - b.position);
	});
	return ordered[0].stream;
};

const subtitleOptions = (settings) => ({
	fallbackLanguage: settings.fallbackSubtitleLanguage,
	preferSdh: settings.preferSdhSubtitles === true
});

// Foreign mode only wants subtitles when the audio the playback starts on is not
// in a language the viewer understands. The preferred audio language is the best
// signal for that, with the interface language standing in when none is set.
const audioIsNative = (audioStream, settings) => {
	const wanted = normalizeLanguageCode(settings.audioLanguage) || normalizeLanguageCode(settings.uiLanguage);
	if (!wanted) return false;
	return normalizeLanguageCode(audioStream?.language) === wanted;
};

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
export const resolveInitialSubtitle = async (result, item, initialSubtitleIndex, settings, audioStream) => {
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

	if (settings.subtitleMode === 'none') {
		return null;
	}

	if (settings.subtitleMode === 'always') {
		return bestSubtitle(streams, settings.subtitleLanguage, subtitleOptions(settings));
	}

	if (settings.subtitleMode === 'foreign') {
		if (audioIsNative(audioStream, settings)) return null;
		return bestSubtitle(streams, settings.subtitleLanguage, subtitleOptions(settings));
	}

	if (settings.subtitleMode === 'forced') {
		return bestSubtitle(streams.filter((s) => s.isForced), settings.subtitleLanguage, subtitleOptions(settings));
	}

	// The Jellyfin user's own preference, worked out server side from their
	// subtitle mode and language.
	if (settings.subtitleMode === 'default' &&
			result?.defaultSubtitleStreamIndex != null && result.defaultSubtitleStreamIndex >= 0) {
		return streams.find((s) => s.index === result.defaultSubtitleStreamIndex);
	}

	return undefined;
};
