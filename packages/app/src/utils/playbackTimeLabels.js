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
export const formatPlaybackEndsAt = (remainingSeconds, clockDisplay, playbackSpeed = 1) => {
	const speed = playbackSpeed > 0 ? playbackSpeed : 1;
	const wallSeconds = Math.round(atLeastZero(remainingSeconds) / speed);
	if (wallSeconds <= 0) return '';

	const end = new Date(Date.now() + (wallSeconds * 1000));
	const hours = end.getHours();
	const minutes = end.getMinutes();
	const time = clockDisplay === '12-hour'
		? `${hours % 12 || 12}:${pad(minutes)} ${hours >= 12 ? 'PM' : 'AM'}`
		: `${pad(hours)}:${pad(minutes)}`;

	return $L('Ends at {time}').replace('{time}', time);
};

// checks if time remaining or ends at is valid, if not total duration is used.
export const playbackTimeDisplayForSlot = (slot) => (
	(slot === 'timeRemaining' || slot === 'endsAt') ? slot : 'totalDuration'
);

// Displays one of [PLAYBACK_TIME_DISPLAYS]. Fall back to total duration when live tv for example does not have a valid time frame.
export const formatPlaybackTrailingTime = ({mode, position, duration, clockDisplay, playbackSpeed = 1}) => {
	switch (mode) {
		case 'timeRemaining':
			if (!(duration > 0)) return formatPlaybackDuration(duration);
			return `-${formatPlaybackDuration(duration - position)}`;
		case 'endsAt': {
			if (!(duration > 0)) return formatPlaybackDuration(duration);
			const label = formatPlaybackEndsAt(duration - position, clockDisplay, playbackSpeed);
			return label || formatPlaybackDuration(duration);
		}
		default:
			return formatPlaybackDuration(duration);
	}
};

// Displays one of [PLAYBACK_TIME_SLOTS]. An empty string means the slot is hidden.
export const formatPlaybackTimeSlot = ({slot, position, duration, clockDisplay, playbackSpeed = 1}) => {
	switch (slot) {
		case 'elapsed':
			return formatPlaybackDuration(position);
		case 'totalDuration':
		case 'timeRemaining':
		case 'endsAt':
			return formatPlaybackTrailingTime({
				mode: playbackTimeDisplayForSlot(slot),
				position,
				duration,
				clockDisplay,
				playbackSpeed
			});
		default:
			return '';
	}
};
