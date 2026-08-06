import {useCallback, useEffect, useRef, useMemo} from 'react';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Image from '@enact/sandstone/Image';
import $L from '@enact/i18n/$L';
import seerrApi from '../../services/seerrApi';
import {isLegacyTizen} from '../../platform';
import {useSeerr} from '../../context/SeerrContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import SeerrDownloadProgress from '../../components/SeerrDownloadProgress';
import {MEDIA_STATUS} from '../../utils/seerrStatus';
import css from './SeerrDetails.module.less';

import {formatRuntime} from './seerrBadges';
import {LastFocusedContainer, SpottableDiv, safeFocus} from './seerrFocus';
import {handleActionButtonsKeyDown, handleCastSectionKeyDown, handleCollectionBannerKeyDown, handleKeywordsSectionKeyDown, handleRowNavigateDown, handleRowNavigateUp} from './seerrDetailsNav';
import {CastCard, HorizontalMediaRow, KeywordTag} from './SeerrCards';
import {buildMediaFacts} from './seerrMediaFacts';
import useSeerrDetailsData from './useSeerrDetailsData';
import useSeerrRequests from './useSeerrRequests';
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

	const {
		details, setDetails, loading, error, setError, recommendations, similar,
		quota, userPermissions, servers, hasHdServer, has4kServer,
		hdStatus, status4k, hdDownload, download4k
	} = useSeerrDetailsData({mediaId, mediaType, contextUser});

	const {
		canReportIssue, canRequestAny, canRequestHd, canRequest4k, hasAdvanced,
		statusBadge, requestButtonLabel, pendingIs4k, pendingRequests,
		seasonStatusMapHd, seasonStatusMap4k,
		showQualityPopup, showSeasonPopup, showAdvancedPopup, showCancelPopup, showReportPopup,
		handleRequestClick, handleQualitySelect, handleSeasonConfirm, handleAdvancedConfirm,
		handleCancelRequestClick, handleCancelConfirm, handleReportIssueClick, handleReportSubmit,
		handleCloseQualityPopup, handleCloseSeasonPopup, handleCloseAdvancedPopup,
		handleCloseCancelPopup, handleCloseReportPopup
	} = useSeerrRequests({
		mediaId, mediaType, details, setDetails, setError, isAuthenticated,
		userPermissions, hasHdServer, has4kServer, hdStatus, status4k, backHandlerRef
	});

	const contentRef = useRef(null);

	useEffect(() => {
		if (!loading && details) {
			window.requestAnimationFrame(() => {
				safeFocus('action-buttons');
			});
		}
	}, [loading, details]);

	const handleOpenCollection = useCallback(() => {
		if (details?.collection?.id != null) {
			onOpenCollection?.(details.collection.id);
		}
	}, [details, onOpenCollection]);

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

	const mediaFacts = useMemo(() => buildMediaFacts(details, mediaType), [details, mediaType]);

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
