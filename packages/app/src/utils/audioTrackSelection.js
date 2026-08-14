import {normalizeLanguageCode} from './audioLanguage';

// Picks the audio track a fresh playback should start on, the same way the other
// clients do: skip commentary, respect the audio description preference, honor the
// default track shortcut, then match preferred language, fallback language, and
// English before falling back to the best remaining track.

const COMMENTARY = /\b(commentary|commentaries)\b/i;
const AUDIO_DESCRIPTION = /\b(audio\s+description|descriptive\s+audio|visual\s+description|descriptive|description|ad)\b/i;

const titleOf = (stream) => stream?.displayTitle || '';

const isCommentaryAudio = (stream) => COMMENTARY.test(titleOf(stream));

const isAudioDescription = (stream) =>
	stream?.isAudioDescription === true || AUDIO_DESCRIPTION.test(titleOf(stream));

const channelsOf = (stream) => (typeof stream?.channels === 'number' ? stream.channels : 0);

// Higher is better. The default flag outranks channel count only when the user
// asked for default tracks, otherwise it is just a tiebreak after channels.
const rank = (stream, settings) => {
	let score = 0;
	if (settings?.preferAudioDescription && isAudioDescription(stream)) score += 1000000;
	if (settings?.preferDefaultAudioTrack && stream?.isDefault) score += 100000;
	score += channelsOf(stream) * 10;
	if (!settings?.preferDefaultAudioTrack && stream?.isDefault) score += 1;
	return score;
};

const bestOf = (candidates, settings) => {
	if (!candidates.length) return null;
	let best = candidates[0];
	let bestScore = rank(best, settings);
	for (let i = 1; i < candidates.length; i++) {
		const score = rank(candidates[i], settings);
		if (score > bestScore) {
			best = candidates[i];
			bestScore = score;
		}
	}
	return best;
};

const matchLanguage = (candidates, language) => {
	const wanted = normalizeLanguageCode(language);
	if (!wanted) return [];
	return candidates.filter((stream) => normalizeLanguageCode(stream.language) === wanted);
};

export const selectPreferredAudioStream = (audioStreams, settings = {}) => {
	if (!Array.isArray(audioStreams) || audioStreams.length === 0) return null;

	let candidates = audioStreams.filter((stream) => !isCommentaryAudio(stream));
	if (!candidates.length) candidates = audioStreams;

	if (!settings.preferAudioDescription) {
		const withoutAd = candidates.filter((stream) => !isAudioDescription(stream));
		if (withoutAd.length) candidates = withoutAd;
	}

	if (settings.preferDefaultAudioTrack) {
		const defaults = candidates.filter((stream) => stream.isDefault);
		if (defaults.length) return bestOf(defaults, settings);
	}

	const preferred = matchLanguage(candidates, settings.audioLanguage);
	if (preferred.length) return bestOf(preferred, settings);

	const fallback = matchLanguage(candidates, settings.fallbackAudioLanguage);
	if (fallback.length) return bestOf(fallback, settings);

	const english = matchLanguage(candidates, 'eng');
	if (english.length) return bestOf(english, settings);

	return bestOf(candidates, settings);
};
