// Whoever muxed a file decides which of these three carries the label, so a
// track is only ruled in or out after all of them have been read.
export const streamTitleText = (stream) => [stream?.displayTitle, stream?.title, stream?.name]
	.filter((part) => typeof part === 'string')
	.join(' ')
	.toLowerCase();
