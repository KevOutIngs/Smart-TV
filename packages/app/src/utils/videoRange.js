// Anything VideoRangeType names other than SDR is some HDR format, so a new one counts
// without a change here. VideoRange is the older coarse field and only fills in.
export const isHdrVideoStream = (videoStream) => {
	if (!videoStream) return false;
	const rangeType = (videoStream.VideoRangeType || '').toUpperCase();
	if (rangeType) return rangeType !== 'SDR';
	return (videoStream.VideoRange || '').toUpperCase() === 'HDR';
};

export const findVideoStream = (mediaSource) =>
	(mediaSource?.MediaStreams || []).find((s) => s.Type === 'Video') || null;

// What reaches the screen, not what sits on disk. A transcode drops the HDR metadata,
// so an HDR source arrives as SDR and wants the SDR style.
export const isHdrOutput = (mediaSource, isTranscoding) => {
	if (isTranscoding) return false;
	return isHdrVideoStream(findVideoStream(mediaSource));
};
