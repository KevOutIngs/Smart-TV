import $L from '@enact/i18n/$L';

// Music and video players have different playback time labels.
// The video player has six, the music player has one.
export const PLAYBACK_TIME_SLOTS = ['none', 'elapsed', 'totalDuration', 'timeRemaining', 'endsAt'];

export const PLAYBACK_TIME_DISPLAYS = ['totalDuration', 'timeRemaining', 'endsAt'];

const pad = (value) => String(value).padStart(2, '0');

const atLeastZero = (seconds) => (Number.isFinite(seconds) && seconds > 0 ? seconds : 0);

// `h:mm:ss`, dropping the hour part when it is zero.
export const formatPlaybackDuration = (seconds) => {
	const total = Math.floor(atLeastZero(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;

	if (h > 0) {
		return `${h}:${pad(m)}:${pad(s)}`;
	}
	return `${m}:${pad(s)}`;
};

// Wall-clock time playback finishes at, e.g. `Ends at 21:45`. Returns an empty string
// when there is nothing left to play so we fall back.
export const formatPlaybackEndsAt = (remainingSeconds, clockDisplay) => {
	// Rounding is what makes the last half second read as zero, so the label hands over
	// to the total duration instead of promising an end time that has already passed.
	const wallSeconds = Math.round(atLeastZero(remainingSeconds));
	if (wallSeconds <= 0) return '';

	const end = new Date(Date.now() + (wallSeconds * 1000));
	const hours = end.getHours();
	const minutes = end.getMinutes();
	const time = clockDisplay === '12-hour'
		? `${hours % 12 || 12}:${pad(minutes)} ${hours >= 12 ? 'PM' : 'AM'}`
		: `${pad(hours)}:${pad(minutes)}`;

	return $L('Ends at {time}').replace('{time}', time);
};

// Falls back to the total duration whenever the chosen mode has nothing to work with,
// such as a stream with no known length.
export const formatPlaybackTrailingTime = ({mode, position, duration, clockDisplay}) => {
	switch (mode) {
		case 'timeRemaining':
			if (!(duration > 0)) return formatPlaybackDuration(duration);
			return `-${formatPlaybackDuration(duration - position)}`;
		case 'endsAt': {
			if (!(duration > 0)) return formatPlaybackDuration(duration);
			const label = formatPlaybackEndsAt(duration - position, clockDisplay);
			return label || formatPlaybackDuration(duration);
		}
		default:
			return formatPlaybackDuration(duration);
	}
};

// An empty string means the slot is hidden.
export const formatPlaybackTimeSlot = ({slot, position, duration, clockDisplay}) => {
	switch (slot) {
		case 'elapsed':
			return formatPlaybackDuration(position);
		case 'totalDuration':
			return formatPlaybackDuration(duration);
		case 'timeRemaining':
		case 'endsAt':
			return formatPlaybackTrailingTime({mode: slot, position, duration, clockDisplay});
		default:
			return '';
	}
};
