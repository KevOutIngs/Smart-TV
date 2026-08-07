// Everything Seerr knows about one title: the payload itself, the recommendation and similar
// rows, and the viewer's permissions, quota and configured servers. Without a media id it sits
// idle, which is how a title Seerr has nothing to say about costs nothing.

import {useEffect, useMemo, useState} from 'react';
import $L from '@enact/i18n/$L';

import seerrApi from '../../services/seerrApi';
import {getMediaDownloadSummary} from '../../utils/seerrStatus';

const useSeerrDetailsData = ({mediaId, mediaType, contextUser}) => {
	const [details, setDetails] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [recommendations, setRecommendations] = useState([]);
	const [similar, setSimilar] = useState([]);
	const [quota, setQuota] = useState(null);
	const [userPermissions, setUserPermissions] = useState(null);
	const [has4kServer, setHas4kServer] = useState(false);
	const [hasHdServer, setHasHdServer] = useState(false);
	const [servers, setServers] = useState([]);

	useEffect(() => {
		if (!mediaId || !mediaType) {
			setDetails(null);
			setRecommendations([]);
			setSimilar([]);
			setError(null);
			setLoading(false);
			return;
		}

		// Moving to another title while a fetch is in flight has to drop the late answer,
		// or the screen shows one title's request state against another's artwork.
		let cancelled = false;

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

				if (cancelled) return;
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
						.then((q) => { if (!cancelled) setQuota(q || null); })
						.catch(() => { if (!cancelled) setQuota(null); });
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
				if (cancelled) return;
				setRecommendations(recsData.slice(0, 20));
				setSimilar(similarData.slice(0, 20));
			} catch (err) {
				if (cancelled) return;
				console.error('Failed to load details:', err);
				setError(err.message || $L('Failed to load details'));
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		loadDetails();
		return () => { cancelled = true; };
	}, [mediaId, mediaType, contextUser]);

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

	// Poll while a download is running so the progress bars advance. Only the details payload
	// is swapped and a failed tick is ignored, so a blip never replaces the screen with an error.
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

	return {
		details,
		setDetails,
		loading,
		error,
		setError,
		recommendations,
		similar,
		quota,
		userPermissions,
		servers,
		hasHdServer,
		has4kServer,
		hdStatus,
		status4k,
		hdDownload,
		download4k
	};
};

export default useSeerrDetailsData;
