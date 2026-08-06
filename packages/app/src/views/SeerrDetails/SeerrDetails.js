import {useCallback, useEffect, useState, useRef, useMemo} from 'react';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Image from '@enact/sandstone/Image';
import $L from '@enact/i18n/$L';
import seerrApi, {canRequestMovies, canRequestTv, canRequest4kMovies, canRequest4kTv, hasAdvancedRequestPermission, canCreateIssues} from '../../services/seerrApi';
import {isLegacyTizen} from '../../platform';
import {useSeerr} from '../../context/SeerrContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import SeerrDownloadProgress from '../../components/SeerrDownloadProgress';
import {MEDIA_STATUS, REQUEST_STATUS, getMediaDownloadSummary} from '../../utils/seerrStatus';
import {KEYS} from '../../utils/keys';
import css from './SeerrDetails.module.less';

import {formatCurrency, formatDate, formatRuntime, getStatusBadge, isSeasonRerequestable, isStatusBlocked} from './seerrBadges';
import {LastFocusedContainer, SpottableDiv, safeFocus} from './seerrFocus';
import {CastCard, HorizontalMediaRow, KeywordTag} from './SeerrCards';
import {AdvancedOptionsPopup} from './AdvancedOptionsPopup';
import {CancelRequestPopup} from './CancelRequestPopup';
import {QualitySelectionPopup} from './QualitySelectionPopup';
import {ReportIssuePopup} from './ReportIssuePopup';
import {SeasonSelectionPopup} from './SeasonSelectionPopup';

const KeywordsSectionContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	restrict: 'self-only'
}, 'div');

const supportsExternalTrailerSearch = !isLegacyTizen();

