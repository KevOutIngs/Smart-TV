// The request flow: what the viewer is allowed to ask for, which popup that takes them
// through, and cancelling or reporting a problem afterwards. HD and 4K are tracked separately
// and each has its own control, so everything here works one track at a time.

import {useCallback, useMemo, useState} from 'react';
import $L from '@enact/i18n/$L';

import seerrApi, {canRequestMovies, canRequestTv, canRequest4kMovies, canRequest4kTv, hasAdvancedRequestPermission, canCreateIssues, canManageRequests} from '../../services/seerrApi';
import {MEDIA_STATUS, REQUEST_STATUS} from '../../utils/seerrStatus';
import {getStatusBadge, isSeasonRerequestable, isStatusBlocked, seasonMarkerStatus} from '../../utils/seerrBadges';

const useSeerrRequests = ({
	mediaId, mediaType, details, setDetails, setError, isAuthenticated,
	userPermissions, hasHdServer, has4kServer, hdStatus, status4k
}) => {
	const [requesting, setRequesting] = useState(false);
	const [showSeasonPopup, setShowSeasonPopup] = useState(false);
	const [showAdvancedPopup, setShowAdvancedPopup] = useState(false);
	const [pendingIs4k, setPendingIs4k] = useState(false);
	const [pendingSeasons, setPendingSeasons] = useState(null);
	const [showCancelPopup, setShowCancelPopup] = useState(false);
	// Which track the cancel popup is about.
	const [cancelScope, setCancelScope] = useState(false);
	const [showReportPopup, setShowReportPopup] = useState(false);
	const [showManagePopup, setShowManagePopup] = useState(false);

	const handleCloseSeasonPopup = useCallback(() => setShowSeasonPopup(false), []);
	const handleCloseAdvancedPopup = useCallback(() => setShowAdvancedPopup(false), []);
	const handleCloseCancelPopup = useCallback(() => setShowCancelPopup(false), []);
	const handleCloseReportPopup = useCallback(() => setShowReportPopup(false), []);
	const handleCloseManagePopup = useCallback(() => setShowManagePopup(false), []);

	// BACK dismisses the innermost popup. Handed back rather than installed on a handler ref,
	// because the detail screen already owns that ref for its own overlays and one of the two
	// would otherwise overwrite the other.
	const closeTopPopup = useCallback(() => {
		if (showManagePopup) { setShowManagePopup(false); return true; }
		if (showReportPopup) { setShowReportPopup(false); return true; }
		if (showAdvancedPopup) { setShowAdvancedPopup(false); return true; }
		if (showSeasonPopup) { setShowSeasonPopup(false); return true; }
		if (showCancelPopup) { setShowCancelPopup(false); return true; }
		return false;
	}, [showSeasonPopup, showAdvancedPopup, showCancelPopup, showReportPopup, showManagePopup]);

	// Issue reports need the seerr internal media id, so the title has to be at least
	// partially available on the server before the button is offered.
	const canReportIssue = useMemo(() => {
		if (!canCreateIssues(userPermissions)) return false;
		if (details?.mediaInfo?.id == null) return false;
		const watchable = [MEDIA_STATUS.PARTIALLY_AVAILABLE, MEDIA_STATUS.AVAILABLE];
		return watchable.indexOf(hdStatus) !== -1 || watchable.indexOf(status4k) !== -1;
	}, [userPermissions, details, hdStatus, status4k]);

	const handleReportIssueClick = useCallback(() => setShowReportPopup(true), []);

	const handleReportSubmit = useCallback(async ({issueType, message, problemSeason, problemEpisode}) => {
		try {
			await seerrApi.createIssue({
				issueType,
				message,
				mediaId: details.mediaInfo.id,
				problemSeason,
				problemEpisode
			});
			setShowReportPopup(false);
		} catch (err) {
			console.error('Issue report failed:', err.message);
		}
	}, [details]);

	const requests = useMemo(() => details?.mediaInfo?.requests ?? [], [details]);
	const hdDeclined = useMemo(() => requests.some(r => !r.is4k && r.status === REQUEST_STATUS.DECLINED), [requests]);
	const fourKDeclined = useMemo(() => requests.some(r => r.is4k && r.status === REQUEST_STATUS.DECLINED), [requests]);
	// Seerr's own rule for what is still open, and so what can be taken back. Approving or
	// declining, though, only applies to a request nobody has ruled on yet.
	const activeRequests = useMemo(() => requests.filter(
		r => r.status === REQUEST_STATUS.PENDING || r.status === REQUEST_STATUS.APPROVED
	), [requests]);
	const pendingRequests = useMemo(() => requests.filter(r => r.status === REQUEST_STATUS.PENDING), [requests]);
	const hasOpenHdRequest = useMemo(() => activeRequests.some(r => !r.is4k), [activeRequests]);
	const hasOpenFourKRequest = useMemo(() => activeRequests.some(r => r.is4k), [activeRequests]);

	const getSeasonStatusMap = useCallback((is4k) => {
		const statusMap = new Map();
		if (!requests || requests.length === 0) return statusMap;

		requests.forEach(req => {
			if (req.is4k === is4k) {
				req.seasons?.forEach(seasonReq => {
					const existingStatus = statusMap.get(seasonReq.seasonNumber);
					const newStatus = seasonReq.status;
					if (!existingStatus ||
						(isSeasonRerequestable(existingStatus) && !isSeasonRerequestable(newStatus)) ||
						(newStatus === REQUEST_STATUS.COMPLETED) ||
						(newStatus === REQUEST_STATUS.APPROVED && existingStatus === REQUEST_STATUS.PENDING)) {
						statusMap.set(seasonReq.seasonNumber, newStatus);
					}
				});
			}
		});
		return statusMap;
	}, [requests]);

	const seasonStatusMapHd = useMemo(() => getSeasonStatusMap(false), [getSeasonStatusMap]);
	const seasonStatusMap4k = useMemo(() => getSeasonStatusMap(true), [getSeasonStatusMap]);

	// What to mark each season card with, keyed by season number. The server keeps its own
	// per-season list and that wins where it exists, and the requests fill in the seasons it
	// says nothing about, which is how a brand new request shows before Seerr has caught up.
	const seasonMarkers = useMemo(() => {
		const markers = new Map();
		(details?.mediaInfo?.seasons || []).forEach((season) => {
			const status = season.status > MEDIA_STATUS.UNKNOWN ? season.status : season.status4k;
			if (status > MEDIA_STATUS.UNKNOWN) markers.set(season.seasonNumber, status);
		});
		seasonStatusMapHd.forEach((requestStatus, seasonNumber) => {
			if (markers.has(seasonNumber)) return;
			const status = seasonMarkerStatus(requestStatus);
			if (status) markers.set(seasonNumber, status);
		});
		return markers;
	}, [details, seasonStatusMapHd]);

	const isBlacklisted = useMemo(() =>
		hdStatus === MEDIA_STATUS.BLOCKLISTED || status4k === MEDIA_STATUS.BLOCKLISTED,
	[hdStatus, status4k]);

	const canRequestHd = useMemo(() => {
		if (!isAuthenticated || isBlacklisted) return false;
		const blocked = isStatusBlocked(hdStatus) || hdDeclined;
		if (blocked) return false;
		const userCanHd = mediaType === 'movie'
			? canRequestMovies(userPermissions)
			: canRequestTv(userPermissions);
		return userCanHd && hasHdServer;
	}, [isAuthenticated, isBlacklisted, hdStatus, hdDeclined, userPermissions, hasHdServer, mediaType]);

	const canRequest4k = useMemo(() => {
		if (!isAuthenticated || isBlacklisted) return false;
		const blocked = isStatusBlocked(status4k) || fourKDeclined;
		if (blocked) return false;
		const userCan4k = mediaType === 'movie'
			? canRequest4kMovies(userPermissions)
			: canRequest4kTv(userPermissions);
		return userCan4k && has4kServer;
	}, [isAuthenticated, isBlacklisted, status4k, fourKDeclined, userPermissions, has4kServer, mediaType]);

	const hasAdvanced = useMemo(() =>
		hasAdvancedRequestPermission(userPermissions),
	[userPermissions]);

	const statusBadge = useMemo(() =>
		getStatusBadge(hdStatus, status4k, hdDeclined, fourKDeclined),
	[hdStatus, status4k, hdDeclined, fourKDeclined]
	);

	const reloadDetails = useCallback(async () => {
		const updated = mediaType === 'movie'
			? await seerrApi.getMovie(mediaId)
			: await seerrApi.getTv(mediaId);
		setDetails(updated);
	}, [mediaId, mediaType, setDetails]);

	// What each track's control says. Taking a request back wins over asking for more, so the
	// viewer is offered the thing they can still change rather than told what they already know.
	const requestLabel = useMemo(() => {
		if (hasOpenHdRequest) return $L('Cancel Request');
		return hdStatus === MEDIA_STATUS.PARTIALLY_AVAILABLE ? $L('Request More') : $L('Request');
	}, [hasOpenHdRequest, hdStatus]);

	const requestLabel4k = useMemo(() => {
		if (hasOpenFourKRequest) return $L('Cancel 4K Request');
		return status4k === MEDIA_STATUS.PARTIALLY_AVAILABLE ? $L('Request More 4K') : $L('Request 4K');
	}, [hasOpenFourKRequest, status4k]);

	const handleRequest = useCallback(async (is4K = false, seasons = null, advancedOptions = null) => {
		if (requesting) return;

		setShowSeasonPopup(false);
		setShowAdvancedPopup(false);
		setRequesting(true);
		try {
			const options = {
				is4k: is4K,
				...(advancedOptions || {})
			};

			if (mediaType === 'movie') {
				await seerrApi.requestMovie(mediaId, options);
			} else {
				await seerrApi.requestTv(mediaId, {
					...options,
					seasons: seasons || 'all'
				});
			}
			await reloadDetails();
		} catch (err) {
			console.error('Request failed:', err);
			setError(err.message || $L('Request failed'));
		} finally {
			setRequesting(false);
		}
	}, [mediaId, mediaType, requesting, reloadDetails, setError]);

	const proceedWithRequest = useCallback((is4K, seasons = null) => {
		if (hasAdvanced) {
			setPendingIs4k(is4K);
			setPendingSeasons(seasons);
			setShowAdvancedPopup(true);
		} else {
			handleRequest(is4K, seasons);
		}
	}, [hasAdvanced, handleRequest]);

	// A series asks which seasons first, everything else goes straight on to the request.
	const handleRequestTrack = useCallback((is4k) => {
		if (mediaType === 'tv' && details?.seasons?.length > 0) {
			setPendingIs4k(is4k);
			setShowSeasonPopup(true);
			return;
		}
		proceedWithRequest(is4k);
	}, [mediaType, details?.seasons, proceedWithRequest]);

	const handleSeasonConfirm = useCallback((selectedSeasons) => {
		proceedWithRequest(pendingIs4k, selectedSeasons);
	}, [pendingIs4k, proceedWithRequest]);

	const handleAdvancedConfirm = useCallback((advancedOptions) => {
		handleRequest(pendingIs4k, pendingSeasons, advancedOptions);
	}, [pendingIs4k, pendingSeasons, handleRequest]);

	const handleCancelTrack = useCallback((is4k) => {
		setCancelScope(is4k);
		setShowCancelPopup(true);
	}, []);

	const cancelTargets = useMemo(
		() => activeRequests.filter(r => Boolean(r.is4k) === cancelScope),
		[activeRequests, cancelScope]
	);

	const handleCancelConfirm = useCallback(async () => {
		setShowCancelPopup(false);
		try {
			for (const req of cancelTargets) {
				await seerrApi.cancelRequest(req.id);
			}
			await reloadDetails();
		} catch (err) {
			console.error('Cancel failed:', err);
			setError(err.message || $L('Failed to cancel request'));
		}
	}, [cancelTargets, reloadDetails, setError]);

	// Approving and declining are offered on the title itself, so a moderator doesn't have to
	// find their way to the requests screen for something already in front of them.
	const canManage = useMemo(() => canManageRequests(userPermissions), [userPermissions]);

	const handleManageRequestsClick = useCallback(() => setShowManagePopup(true), []);

	const handleResolveRequest = useCallback(async (requestId, approved) => {
		try {
			if (approved) {
				await seerrApi.approveRequest(requestId);
			} else {
				await seerrApi.declineRequest(requestId);
			}
			await reloadDetails();
		} catch (err) {
			console.error('Request update failed:', err);
			setError(err.message || $L('Failed to update request'));
		}
	}, [reloadDetails, setError]);

	return {
		activeRequests,
		cancelTargets,
		canManage,
		canReportIssue,
		canRequest4k,
		canRequestHd,
		closeTopPopup,
		fourKDeclined,
		handleAdvancedConfirm,
		handleCancelConfirm,
		handleCloseAdvancedPopup,
		handleCloseCancelPopup,
		handleCloseManagePopup,
		handleCloseReportPopup,
		handleCancelTrack,
		handleCloseSeasonPopup,
		handleManageRequestsClick,
		handleReportIssueClick,
		handleReportSubmit,
		handleRequestTrack,
		handleResolveRequest,
		handleSeasonConfirm,
		hasAdvanced,
		hasOpenHdRequest,
		hasOpenFourKRequest,
		hdDeclined,
		pendingIs4k,
		pendingRequests,
		requestLabel,
		requestLabel4k,
		seasonMarkers,
		seasonStatusMap4k,
		seasonStatusMapHd,
		showAdvancedPopup,
		showCancelPopup,
		showManagePopup,
		showReportPopup,
		showSeasonPopup,
		statusBadge
	};
};

export default useSeerrRequests;
