// A television decoder runs a little slow and loses wall clock time on every
// rebuffer, so a group that only corrects on commands drifts further behind for
// as long as it plays. These work out what to do about a measured drift.

export const TICKS_PER_MS = 10000;

// Drift this large is past nudging, so the position is taken outright.
export const SKIP_THRESHOLD_MS = 2000;
// Below this the group is close enough that correcting would show more than it fixes.
export const SPEED_MIN_MS = 100;
// Above this a rate nudge would take too long to close the gap.
export const SPEED_MAX_MS = 5000;
export const SPEED_DURATION_MS = 1000;
// How often playback is measured against the group.
export const DRIFT_CHECK_MS = 2000;
export const SLOW_RATE = 0.95;
export const FAST_RATE = 1.05;

// Half the server's own 500ms MaxPlaybackOffset, so skipping a seek this small
// still leaves us inside what it would accept, and avoids a rebuffer that costs
// these sets far more than the drift did.
export const SEEK_TOLERANCE_MS = 250;

// Where the group should be now, given the position and server time it was last
// known to be at.
export const expectedPositionTicks = (reference, serverNowMs) => {
	if (!reference) return null;
	const elapsed = Math.max(0, serverNowMs - reference.serverTimeMs);
	return reference.positionTicks + elapsed * TICKS_PER_MS;
};

// Positive means this player is ahead of the group.
export const driftMs = (currentTicks, expectedTicks) => {
	if (expectedTicks == null || currentTicks == null) return null;
	return Math.round((currentTicks - expectedTicks) / TICKS_PER_MS);
};

export const driftAction = (drift, {useSkip = true, useSpeed = true} = {}) => {
	if (drift == null) return {type: 'none'};
	const size = Math.abs(drift);
	if (useSkip && size > SKIP_THRESHOLD_MS) return {type: 'seek'};
	if (useSpeed && size > SPEED_MIN_MS && size < SPEED_MAX_MS) {
		return {type: 'rate', rate: drift > 0 ? SLOW_RATE : FAST_RATE};
	}
	return {type: 'none'};
};

export const needsSeek = (currentTicks, targetTicks) => {
	if (targetTicks == null || currentTicks == null) return true;
	return Math.abs(currentTicks - targetTicks) / TICKS_PER_MS > SEEK_TOLERANCE_MS;
};
