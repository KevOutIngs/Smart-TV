import $L from '@enact/i18n/$L';

// A file carrying pt-BR, pt-BR closed caption and pt-PT offers three rows all reading
// Portuguese, so number every row and say what the track is and where it comes from.
// That is what tells them apart and shows which ones have already been tried.

export const numberedTrackName = (position, title) =>
	`${position} - ${title || `${$L('Track')} ${position}`}`;

export const subtitleTrackDetail = ({codec, isExternal, deliveryMethod, isForced}) => {
	const parts = [codec ? codec.toUpperCase() : $L('Unknown')];
	if (isExternal) {
		parts.push($L('External'));
	} else if ((deliveryMethod || '').toLowerCase() === 'embed') {
		parts.push($L('Embedded'));
	} else {
		parts.push($L('Internal'));
	}
	if (isForced) parts.push($L('Forced'));
	return parts.join(' · ');
};

// A track with no title already shows its language as the name, so the language only
// earns a place here alongside one.
export const audioTrackDetail = ({language, displayTitle, codec, channels}) => {
	const parts = [];
	if (language && displayTitle) parts.push(language);
	if (codec) parts.push(codec.toUpperCase());
	if (channels) parts.push(`${channels}ch`);
	return parts.join(' · ');
};
