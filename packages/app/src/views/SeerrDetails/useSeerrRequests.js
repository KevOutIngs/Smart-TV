// The request flow: what the viewer is allowed to ask for, which popup that takes them
// through, and cancelling or reporting a problem afterwards.

import {useCallback, useEffect, useMemo, useState} from 'react';
import $L from '@enact/i18n/$L';

import seerrApi, {canRequestMovies, canRequestTv, canRequest4kMovies, canRequest4kTv, hasAdvancedRequestPermission, canCreateIssues} from '../../services/seerrApi';
import {MEDIA_STATUS, REQUEST_STATUS} from '../../utils/seerrStatus';
import {getStatusBadge, isSeasonRerequestable, isStatusBlocked} from './seerrBadges';

const useSeerrRequests = ({
	mediaId, mediaType, details, setDetails, setError, isAuthenticated,
	userPermissions, hasHdServer, has4kServer, hdStatus, status4k, backHandlerRef
}) => {
	const [requesting, setRequesting] = useState(false);
	const [showQualityPopup, setShowQualityPopup] = useState(false);
	const [showSeasonPopup, setShowSeasonPopup] = useState(false);
	const [showAdvancedPopup, setShowAdvancedPopup] = useState(false);
	const [pendingIs4k, setPendingIs4k] = useState(false);
	const [pendingSeasons, setPendingSeasons] = useState(null);
	const [showCancelPopup, setShowCancelPopup] = useState(false);
	const [showReportPopup, setShowReportPopup] = useState(false);

	const handleCloseQualityPopup = useCallback(() => setShowQualityPopup(false), []);
	const handleCloseSeasonPopup = useCallback(() => setShowSeasonPopup(false), []);
	const handleCloseAdvancedPopup = useCallback(() => setShowAdvancedPopup(false), []);
	const handleCloseCancelPopup = useCallback(() => setShowCancelPopup(false), []);
	const handleCloseReportPopup = useCallback(() => setShowReportPopup(false), []);

	useEffect(() => {
		if (!backHandlerRef) return undefined;
		const handler = () => {
			if (showReportPopup) { setShowReportPopup(false); return true; }
			if (showAdvancedPopup) { setShowAdvancedPopup(false); return true; }
			if (showSeasonPopup) { setShowSeasonPopup(false); return true; }
			if (showQualityPopup) { setShowQualityPopup(false); return true; }
			if (showCancelPopup) { setShowCancelPopup(false); return true; }
			return false;
		};
		backHandlerRef.current = handler;
		return () => { if (backHandlerRef.current === handler) backHandlerRef.current = null; };
	}, [backHandlerRef, showQualityPopup, showSeasonPopup, showAdvancedPopup, showCancelPopup, showReportPopup]);

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
			console.error('[SeerrDetails] Issue report failed:', err.message);
		}
	}, [details]);

	const requests = useMemo(() => details?.mediaInfo?.requests ?? [], [details]);
	const hdDeclined = useMemo(() => requests.some(r => !r.is4k && r.status === REQUEST_STATUS.DECLINED), [requests]);
	const fourKDeclined = useMemo(() => requests.some(r => r.is4k && r.status === REQUEST_STATUS.DECLINED), [requests]);
	const pendingRequests = useMemo(() => requests.filter(r => r.status === MEDIA_STATUS.PENDING), [requests]);

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

	const canRequestAny = canRequestHd || canRequest4k;

	const hasAdvanced = useMemo(() =>
		hasAdvancedRequestPermission(userPermissions),
	[userPermissions]);

	const statusBadge = useMemo(() =>
		getStatusBadge(hdStatus, status4k, hdDeclined, fourKDeclined),
	[hdStatus, status4k, hdDeclined, fourKDeclined]
	);

	const requestButtonLabel = useMemo(() => {
		if (!canRequestAny) {
			if (hdDeclined && fourKDeclined) return $L('Declined');
			if (fourKDeclined) return `4K ${$L('Declined')}`;
			if (hdDeclined) return `HD ${$L('Declined')}`;
			if (hdStatus === MEDIA_STATUS.AVAILABLE && status4k === MEDIA_STATUS.AVAILABLE) return $L('Available');
			if (status4k === MEDIA_STATUS.AVAILABLE) return `4K ${$L('Available')}`;
			if (hdStatus === MEDIA_STATUS.AVAILABLE) return `HD ${$L('Available')}`;
			if (hdStatus === MEDIA_STATUS.PROCESSING && status4k === MEDIA_STATUS.PROCESSING) return $L('Processing');
			if (status4k === MEDIA_STATUS.PROCESSING) return `4K ${$L('Processing')}`;
			if (hdStatus === MEDIA_STATUS.PROCESSING) return `HD ${$L('Processing')}`;
			if (hdStatus === MEDIA_STATUS.PENDING && status4k === MEDIA_STATUS.PENDING) return $L('Pending');
			if (status4k === MEDIA_STATUS.PENDING) return `4K ${$L('Pending')}`;
			if (hdStatus === MEDIA_STATUS.PENDING) return `HD ${$L('Pending')}`;
			if (hdStatus === MEDIA_STATUS.BLOCKLISTED || status4k === MEDIA_STATUS.BLOCKLISTED) return $L('Blacklisted');
			return $L('Unavailable');
		}
		if (hdStatus === MEDIA_STATUS.PARTIALLY_AVAILABLE || status4k === MEDIA_STATUS.PARTIALLY_AVAILABLE) return $L('Request More');
		return $L('Request');
	}, [canRequestAny, hdStatus, status4k, hdDeclined, fourKDeclined]);

	const handleRequest = useCallback(async (is4K = false, seasons = null, advancedOptions = null) => {
		if (requesting) return;

		setShowQualityPopup(false);
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
			const updated = mediaType === 'movie'
				? await seerrApi.getMovie(mediaId)
				: await seerrApi.getTv(mediaId);
			setDetails(updated);
		} catch (err) {
			console.error('Request failed:', err);
			setError(err.message || $L('Request failed'));
		} finally {
			setRequesting(false);
		}
	}, [mediaId, mediaType, requesting, setDetails, setError]);

	const proceedWithRequest = useCallback((is4K, seasons = null) => {
		if (hasAdvanced) {
			setPendingIs4k(is4K);
			setPendingSeasons(seasons);
			setShowAdvancedPopup(true);
		} else {
			handleRequest(is4K, seasons);
		}
	}, [hasAdvanced, handleRequest]);

	const handleQualitySelect = useCallback((is4K) => {
		setShowQualityPopup(false);
		if (mediaType === 'tv' && details?.seasons?.length > 0) {
			setPendingIs4k(is4K);
			setShowSeasonPopup(true);
		} else {
			proceedWithRequest(is4K);
		}
	}, [mediaType, details?.seasons, proceedWithRequest]);

	const handleSeasonConfirm = useCallback((selectedSeasons) => {
		proceedWithRequest(pendingIs4k, selectedSeasons);
	}, [pendingIs4k, proceedWithRequest]);

	const handleAdvancedConfirm = useCallback((advancedOptions) => {
		handleRequest(pendingIs4k, pendingSeasons, advancedOptions);
	}, [pendingIs4k, pendingSeasons, handleRequest]);

	const handleRequestClick = useCallback(() => {
		if (!canRequestAny) return;

		if (!hasHdServer && !has4kServer) {
			const mediaTypeName = mediaType === 'movie' ? $L('movies') : $L('TV shows');
			setError($L('No Radarr/Sonarr server configured for {mediaType} in Seerr').replace('{mediaType}', mediaTypeName));
			return;
		}

		if (canRequestHd && canRequest4k) {
			setShowQualityPopup(true);
		} else if (canRequest4k) {
			if (mediaType === 'tv' && details?.seasons?.length > 0) {
				setPendingIs4k(true);
				setShowSeasonPopup(true);
			} else {
				proceedWithRequest(true);
			}
		} else if (canRequestHd) {
			if (mediaType === 'tv' && details?.seasons?.length > 0) {
				setPendingIs4k(false);
				setShowSeasonPopup(true);
			} else {
				proceedWithRequest(false);
			}
		}
	}, [canRequestAny, canRequestHd, canRequest4k, proceedWithRequest, hasHdServer, has4kServer, mediaType, details?.seasons, setError]);

	const handleCancelRequestClick = useCallback(() => {
		if (pendingRequests.length > 0) {
			setShowCancelPopup(true);
		}
	}, [pendingRequests]);

	const handleCancelConfirm = useCallback(async () => {
		setShowCancelPopup(false);
		try {
			for (const req of pendingRequests) {
				await seerrApi.cancelRequest(req.id);
			}
			const updated = mediaType === 'movie'
				? await seerrApi.getMovie(mediaId)
				: await seerrApi.getTv(mediaId);
			setDetails(updated);
		} catch (err) {
			console.error('Cancel failed:', err);
			setError(err.message || $L('Failed to cancel request'));
		}
	}, [pendingRequests, mediaId, mediaType, setDetails, setError]);

	return {
		canReportIssue,
		canRequest4k,
		canRequestAny,
		canRequestHd,
		handleAdvancedConfirm,
		handleCancelConfirm,
		handleCancelRequestClick,
		handleCloseAdvancedPopup,
		handleCloseCancelPopup,
		handleCloseQualityPopup,
		handleCloseReportPopup,
		handleCloseSeasonPopup,
		handleQualitySelect,
		handleReportIssueClick,
		handleReportSubmit,
		handleRequestClick,
		handleSeasonConfirm,
		hasAdvanced,
		pendingIs4k,
		pendingRequests,
		requestButtonLabel,
		seasonStatusMap4k,
		seasonStatusMapHd,
		showAdvancedPopup,
		showCancelPopup,
		showQualityPopup,
		showReportPopup,
		showSeasonPopup,
		statusBadge
	};
};

export default useSeerrRequests;
