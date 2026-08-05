// Facts about an item that the detail screen reads off its media source, plus the small
// lists that decide which actions an item type is allowed to offer.

import $L from '@enact/i18n/$L';

// Caps that match the mobile clients, so a title forced down on one device looks the
// same on the others. The server transcodes to fit whichever is chosen.
export const TRANSCODE_QUALITIES = [
	{bitrate: 4000000, label: () => $L('High Quality (1080p)')},
	{bitrate: 2000000, label: () => $L('Medium Quality (720p)')},
	{bitrate: 1000000, label: () => $L('Low Quality (480p)')}
];

// Item types a Jellyfin/Emby collection will accept as a member.
export const COLLECTION_ITEM_TYPES = ['Movie', 'Series', 'Season', 'Episode', 'Video', 'MusicVideo', 'BoxSet'];

export const IDENTIFIABLE_TYPES = ['Movie', 'Series', 'Season', 'Episode', 'BoxSet', 'Person', 'MusicAlbum', 'MusicArtist', 'Book', 'Trailer', 'MusicVideo'];

export const shuffleArray = (arr) => {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

export const getMediaBadges = (item, versionIndex = 0) => {
	const badges = [];
	const mediaSource = item.MediaSources?.[versionIndex] || item.MediaSources?.[0];
	const streams = mediaSource?.MediaStreams || [];
	const video = streams.find(s => s.Type === 'Video');
	const audio = streams.find(s => s.Type === 'Audio');

	if (video) {
		if (video.Width >= 3800) badges.push({type: 'badge4k', label: $L('4K')});
		else if (video.Width >= 1900) badges.push({type: 'badgeHd', label: $L('1080p')});
		else if (video.Width >= 1260) badges.push({type: 'badgeHd', label: $L('720p')});

		const rangeType = video.VideoRangeType;
		if (rangeType === 'DOVIWithHDR10' || rangeType === 'DOVI' || rangeType === 'DOVIWithHDR10Plus') {
			badges.push({type: 'badgeDv', label: $L('DV')});
		}
		if (rangeType && rangeType !== 'SDR') {
			if (rangeType.includes('HDR10Plus')) badges.push({type: 'badgeHdr', label: $L('HDR10+')});
			else if (rangeType.includes('HDR10') || rangeType === 'DOVIWithHDR10') badges.push({type: 'badgeHdr', label: $L('HDR10')});
			else if (rangeType !== 'DOVI') badges.push({type: 'badgeHdr', label: $L('HDR')});
		} else if (video.VideoRange === 'HDR') {
			badges.push({type: 'badgeHdr', label: $L('HDR')});
		}

		const videoCodec = video.Codec?.toUpperCase();
		if (videoCodec) {
			const codecLabel = videoCodec === 'HEVC' ? 'HEVC' : videoCodec === 'AV1' ? 'AV1' : videoCodec === 'H264' ? 'H.264' : videoCodec === 'VP9' ? 'VP9' : videoCodec;
			badges.push({type: 'badgeCodec', label: codecLabel});
		}
	}

	const container = mediaSource?.Container?.toUpperCase();
	if (container) {
		badges.push({type: 'badgeContainer', label: container});
	}

	if (audio) {
		if (audio.Profile?.includes('Atmos') || audio.Title?.includes('Atmos')) {
			badges.push({type: 'badgeAtmos', label: $L('ATMOS')});
		} else if (audio.Profile?.includes('DTS:X') || audio.Title?.includes('DTS:X')) {
			badges.push({type: 'badgeDtsx', label: $L('DTS:X')});
		} else if (audio.Channels > 6) {
			badges.push({type: 'badgeSurround', label: `${audio.Channels - 1}.1`});
		} else if (audio.Channels === 6) {
			badges.push({type: 'badgeSurround', label: '5.1'});
		} else if (audio.Channels === 2) {
			badges.push({type: 'badgeSurround', label: $L('Stereo')});
		}

		const audioCodec = audio.Codec?.toUpperCase();
		if (audioCodec) {
			const audioLabel = audioCodec === 'AAC' ? 'AAC' : audioCodec === 'AC3' ? 'AC3' : audioCodec === 'EAC3' ? 'EAC3' : audioCodec === 'FLAC' ? 'FLAC' : audioCodec === 'DTS' ? 'DTS' : audioCodec === 'TRUEHD' ? 'TrueHD' : audioCodec;
			badges.push({type: 'badgeAudioCodec', label: audioLabel});
		}
	}

	return badges;
};
