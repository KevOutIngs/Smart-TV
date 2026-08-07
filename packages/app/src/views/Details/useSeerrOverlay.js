// The Seerr side of a detail screen. A library title is matched to Seerr by its TMDB id, and
// anything that doesn't resolve leaves the overlay idle, so the screen renders exactly as it
// did before.

import {useCallback, useMemo, useState} from 'react';

import {useSeerr} from '../../context/SeerrContext';
import {normalizeMediaItem} from '../../utils/seerrHomeRows';
import {IDLE, seerrTargetFor} from '../../utils/seerrTarget';
import useSeerrDetailsData from './useSeerrDetailsData';
import useSeerrRequests from './useSeerrRequests';

const useSeerrOverlay = ({item}) => {
	const {isEnabled, isAuthenticated, user, displayName} = useSeerr();

	const target = useMemo(
		() => (isEnabled && isAuthenticated ? seerrTargetFor(item) : IDLE),
		[isEnabled, isAuthenticated, item]
	);

	// A lookup that comes back empty is the ordinary case for a title Seerr has never heard of,
	// so it stays quiet. A request that fails is the viewer's own action going wrong and has to
	// be said out loud, which is why the two errors are kept apart.
	const [actionError, setActionError] = useState(null);
	const clearActionError = useCallback(() => setActionError(null), []);

	const data = useSeerrDetailsData({
		mediaId: target.mediaId,
		mediaType: target.mediaType,
		contextUser: user
	});

	const requests = useSeerrRequests({
		mediaId: target.mediaId,
		mediaType: target.mediaType,
		details: data.details,
		setDetails: data.setDetails,
		setError: setActionError,
		isAuthenticated,
		userPermissions: data.userPermissions,
		hasHdServer: data.hasHdServer,
		has4kServer: data.has4kServer,
		hdStatus: data.hdStatus,
		status4k: data.status4k
	});

	// Seerr's rows arrive in its own shape, and both detail styles draw their rows with the
	// library's MediaCard, so they are converted once here rather than in each screen.
	const similarCards = useMemo(() => data.similar.map(normalizeMediaItem), [data.similar]);
	const recommendationCards = useMemo(() => data.recommendations.map(normalizeMediaItem), [data.recommendations]);

	const isActive = Boolean(target.mediaId && data.details);

	const {handleRequestTrack, handleCancelTrack} = requests;
	const onRequest = useCallback(() => handleRequestTrack(false), [handleRequestTrack]);
	const onRequest4k = useCallback(() => handleRequestTrack(true), [handleRequestTrack]);
	const onCancel = useCallback(() => handleCancelTrack(false), [handleCancelTrack]);
	const onCancel4k = useCallback(() => handleCancelTrack(true), [handleCancelTrack]);

	return {
		...data,
		...requests,
		similarCards,
		recommendationCards,
		displayName,
		mediaType: target.mediaType,
		isActive,
		onRequest,
		onRequest4k,
		onCancel,
		onCancel4k,
		actionError,
		clearActionError,
		// HD and 4K get a slot each, since they are tracked separately and a title already in
		// the library has its HD track filled. Worked out once so the two button rows agree
		// without restating the rules.
		showsRequest: isActive && (requests.hasOpenHdRequest || requests.canRequestHd),
		showsRequest4k: isActive && (requests.hasOpenFourKRequest || requests.canRequest4k),
		showsReportIssue: isActive && requests.canReportIssue,
		showsManage: isActive && requests.canManage && requests.pendingRequests.length > 0
	};
};

export default useSeerrOverlay;
