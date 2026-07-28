import {useState, useEffect, useRef, useMemo} from 'react';
import $L from '@enact/i18n/$L';
import {fetchRatings, fetchEpisodeRatings, buildDisplayRatings, getContentType, getTmdbId, getSelectionSource, isRatingSourceEnabled} from '../../services/mdblistApi';
import {useSettings} from '../../context/SettingsContext';
import {getRtFallbackIcon} from '../icons/rtIcons';
import css from './RatingsRow.module.less';

const RatingsRow = ({item, serverUrl, compact = false, pluginEnabled = true}) => {
	const {settings} = useSettings();
	const showLabels = settings.showRatingLabels !== false;
	const showRatingBadges = settings.showRatingBadges !== false;
	const enabledSources = settings.mdblistRatingSources;
	const [allRatings, setAllRatings] = useState([]);
	const mountedRef = useRef(true);
	const itemIdRef = useRef(null);

	useEffect(() => {
		mountedRef.current = true;
		return () => { mountedRef.current = false; };
	}, []);

	const sourcesKey = Array.isArray(enabledSources) ? enabledSources.join(',') : '';
	const episodeRatingsEnabled = settings.tmdbEpisodeRatingsEnabled === true && isRatingSourceEnabled(settings, 'tmdb');

	useEffect(() => {
		if (!pluginEnabled || !item || !serverUrl) {
			setAllRatings([]);
			return;
		}

		const currentItemId = item.Id;
		itemIdRef.current = currentItemId;
		const controller = new AbortController();

		const apply = (ratings) => {
			if (mountedRef.current && itemIdRef.current === currentItemId) {
				setAllRatings(buildDisplayRatings(ratings, serverUrl));
			}
		};

		// Episodes have no MDBList ratings, so show the TMDB episode rating when
		// that feature is on. Seasons show nothing.
		if (item.Type === 'Episode') {
			if (episodeRatingsEnabled) {
				fetchEpisodeRatings(serverUrl, item, {signal: controller.signal}).then(apply);
			} else {
				setAllRatings([]);
			}
			return () => controller.abort();
		}

		const contentType = getContentType(item);
		const tmdbId = getTmdbId(item);
		if (!contentType || !tmdbId) {
			setAllRatings([]);
			return;
		}

		fetchRatings(serverUrl, item, {signal: controller.signal, sourcesKey}).then(apply);
		return () => controller.abort();
	}, [item, serverUrl, pluginEnabled, episodeRatingsEnabled, sourcesKey]);

	const displayRatings = useMemo(() => {
		if (!Array.isArray(enabledSources)) return allRatings;
		return allRatings
			.filter(r => enabledSources.includes(getSelectionSource(r.source)))
			.sort((a, b) => enabledSources.indexOf(getSelectionSource(a.source)) - enabledSources.indexOf(getSelectionSource(b.source)));
	}, [allRatings, enabledSources]);

	if (!showRatingBadges) return null;

	const communityRating = isRatingSourceEnabled(settings, 'stars') && item && item.CommunityRating ? item.CommunityRating.toFixed(1) : null;
	// The server's own critic rating stands in until plugin ratings actually
	// arrive, so it stays visible when there's no API key or nothing came back.
	const showCriticRating = allRatings.length === 0 && item && item.CriticRating != null;
	const hasContent = communityRating || displayRatings.length > 0 || showCriticRating;
	if (!hasContent) return null;

	if (compact) {
		return (
			<div className={css.ratingsRowCompact}>
				{communityRating && (
					<span className={css.ratingCompact}>
						<span className={css.communityStarCompact}>{"\u2605"}</span>
						<span className={css.ratingValueCompact}>{communityRating}</span>
					</span>
				)}
				{showCriticRating && (
					<span className={css.ratingCompact}>
						<img
							className={css.ratingIconCompact}
							src={getRtFallbackIcon(item.CriticRating)}
							alt={$L('Rotten Tomatoes')}
						/>
						<span className={css.ratingValueCompact}>{item.CriticRating}%</span>
					</span>
				)}
				{displayRatings.map(r => (
					<span key={r.source} className={css.ratingCompact}>
						<img
							className={css.ratingIconCompact}
							src={r.iconUrl}
							alt={r.name}
							title={r.name}
						/>
						<span className={css.ratingValueCompact}>{r.formatted}</span>
					</span>
				))}
			</div>
		);
	}

	return (
		<div className={css.ratingsRow}>
			{communityRating && (
				<div className={css.ratingItem}>
					<span className={css.communityStar}>{"\u2605"}</span>
					<div className={css.ratingInfo}>
						<span className={css.ratingValue}>{communityRating}</span>
						{showLabels && <span className={css.ratingName}>{$L('Community')}</span>}
					</div>
				</div>
			)}
			{showCriticRating && (
				<div className={css.ratingItem}>
					<img
						className={css.ratingIcon}
						src={getRtFallbackIcon(item.CriticRating)}
						alt={$L('Rotten Tomatoes')}
					/>
					<div className={css.ratingInfo}>
						<span className={css.ratingValue}>{item.CriticRating}%</span>
						{showLabels && <span className={css.ratingName}>{$L('Rotten Tomatoes')}</span>}
					</div>
				</div>
			)}
			{displayRatings.map(r => (
				<div key={r.source} className={css.ratingItem}>
					<img
						className={css.ratingIcon}
						src={r.iconUrl}
						alt={r.name}
						title={r.name}
					/>
					<div className={css.ratingInfo}>
						<span className={css.ratingValue}>{r.formatted}</span>
						{showLabels && <span className={css.ratingName}>{r.name}</span>}
					</div>
				</div>
			))}
		</div>
	);
};

export default RatingsRow;