const SeerrDetails = ({mediaType, mediaId, onClose, onSelectItem, onPlayInMoonfin, onSelectPerson, onSelectKeyword, onBack, onOpenCollection, backHandlerRef}) => {
	const {isAuthenticated, user: contextUser} = useSeerr();
	const [details, setDetails] = useState(null);
	const [loading, setLoading] = useState(true);
	const [requesting, setRequesting] = useState(false);
	const [error, setError] = useState(null);
	const [recommendations, setRecommendations] = useState([]);
	const [similar, setSimilar] = useState([]);
	const [showQualityPopup, setShowQualityPopup] = useState(false);
	const [showSeasonPopup, setShowSeasonPopup] = useState(false);
	const [showAdvancedPopup, setShowAdvancedPopup] = useState(false);
	const [pendingIs4k, setPendingIs4k] = useState(false);
	const [pendingSeasons, setPendingSeasons] = useState(null);
	const [showCancelPopup, setShowCancelPopup] = useState(false);
	const [showReportPopup, setShowReportPopup] = useState(false);
	const [quota, setQuota] = useState(null);
	const [userPermissions, setUserPermissions] = useState(null);
	const [has4kServer, setHas4kServer] = useState(false);
	const [hasHdServer, setHasHdServer] = useState(false);
	const [servers, setServers] = useState([]);
	const contentRef = useRef(null);

	const handleCloseQualityPopup = useCallback(() => setShowQualityPopup(false), []);
	const handleCloseSeasonPopup = useCallback(() => setShowSeasonPopup(false), []);
	const handleCloseAdvancedPopup = useCallback(() => setShowAdvancedPopup(false), []);
	const handleCloseCancelPopup = useCallback(() => setShowCancelPopup(false), []);
	const handleCloseReportPopup = useCallback(() => setShowReportPopup(false), []);

	useEffect(() => {
		if (!backHandlerRef) return;
		backHandlerRef.current = () => {
			if (showReportPopup) { setShowReportPopup(false); return true; }
			if (showAdvancedPopup) { setShowAdvancedPopup(false); return true; }
			if (showSeasonPopup) { setShowSeasonPopup(false); return true; }
			if (showQualityPopup) { setShowQualityPopup(false); return true; }
			if (showCancelPopup) { setShowCancelPopup(false); return true; }
			return false;
		};
		return () => { if (backHandlerRef) backHandlerRef.current = null; };
	}, [backHandlerRef, showQualityPopup, showSeasonPopup, showAdvancedPopup, showCancelPopup, showReportPopup]);

	useEffect(() => {
		if (!mediaId || !mediaType) return;

		const loadDetails = async () => {
			setLoading(true);
			setError(null);
			try {
				const [data, userData, serversData] = await Promise.all([
					mediaType === 'movie'
						? seerrApi.getMovie(mediaId)
						: seerrApi.getTv(mediaId),
					seerrApi.getUser().catch(() => null),
					(mediaType === 'movie'
						? seerrApi.getRadarrServers()
						: seerrApi.getSonarrServers()
					).catch(() => [])
				]);

				setDetails(data);

				const apiPermissions = userData?.permissions;
				const contextPermissions = contextUser?.permissions;
				if (apiPermissions != null) {
					setUserPermissions(apiPermissions);
				} else if (contextPermissions != null) {
					setUserPermissions(contextPermissions);
				} else {
					setUserPermissions(null);
				}

				// Quota is display only and the server still enforces it, so
				// a failed fetch just hides the quota lines.
				if (userData?.id != null) {
					seerrApi.getUserQuota(userData.id)
						.then((q) => setQuota(q || null))
						.catch(() => setQuota(null));
				}

				const serversList = Array.isArray(serversData) ? serversData : [];
				const serversWithType = serversList.map(s => ({
					...s,
					isRadarr: mediaType === 'movie'
				}));
				setServers(serversWithType);
				setHas4kServer(serversList.some(s => s.is4k));
				setHasHdServer(serversList.some(s => !s.is4k));

				const loadMultiplePages = async (fetcher) => {
					const allResults = [];
					for (let page = 1; page <= 3; page++) {
						try {
							const pageData = await fetcher(mediaId, page);
							if (pageData?.results) allResults.push(...pageData.results);
						} catch {
							break;
						}
					}
					return allResults;
				};

				const [recsData, similarData] = await Promise.all([
					loadMultiplePages(mediaType === 'movie'
						? seerrApi.getMovieRecommendations
						: seerrApi.getTvRecommendations
					),
					loadMultiplePages(mediaType === 'movie'
						? seerrApi.getMovieSimilar
						: seerrApi.getTvSimilar
					)
				]);
				setRecommendations(recsData.slice(0, 20));
				setSimilar(similarData.slice(0, 20));
			} catch (err) {
				console.error('Failed to load details:', err);
				setError(err.message || $L('Failed to load details'));
			} finally {
				setLoading(false);
			}
		};

		loadDetails();
	}, [mediaId, mediaType, contextUser]);

	useEffect(() => {
		if (!loading && details) {
			window.requestAnimationFrame(() => {
				safeFocus('action-buttons');
			});
		}
	}, [loading, details]);

	const hdStatus = useMemo(() => details?.mediaInfo?.status ?? null, [details]);
	const status4k = useMemo(() => details?.mediaInfo?.status4k ?? null, [details]);

	const hdDownload = useMemo(() =>
		getMediaDownloadSummary(details?.mediaInfo, false),
	[details]
	);
	const download4k = useMemo(() =>
		getMediaDownloadSummary(details?.mediaInfo, true),
	[details]
	);

	// Poll the details while a download is active so the progress bars
	// advance. Quiet refetch: only the details payload is swapped, and a
	// failed tick is ignored instead of surfacing the error UI.
	useEffect(() => {
		if (loading || !mediaId || !mediaType || (!hdDownload && !download4k)) return;
		const id = setInterval(() => {
			(mediaType === 'movie'
				? seerrApi.getMovie(mediaId)
				: seerrApi.getTv(mediaId)
			).then((data) => {
				if (data) setDetails(data);
			}).catch(() => {});
		}, 30000);
		return () => clearInterval(id);
	}, [loading, hdDownload, download4k, mediaId, mediaType]);

	// Issue reports need the seerr internal media id, so the title has to be
	// at least partially available on the server.
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

	const handleOpenCollection = useCallback(() => {
		if (details?.collection?.id != null) {
			onOpenCollection?.(details.collection.id);
		}
	}, [details, onOpenCollection]);

	const handleCollectionBannerKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			safeFocus('action-buttons');
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			const castFocused = safeFocus('cast-section');
			if (!castFocused) {
				const recFocused = safeFocus('details-row-0');
				if (!recFocused) {
					safeFocus('details-row-1');
				}
			}
		}
	}, []);
	const requests = useMemo(() => details?.mediaInfo?.requests ?? [], [details]);
	const hdDeclined = useMemo(() => requests.some(r => !r.is4k && r.status === 3), [requests]);
	const fourKDeclined = useMemo(() => requests.some(r => r.is4k && r.status === 3), [requests]);
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
	}, [mediaId, mediaType, requesting]);

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
	}, [canRequestAny, canRequestHd, canRequest4k, proceedWithRequest, hasHdServer, has4kServer, mediaType, details?.seasons]);

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
	}, [pendingRequests, mediaId, mediaType]);

	const handleTrailer = useCallback(() => {
		const mediaTitle = details?.title || details?.name || 'Unknown';
		const mediaYear = details?.releaseDate?.substring(0, 4) || details?.firstAirDate?.substring(0, 4) || '';
		const searchQuery = `${mediaTitle} ${mediaYear} official trailer`;
		const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
		window.open(youtubeUrl, '_blank');
	}, [details]);

	const handlePlay = useCallback(() => {
		const jellyfinMediaId = details?.mediaInfo?.jellyfinMediaId;
		if (!jellyfinMediaId) return;
		onPlayInMoonfin?.({Id: jellyfinMediaId});
	}, [details, onPlayInMoonfin]);

	const handleSelectRelated = useCallback((item) => {
		const type = item.mediaType || item.media_type || (item.title ? 'movie' : 'tv');
		onSelectItem?.({mediaId: item.id, mediaType: type});
	}, [onSelectItem]);

	const handleSelectCast = useCallback((person) => {
		onSelectPerson?.(person.id, person.name);
	}, [onSelectPerson]);

	const handleSelectKeyword = useCallback((keyword) => {
		onSelectKeyword?.(keyword, mediaType);
	}, [onSelectKeyword, mediaType]);

	const handleActionButtonsKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			const bannerFocused = safeFocus('collection-banner');
			if (bannerFocused) return;
			const castFocused = safeFocus('cast-section');
			if (!castFocused) {
				const recFocused = safeFocus('details-row-0');
				if (!recFocused) {
					safeFocus('details-row-1');
				}
			}
		}
	}, []);

	const handleRowNavigateUp = useCallback((fromRowIndex) => {
		if (fromRowIndex === 0) {
			const castFocused = safeFocus('cast-section');
			if (!castFocused) {
				safeFocus('action-buttons');
			}
		} else {
			const targetIndex = fromRowIndex - 1;
			const focused = safeFocus(`details-row-${targetIndex}`);
			if (!focused) {
				const castFocused = safeFocus('cast-section');
				if (!castFocused) {
					safeFocus('action-buttons');
				}
			}
		}
	}, []);

	const handleRowNavigateDown = useCallback((fromRowIndex) => {
		const targetIndex = fromRowIndex + 1;
		const focused = safeFocus(`details-row-${targetIndex}`);
		if (!focused) {
			const keywordsFocused = safeFocus('keywords-section');
			if (!keywordsFocused) {
				safeFocus('seasons-section');
			}
		}
	}, []);

	const handleCastSectionKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			const bannerFocused = safeFocus('collection-banner');
			if (!bannerFocused) {
				safeFocus('action-buttons');
			}
		} else if (e.keyCode === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			const recFocused = safeFocus('details-row-0');
			if (!recFocused) {
				const simFocused = safeFocus('details-row-1');
				if (!simFocused) {
					safeFocus('keywords-section');
				}
			}
		}
	}, []);

	const handleKeywordsSectionKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP) {
			// Up arrow - navigate to previous section
			e.preventDefault();
			e.stopPropagation();
			const simFocused = safeFocus('details-row-1');
			if (!simFocused) {
				const recFocused = safeFocus('details-row-0');
				if (!recFocused) {
					const castFocused = safeFocus('cast-section');
					if (!castFocused) {
						safeFocus('action-buttons');
					}
				}
			}
		}
	}, []);

	const mediaFacts = useMemo(() => {
		if (!details) return [];
		const facts = [];

		const tmdbScore = Number(details.voteAverage);
		if (Number.isFinite(tmdbScore) && tmdbScore > 0) {
			facts.push({label: $L('TMDB Score'), value: `${Math.round(tmdbScore * 10)}%`});
		}

		const productionStatus = details.status;
		if (productionStatus) {
			facts.push({label: $L('Status'), value: productionStatus});
		}

		// TV Show specific fields
		if (mediaType === 'tv') {
			if (details.firstAirDate) {
				const formatted = formatDate(details.firstAirDate);
				if (formatted) facts.push({label: $L('First Air Date'), value: formatted});
			}
			if (details.lastAirDate) {
				const formatted = formatDate(details.lastAirDate);
				if (formatted) facts.push({label: $L('Last Air Date'), value: formatted});
			}
			if (details.numberOfSeasons) {
				facts.push({label: $L('Seasons'), value: details.numberOfSeasons.toString()});
			}
			// Networks
			if (details.networks?.length > 0) {
				facts.push({label: $L('Networks'), value: details.networks.slice(0, 3).map(n => n.name).join(', ')});
			}
		}

		// Movie specific fields
		if (mediaType === 'movie') {
			if (details.releaseDate) {
				const formatted = formatDate(details.releaseDate);
				if (formatted) facts.push({label: $L('Release Date'), value: formatted});
			}
			if (details.runtime) {
				facts.push({label: $L('Runtime'), value: formatRuntime(details.runtime)});
			}
			if (details.budget) {
				const formatted = formatCurrency(details.budget);
				if (formatted) facts.push({label: $L('Budget'), value: formatted});
			}
			if (details.revenue) {
				const formatted = formatCurrency(details.revenue);
				if (formatted) facts.push({label: $L('Revenue'), value: formatted});
			}
		}

		return facts;
	}, [details, mediaType]);

	if (loading) {
		return (
			<div className={css.container}>
				<LoadingSpinner />
			</div>
		);
	}

	if (error && !details) {
		return (
			<div className={css.container}>
				<div className={css.error}>
					<p>{error}</p>
					<SpottableDiv className={css.errorButton} onClick={onClose || onBack}>
						{$L('Go Back')}
					</SpottableDiv>
				</div>
			</div>
		);
	}

	if (!details) {
		return (
			<div className={css.container}>
				<div className={css.error}>
					<p>{$L('No details available')}</p>
				</div>
			</div>
		);
	}

	const posterUrl = details.posterPath
		? seerrApi.getImageUrl(details.posterPath, 'w500')
		: null;
	const backdropUrl = details.backdropPath
		? seerrApi.getImageUrl(details.backdropPath, 'w1280')
		: null;
	const title = details.title || details.name;
	const voteAverage = Number(details.voteAverage);
	const hasVoteAverage = Number.isFinite(voteAverage) && voteAverage > 0;
	const year = details.releaseDate
		? new Date(details.releaseDate).getFullYear()
		: details.firstAirDate
			? new Date(details.firstAirDate).getFullYear()
			: null;
	const isAvailable = hdStatus === MEDIA_STATUS.AVAILABLE || hdStatus === MEDIA_STATUS.PARTIALLY_AVAILABLE;
	const keywords = details.keywords || [];

	return (
		<div className={css.container}>
			{/* Quality Selection Popup */}
			<QualitySelectionPopup
				open={showQualityPopup}
				title={title}
				hdStatus={hdStatus}
				status4k={status4k}
				canRequestHd={canRequestHd}
				canRequest4k={canRequest4k}
				quota={mediaType === 'tv' ? quota?.tv : quota?.movie}
				isTv={mediaType === 'tv'}
				onSelect={handleQualitySelect}
				onClose={handleCloseQualityPopup}
			/>

			{/* Season Selection Popup (TV only) */}
			{mediaType === 'tv' && (
				<SeasonSelectionPopup
					open={showSeasonPopup}
					title={title}
					seasons={details?.seasons}
					seasonStatusMap={pendingIs4k ? seasonStatusMap4k : seasonStatusMapHd}
					quota={quota?.tv}
					onConfirm={handleSeasonConfirm}
					onClose={handleCloseSeasonPopup}
				/>
			)}

			{/* Report Issue Popup */}
			{canReportIssue && (
				<ReportIssuePopup
					open={showReportPopup}
					title={title}
					isTv={mediaType === 'tv'}
					seasons={details?.seasons}
					onSubmit={handleReportSubmit}
					onClose={handleCloseReportPopup}
				/>
			)}

			{/* Advanced Request Options Popup */}
			{hasAdvanced && (
				<AdvancedOptionsPopup
					open={showAdvancedPopup}
					title={title}
					servers={servers}
					is4k={pendingIs4k}
					onConfirm={handleAdvancedConfirm}
					onClose={handleCloseAdvancedPopup}
				/>
			)}

			{/* Cancel Request Popup */}
			<CancelRequestPopup
				open={showCancelPopup}
				pendingRequests={pendingRequests}
				title={title}
				onConfirm={handleCancelConfirm}
				onClose={handleCloseCancelPopup}
			/>

			{/* Backdrop */}
			<div className={css.backdropSection}>
				{backdropUrl && <Image className={css.backdropImage} src={backdropUrl} />}
				<div className={css.backdropOverlay} />
			</div>

			<div className={css.mainContent} ref={contentRef}>
				{/* Header Section with Poster and Title */}
				<div className={css.headerWrapper}>
					{/* Poster */}
					<div className={css.posterContainer}>
						{posterUrl ? (
							<Image className={css.posterImage} src={posterUrl} sizing="fill" />
						) : (
							<div className={css.posterPlaceholder}>{title?.[0]}</div>
						)}
					</div>

					{/* Title Section */}
					<div className={css.titleSection}>
						<h1 className={css.mediaTitle}>
							{title}
							{year && <span className={css.mediaYear}> ({year})</span>}
						</h1>

						{/* Status Badge - Combined HD/4K status */}
						<div className={`${css.statusBadge} ${css[`badge${statusBadge.color}`]}`}>
							{statusBadge.text}
						</div>

						{hdDownload && (
							<div className={css.downloadProgressRow}>
								<SeerrDownloadProgress
									summary={hdDownload}
									prefix={download4k ? 'HD' : null}
								/>
							</div>
						)}
						{download4k && (
							<div className={css.downloadProgressRow}>
								<SeerrDownloadProgress summary={download4k} prefix="4K" />
							</div>
						)}

						{/* Metadata Row */}
						<div className={css.metadataRow}>
							{hasVoteAverage && (
								<span className={css.metadataItem}>★ {voteAverage.toFixed(1)}</span>
							)}
							{details.runtime && (
								<span className={css.metadataItem}>{formatRuntime(details.runtime)}</span>
							)}
							{details.numberOfSeasons && (
								<span className={css.metadataItem}>
									{details.numberOfSeasons} {details.numberOfSeasons > 1 ? $L('Seasons') : $L('Season')}
								</span>
							)}
						</div>

						{/* Genres */}
						{details.genres?.length > 0 && (
							<div className={css.genresRow}>
								{details.genres.slice(0, 3).map(g => g.name).join(' • ')}
							</div>
						)}

						{/* Tagline */}
						{details.tagline && (
							<p className={css.tagline}>&ldquo;{details.tagline}&rdquo;</p>
						)}
					</div>
				</div>

				{/* Overview Section */}
				<div className={css.overviewSection}>
					{/* Left side - Overview text and action buttons */}
					<div className={css.overviewLeft}>
						<h2 className={css.overviewHeading}>{$L('Overview')}</h2>
						<p className={css.overview}>{details.overview || $L('Overview unavailable.')}</p>

						{/* Action Buttons */}
						<LastFocusedContainer
							className={css.actionButtons}
							spotlightId="action-buttons"
							onKeyDown={handleActionButtonsKeyDown}
						>
							{/* Request Button */}
							<div className={css.btnWrapper}>
								<SpottableDiv
									className={`${css.btnAction} ${!canRequestAny ? css.btnDisabled : ''}`}
									onClick={handleRequestClick}
									disabled={!canRequestAny}
								>
									<span className={css.btnIcon}>
									<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
										<path d="M240-120v-80l40-40H160q-33 0-56.5-23.5T80-320v-440q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v440q0 33-23.5 56.5T800-240H680l40 40v80H240Zm-80-200h640v-440H160v440Zm0 0v-440 440Z"/>
									</svg>
								</span>
								</SpottableDiv>
								<span className={css.btnLabel}>{requestButtonLabel}</span>
							</div>

							{/* Cancel Request Button - show if pending requests exist */}
							{pendingRequests.length > 0 && (
								<div className={css.btnWrapper}>
									<SpottableDiv className={css.btnAction} onClick={handleCancelRequestClick}>
										<span className={css.btnIcon}>
											<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
												<path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
											</svg>
										</span>
									</SpottableDiv>
									<span className={css.btnLabel}>{$L('Cancel Request')}</span>
								</div>
							)}

							{/* Watch Trailer Button */}
							{supportsExternalTrailerSearch && (
								<div className={css.btnWrapper}>
									<SpottableDiv className={css.btnAction} onClick={handleTrailer}>
										<span className={css.btnIcon}>
											<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
												<path d="M160-120v-720h80v80h80v-80h320v80h80v-80h80v720h-80v-80h-80v80H320v-80h-80v80h-80Zm80-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm400 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80ZM400-200h160v-560H400v560Zm0-560h160-160Z"/>
											</svg>
										</span>
									</SpottableDiv>
									<span className={css.btnLabel}>{$L('Watch Trailer')}</span>
								</div>
							)}

							{/* Play in Moonfin Button (if available) */}
							{isAvailable && (
								<div className={css.btnWrapper}>
									<SpottableDiv className={css.btnAction} onClick={handlePlay}>
										<span className={css.btnIcon}>
											<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
												<path d="M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z"/>
											</svg>
										</span>
									</SpottableDiv>
									<span className={css.btnLabel}>{$L('Play in Moonfin')}</span>
								</div>
							)}

							{/* Report Issue Button */}
							{canReportIssue && (
								<div className={css.btnWrapper}>
									<SpottableDiv className={css.btnAction} onClick={handleReportIssueClick}>
										<span className={css.btnIcon}>
											<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
												<path d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z"/>
											</svg>
										</span>
									</SpottableDiv>
									<span className={css.btnLabel}>{$L('Report Issue')}</span>
								</div>
							)}
						</LastFocusedContainer>
					</div>

					{/* Right side - Media Facts */}
					{mediaFacts.length > 0 && (
						<div className={css.mediaFacts}>
							{mediaFacts.map((fact, index) => (
								<div
									key={fact.label}
									className={`${css.factRow} ${index === 0 ? css.factRowFirst : ''} ${index === mediaFacts.length - 1 ? css.factRowLast : ''}`}
								>
									<span className={css.factLabel}>{fact.label}</span>
									<span className={css.factValue}>{fact.value}</span>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Collection Banner (movies that belong to a collection) */}
				{mediaType === 'movie' && details.collection && onOpenCollection && (
					<SpottableDiv
						className={css.collectionBanner}
						spotlightId="collection-banner"
						onClick={handleOpenCollection}
						onKeyDown={handleCollectionBannerKeyDown}
						style={details.collection.backdropPath ? {
							backgroundImage: `url(${seerrApi.getImageUrl(details.collection.backdropPath, 'w780')})`
						} : undefined}
					>
						<div className={css.collectionBannerScrim} />
						<span className={css.collectionBannerText}>
							{$L('Part of {name}').replace('{name}', details.collection.name || '')}
						</span>
						<span className={css.collectionBannerCta}>{$L('View Collection')} ›</span>
					</SpottableDiv>
				)}

				{/* Cast Section */}
				{details.credits?.cast?.length > 0 && (
					<LastFocusedContainer
						className={css.castSection}
						spotlightId="cast-section"
						onKeyDown={handleCastSectionKeyDown}
					>
						<h2 className={css.sectionTitle}>{$L('Cast')}</h2>
						<div className={css.castScroller}>
							<div className={css.castList}>
								{details.credits.cast.slice(0, 10).map(person => (
									<CastCard key={person.id} person={person} onSelect={handleSelectCast} />
								))}
							</div>
						</div>
					</LastFocusedContainer>
				)}

				{/* Recommendations Section */}
				{recommendations.length > 0 && (
					<HorizontalMediaRow
						title={$L('Recommendations')}
						items={recommendations}
						onSelect={handleSelectRelated}
						rowIndex={0}
						onNavigateUp={handleRowNavigateUp}
						onNavigateDown={handleRowNavigateDown}
						sectionClass={css.recommendationsSection}
					/>
				)}

				{/* Similar Section */}
				{similar.length > 0 && (
					<HorizontalMediaRow
						title={mediaType === 'tv' ? $L('Similar Series') : $L('Similar Titles')}
						items={similar}
						onSelect={handleSelectRelated}
						rowIndex={1}
						onNavigateUp={handleRowNavigateUp}
						onNavigateDown={handleRowNavigateDown}
						sectionClass={css.similarSection}
					/>
				)}

				{/* Keywords Section */}
				{keywords.length > 0 && (
					<KeywordsSectionContainer
						className={css.keywordsSection}
						spotlightId="keywords-section"
						onKeyDown={handleKeywordsSectionKeyDown}
					>
						<h2 className={css.sectionTitle}>{$L('Keywords')}</h2>
						<div className={css.keywordsList}>
							{keywords.map(keyword => (
								<KeywordTag key={keyword.id} keyword={keyword} onSelect={handleSelectKeyword} />
							))}
						</div>
					</KeywordsSectionContainer>
				)}
			</div>
		</div>
	);
};

export default SeerrDetails;
