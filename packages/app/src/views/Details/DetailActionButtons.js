import {Fragment} from 'react';
import $L from '@enact/i18n/$L';

import {arrange, DETAIL_ORDER_KEY, DETAIL_HIDDEN_KEY} from '../../utils/buttonLayout';
import {DETAIL_ICON_PATHS} from './detailIcons';
import {SpottableDiv, HorizontalContainer} from './detailsSpottables';
import {handleButtonRowKeyDown} from './detailsFocus';

import css from './Details.module.less';

// The row under the header. Play and Resume always lead it, and everything after them is in
// whatever order the viewer arranged in settings, with anything they hid left out.
const DetailActionButtons = ({
	item,
	settings,
	seerr,
	isSeries,
	isSeason,
	isEpisode,
	isBook,
	isReadableBook,
	hasPlaybackPosition,
	resumeTimeText,
	mediaSource,
	supportsMediaSourceSelection,
	hasMultipleVersions,
	hasMultipleAudio,
	selectedVersionIndex,
	selectedAudioIndex,
	selectedSubtitleIndex,
	currentAudioStream,
	currentSubtitleStream,
	canAddToCollection,
	canIdentify,
	playLongPress,
	resumeLongPress,
	onFocusRow,
	onShuffle,
	onOpenVersionModal,
	onOpenAudioModal,
	onOpenSubtitleModal,
	onTrailer,
	onToggleWatched,
	onToggleFavorite,
	onGoToSeries,
	onOpenMediaInfo,
	onOpenPlaylistModal,
	onOpenCollectionModal,
	onOpenDeleteDialog,
	onOpenIdentifyModal
}) => {
	// Declaration order is where a button the user never placed ends up, so keep it stable.
	const customizable = arrange([
		{id: 'seerrRequest', when: seerr.showsRequest, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={seerr.hasOpenHdRequest ? seerr.onCancel : seerr.onRequest}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={seerr.hasOpenHdRequest ? DETAIL_ICON_PATHS.cancelRequest : DETAIL_ICON_PATHS.request}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{seerr.requestLabel}</span>
			</SpottableDiv>
		)},
		{id: 'seerrRequest4k', when: seerr.showsRequest4k, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={seerr.hasOpenFourKRequest ? seerr.onCancel4k : seerr.onRequest4k}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={seerr.hasOpenFourKRequest ? DETAIL_ICON_PATHS.cancelRequest : DETAIL_ICON_PATHS.request}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{seerr.requestLabel4k}</span>
			</SpottableDiv>
		)},
		{id: 'shuffle', when: isSeries || isSeason, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onShuffle}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.shuffle}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Shuffle')}</span>
			</SpottableDiv>
		)},
		{id: 'version', when: hasMultipleVersions, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenVersionModal}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.version}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Version')}</span>
				<span className={css.btnDetail}>{mediaSource?.Name || `${$L('Version')} ${selectedVersionIndex + 1}`}</span>
			</SpottableDiv>
		)},
		{id: 'audio', when: hasMultipleAudio, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenAudioModal}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.audio}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Audio')}</span>
				{currentAudioStream && (
					<span className={css.btnDetail}>
						{currentAudioStream.DisplayTitle || currentAudioStream.Language || `${$L('Track')} ${selectedAudioIndex + 1}`}
					</span>
				)}
			</SpottableDiv>
		)},
		{id: 'subtitles', when: supportsMediaSourceSelection, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenSubtitleModal}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.subtitle}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Subtitle')}</span>
				{currentSubtitleStream ? (
					<span className={css.btnDetail}>
						{currentSubtitleStream.DisplayTitle || currentSubtitleStream.Language || `${$L('Track')} ${selectedSubtitleIndex + 1}`}
					</span>
				) : (
					<span className={css.btnDetail}>{$L('Off')}</span>
				)}
			</SpottableDiv>
		)},
		{id: 'trailer', when: item.LocalTrailerCount > 0 || item.RemoteTrailers?.length > 0, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onTrailer}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.trailer}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Trailer')}</span>
			</SpottableDiv>
		)},
		{id: 'watched', when: true, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onToggleWatched} spotlightId="details-watched-btn">
				<div className={css.btnAction}>
					<svg className={`${css.btnIcon} ${item.UserData?.Played ? css.watched : ''}`} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.watched}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{item.UserData?.Played ? $L('Watched') : $L('Mark Watched')}</span>
			</SpottableDiv>
		)},
		{id: 'favorite', when: true, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onToggleFavorite} spotlightId="details-favorite-btn">
				<div className={css.btnAction}>
					<svg className={`${css.btnIcon} ${item.UserData?.IsFavorite ? css.favorited : ''}`} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.favorite}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{item.UserData?.IsFavorite ? $L('Favorited') : $L('Favorite')}</span>
			</SpottableDiv>
		)},
		{id: 'goToSeries', when: isEpisode && item.SeriesId, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onGoToSeries}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.series}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Series')}</span>
			</SpottableDiv>
		)},
		{id: 'mediaInfo', when: supportsMediaSourceSelection, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenMediaInfo}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.mediaInfo}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Media Info')}</span>
			</SpottableDiv>
		)},
		{id: 'playlist', when: true, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenPlaylistModal}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.playlist}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Add to Playlist')}</span>
			</SpottableDiv>
		)},
		{id: 'collection', when: canAddToCollection, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenCollectionModal}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.collection}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Add to Collection')}</span>
			</SpottableDiv>
		)},
		{id: 'deleteFiles', when: item.CanDelete, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenDeleteDialog}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.delete}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Delete')}</span>
			</SpottableDiv>
		)},
		{id: 'seerrReportIssue', when: seerr.showsReportIssue, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={seerr.handleReportIssueClick}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.reportIssue}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Report Issue')}</span>
			</SpottableDiv>
		)},
		{id: 'seerrManage', when: seerr.showsManage, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={seerr.handleManageRequestsClick}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.manageRequests}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Manage Requests')}</span>
			</SpottableDiv>
		)},
		{id: 'admin', when: canIdentify, render: () => (
			<SpottableDiv className={css.btnWrapper} onClick={onOpenIdentifyModal}>
				<div className={css.btnAction}>
					<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
						<path d={DETAIL_ICON_PATHS.admin}/>
					</svg>
				</div>
				<span className={css.btnLabel}>{$L('Admin Controls')}</span>
			</SpottableDiv>
		)}
	].filter((btn) => btn.when), {order: settings[DETAIL_ORDER_KEY], hidden: settings[DETAIL_HIDDEN_KEY]});

	return (
		<HorizontalContainer className={css.actionButtons} onKeyDown={handleButtonRowKeyDown} onFocus={onFocusRow} spotlightId="details-action-buttons">
			{!isBook && hasPlaybackPosition && (
				<SpottableDiv className={css.btnWrapper} {...resumeLongPress} spotlightId="details-primary-btn">
					<div className={css.btnAction}>
						<span className={css.btnIcon}>▶</span>
					</div>
					<span className={css.btnLabel}>{$L('Resume')}</span>
					<span className={css.btnDetail}>{resumeTimeText}</span>
				</SpottableDiv>
			)}
			{(isBook ? isReadableBook : true) && (
				<SpottableDiv className={css.btnWrapper} {...playLongPress} onFocus={onFocusRow} spotlightId={hasPlaybackPosition ? undefined : 'details-primary-btn'}>
					<div className={css.btnAction}>
						{hasPlaybackPosition && !isBook ? (
							<svg className={css.btnIcon} viewBox="0 -960 960 960">
								<path d={DETAIL_ICON_PATHS.restart}/>
							</svg>
						) : isBook ? (
							<svg className={css.btnIcon} viewBox="0 -960 960 960" fill="currentColor">
								<path d={DETAIL_ICON_PATHS.book}/>
							</svg>
						) : (
							<span className={css.btnIcon}>▶</span>
						)}
					</div>
					<span className={css.btnLabel}>{isBook ? $L('Read') : hasPlaybackPosition ? $L('Restart') : $L('Play')}</span>
				</SpottableDiv>
			)}
			{customizable.map((btn) => <Fragment key={btn.id}>{btn.render()}</Fragment>)}
		</HorizontalContainer>
	);
};

export default DetailActionButtons;
