import {getItemSubtitlePref, getSeriesSubtitlePref} from '../../services/subtitlePrefs';
import {normalizeLanguageCode} from '../../utils/audioLanguage';

const COMMENTARY = /\b(commentary|commentaries|jump\s*scare)\b/i;
const SDH = /\b(sdh|cc|hoh|hearing\s*impaired|closed\s*caption)\b/i;

const titleOf = (stream) => stream?.displayTitle || '';
const isCommentary = (stream) => COMMENTARY.test(titleOf(stream));
const isSdh = (stream) => SDH.test(titleOf(stream));

const languageRank = (stream, preferred) => {
	const language = normalizeLanguageCode(stream?.language);
	if (preferred && language === preferred) return 0;
	if (language === 'eng') return 1;
	return 2;
};

/**
 * Orders candidates the way the other clients do, so the same file lands on the
 * same track everywhere. Their fallback language and codec preference levels have
 * no equivalent here, so those two are left out rather than guessed at.
 */
export const bestSubtitle = (streams, preferredLanguage) => {
	if (!streams?.length) return undefined;
	const preferred = normalizeLanguageCode(preferredLanguage);
	const ordered = streams.map((stream, position) => ({stream, position}));
	ordered.sort((a, b) => {
		const left = a.stream;
		const right = b.stream;
		return (languageRank(left, preferred) - languageRank(right, preferred)) ||
			// Commentary reads as dialogue until it starts, so it goes last.
			(isCommentary(left) - isCommentary(right)) ||
			// A bad external download must not beat the track already in the file.
			(Boolean(left.isExternal) - Boolean(right.isExternal)) ||
			(isSdh(left) - isSdh(right)) ||
			// Only matters when full subtitles were asked for, since a forced pick has
			// already narrowed the list to forced tracks.
			(Boolean(left.isForced) - Boolean(right.isForced)) ||
			(Boolean(right.isDefault) - Boolean(left.isDefault)) ||
			(a.position - b.position);
	});
	return ordered[0].stream;
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
		return bestSubtitle(streams, settings.subtitleLanguage);
	}

	if (settings.subtitleMode === 'forced') {
		return bestSubtitle(streams.filter((s) => s.isForced), settings.subtitleLanguage);
	}

	// The Jellyfin user's own preference, worked out server side from their
	// subtitle mode and language.
	if (settings.subtitleMode === 'default' &&
			result?.defaultSubtitleStreamIndex != null && result.defaultSubtitleStreamIndex >= 0) {
		return streams.find((s) => s.index === result.defaultSubtitleStreamIndex);
	}

	return undefined;
};
