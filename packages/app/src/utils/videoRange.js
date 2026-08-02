// Check for HDR in VideoRangeType
export const isHdrVideoStream = (videoStream) => {
	if (!videoStream) return false;
	const rangeType = (videoStream.VideoRangeType || '').toUpperCase();
	if (rangeType) return rangeType !== 'SDR';
	return (videoStream.VideoRange || '').toUpperCase() === 'HDR';
};

export const findVideoStream = (mediaSource) =>
	(mediaSource?.MediaStreams || []).find((s) => s.Type === 'Video') || null;

// If transcode no HDR anymore if original was HDR, so SDR style gets used.
export const isHdrOutput = (mediaSource, isTranscoding) => {
	if (isTranscoding) return false;
	return isHdrVideoStream(findVideoStream(mediaSource));
};
