import {useState, useEffect, useCallback} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';
import {useAuth} from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {formatDuration} from '../../utils/helpers';

import css from './Recordings.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');
// self-only keeps 5-way inside the popup, otherwise focus walks straight through
// the scrim onto the cards behind it.
const PopupContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	restrict: 'self-only',
	preserveId: true
}, 'div');

const RecordingCard = ({recording, serverUrl, onSelect}) => {
	const handleClick = useCallback(() => {
		onSelect(recording);
	}, [recording, onSelect]);

	return (
		<SpottableDiv
			className={css.card}
			onClick={handleClick}
		>
			{recording.ImageTags?.Primary ? (
				<img
					className={css.cardImage}
					src={`${serverUrl}/Items/${recording.Id}/Images/Primary?maxWidth=300&quality=90`}
					alt=""
				/>
			) : (
				<div className={css.cardPlaceholder}>
					<span>📺</span>
				</div>
			)}
			<div className={css.cardInfo}>
				<div className={css.cardTitle}>{recording.Name}</div>
				{recording.EpisodeTitle && (
					<div className={css.cardSubtitle}>{recording.EpisodeTitle}</div>
				)}
				<div className={css.cardMeta}>
					{recording.ChannelName}
					{recording.RunTimeTicks && (
						<span> • {formatDuration(recording.RunTimeTicks)}</span>
					)}
				</div>
			</div>
		</SpottableDiv>
	);
};

const TimerCard = ({timer, serverUrl, formatScheduledTime, onSelect}) => {
	const handleClick = useCallback(() => {
		onSelect(timer);
	}, [timer, onSelect]);

	return (
		<SpottableDiv
			className={css.card}
			onClick={handleClick}
		>
			{timer.ProgramInfo?.ImageTags?.Primary ? (
				<img
					className={css.cardImage}
					src={`${serverUrl}/Items/${timer.ProgramInfo.Id}/Images/Primary?maxWidth=300&quality=90`}
					alt=""
				/>
			) : (
				<div className={css.cardPlaceholder}>
					<span>⏰</span>
				</div>
			)}
			<div className={css.cardInfo}>
				<div className={css.cardTitle}>{timer.Name}</div>
				<div className={css.cardMeta}>
					{timer.ChannelName}
				</div>
				<div className={css.cardSchedule}>
					{formatScheduledTime(timer.StartDate, timer.EndDate)}
				</div>
			</div>
		</SpottableDiv>
	);
};

// A series timer carries no item id, so there is no artwork to fetch for it.
const SeriesTimerCard = ({seriesTimer, onSelect}) => {
	const handleClick = useCallback(() => {
		onSelect(seriesTimer);
	}, [seriesTimer, onSelect]);

	return (
		<SpottableDiv
			className={css.card}
			onClick={handleClick}
		>
			<div className={css.cardPlaceholder}>
				<span>{$L('Series')}</span>
			</div>
			<div className={css.cardInfo}>
				<div className={css.cardTitle}>{seriesTimer.Name}</div>
				<div className={css.cardMeta}>
					{seriesTimer.RecordAnyChannel ? $L('All channels') : seriesTimer.ChannelName}
				</div>
				<div className={css.cardSchedule}>
					{seriesTimer.RecordNewOnly ? $L('New episodes only') : $L('All episodes')}
				</div>
			</div>
		</SpottableDiv>
	);
};

const Recordings = ({onPlayRecording, backHandlerRef}) => {
	const {api, serverUrl} = useAuth();
	const [recordings, setRecordings] = useState([]);
	const [timers, setTimers] = useState([]);
	const [seriesTimers, setSeriesTimers] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('recordings');
	const [selectedItem, setSelectedItem] = useState(null);

	useEffect(() => {
		if (!backHandlerRef) return;
		const handler = () => {
			if (selectedItem) {
				setSelectedItem(null);
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => { if (backHandlerRef.current === handler) backHandlerRef.current = null; };
	}, [backHandlerRef, selectedItem]);

	useEffect(() => {
		// Each list is fetched on its own. Not every server exposes series timers,
		// and one failed call shouldn't blank the whole screen.
		const loadData = async () => {
			setIsLoading(true);
			const [recordingsResult, timersResult, seriesTimersResult] = await Promise.all([
				api.getLiveTvRecordings().catch(() => null),
				api.getLiveTvTimers().catch(() => null),
				api.getLiveTvSeriesTimers().catch(() => null)
			]);
			setRecordings(recordingsResult?.Items || []);
			setTimers(timersResult?.Items || []);
			setSeriesTimers(seriesTimersResult?.Items || []);
			setIsLoading(false);
		};

		loadData();
	}, [api]);

	const handleSetRecordingsTab = useCallback(() => {
		setActiveTab('recordings');
	}, []);

	const handleSetScheduledTab = useCallback(() => {
		setActiveTab('scheduled');
	}, []);

	const handleSetSeriesTab = useCallback(() => {
		setActiveTab('series');
	}, []);

	// The popup is a spotlight container, so focus has to be handed to it
	// explicitly or it stays on the card behind the scrim.
	const openPopup = useCallback((type, item) => {
		setSelectedItem({type, item});
		setTimeout(() => {
			Spotlight.focus('recordings-popup');
		}, 100);
	}, []);

	const handleSelectRecording = useCallback((recording) => {
		openPopup('recording', recording);
	}, [openPopup]);

	const handleSelectTimer = useCallback((timer) => {
		openPopup('timer', timer);
	}, [openPopup]);

	const handleSelectSeriesTimer = useCallback((seriesTimer) => {
		openPopup('seriesTimer', seriesTimer);
	}, [openPopup]);

	const handlePlaySelectedRecording = useCallback(() => {
		if (selectedItem?.item) {
			onPlayRecording?.(selectedItem.item);
		}
	}, [selectedItem, onPlayRecording]);

	const handleDeleteSelectedRecording = useCallback(async () => {
		if (selectedItem?.item?.Id) {
			try {
				await api.deleteItem(selectedItem.item.Id);
				setRecordings(prev => prev.filter(r => r.Id !== selectedItem.item.Id));
				setSelectedItem(null);
			} catch (err) {
				console.error('Failed to delete recording:', err);
			}
		}
	}, [api, selectedItem]);

	const handleCancelSelectedTimer = useCallback(async () => {
		if (selectedItem?.item?.Id) {
			try {
				await api.cancelLiveTvTimer(selectedItem.item.Id);
				setTimers(prev => prev.filter(t => t.Id !== selectedItem.item.Id));
				setSelectedItem(null);
			} catch (err) {
				console.error('Failed to cancel timer:', err);
			}
		}
	}, [api, selectedItem]);

	const handleCancelSelectedSeriesTimer = useCallback(async () => {
		if (selectedItem?.item?.Id) {
			try {
				await api.cancelLiveTvSeriesTimer(selectedItem.item.Id);
				setSeriesTimers(prev => prev.filter(s => s.Id !== selectedItem.item.Id));
				setSelectedItem(null);
			} catch (err) {
				console.error('Failed to cancel series timer:', err);
			}
		}
	}, [api, selectedItem]);

	const handleClosePopup = useCallback(() => {
		setSelectedItem(null);
	}, []);

	const formatScheduledTime = useCallback((startDate, endDate) => {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const dateOpts = {weekday: 'short', month: 'short', day: 'numeric'};
		const timeOpts = {hour: 'numeric', minute: '2-digit', hour12: true};

		return `${start.toLocaleDateString(undefined, dateOpts)} ${start.toLocaleTimeString(undefined, timeOpts)} - ${end.toLocaleTimeString(undefined, timeOpts)}`;
	}, []);

	if (isLoading) {
		return (
			<div className={css.page}>
				<div className={css.loadingContainer}>
					<LoadingSpinner />
					<p>{$L('Loading Recordings...')}</p>
				</div>
			</div>
		);
	}

	return (
		<div className={css.page}>
			<div className={css.header}>
				<div className={css.title}>{$L('Recordings')}</div>
				<div className={css.tabs}>
					<SpottableButton
						className={`${css.tab} ${activeTab === 'recordings' ? css.active : ''}`}
						onClick={handleSetRecordingsTab}
					>
						{$L('Recordings')} ({recordings.length})
					</SpottableButton>
					<SpottableButton
						className={`${css.tab} ${activeTab === 'scheduled' ? css.active : ''}`}
						onClick={handleSetScheduledTab}
					>
						{$L('Scheduled')} ({timers.length})
					</SpottableButton>
					<SpottableButton
						className={`${css.tab} ${activeTab === 'series' ? css.active : ''}`}
						onClick={handleSetSeriesTab}
					>
						{$L('Series')} ({seriesTimers.length})
					</SpottableButton>
				</div>
			</div>

			<div className={css.content}>
				{activeTab === 'recordings' && (
					<div className={css.grid}>
						{recordings.length === 0 ? (
							<div className={css.empty}>{$L('No recordings found')}</div>
						) : (
							recordings.map(recording => (
								<RecordingCard
									key={recording.Id}
									recording={recording}
									serverUrl={serverUrl}
									onSelect={handleSelectRecording}
								/>
							))
						)}
					</div>
				)}

				{activeTab === 'scheduled' && (
					<div className={css.grid}>
						{timers.length === 0 ? (
							<div className={css.empty}>{$L('No scheduled recordings')}</div>
						) : (
							timers.map(timer => (
								<TimerCard
									key={timer.Id}
									timer={timer}
									serverUrl={serverUrl}
									formatScheduledTime={formatScheduledTime}
									onSelect={handleSelectTimer}
								/>
							))
						)}
					</div>
				)}

				{activeTab === 'series' && (
					<div className={css.grid}>
						{seriesTimers.length === 0 ? (
							<div className={css.empty}>{$L('No series recordings')}</div>
						) : (
							seriesTimers.map(seriesTimer => (
								<SeriesTimerCard
									key={seriesTimer.Id}
									seriesTimer={seriesTimer}
									onSelect={handleSelectSeriesTimer}
								/>
							))
						)}
					</div>
				)}
			</div>

			{selectedItem && (
				<div className={css.popup}>
					<PopupContainer className={css.popupContent} spotlightId="recordings-popup">
						<div className={css.popupHeader}>
							<div className={css.popupTitle}>{selectedItem.item.Name}</div>
							{selectedItem.item.EpisodeTitle && (
								<div className={css.popupSubtitle}>{selectedItem.item.EpisodeTitle}</div>
							)}
						</div>

						<div className={css.popupBody}>
							{selectedItem.item.Overview && (
								<div className={css.popupOverview}>{selectedItem.item.Overview}</div>
							)}
							<div className={css.popupMeta}>
								<div>
									{$L('Channel:')}{' '}
									{selectedItem.type === 'seriesTimer' && selectedItem.item.RecordAnyChannel
										? $L('All channels')
										: selectedItem.item.ChannelName}
								</div>
								{selectedItem.type === 'timer' && (
									<div>
										{$L('Scheduled:')} {formatScheduledTime(selectedItem.item.StartDate, selectedItem.item.EndDate)}
									</div>
								)}
								{selectedItem.type === 'seriesTimer' && (
									<div>
										{selectedItem.item.RecordNewOnly ? $L('New episodes only') : $L('All episodes')}
									</div>
								)}
								{selectedItem.type === 'recording' && selectedItem.item.RunTimeTicks && (
									<div>{$L('Duration:')} {formatDuration(selectedItem.item.RunTimeTicks)}</div>
								)}
							</div>
						</div>

						<div className={css.popupActions}>
							{selectedItem.type === 'recording' && (
								<>
									<SpottableButton
										className={`${css.popupBtn} spottable-default`}
										onClick={handlePlaySelectedRecording}
									>
										{$L('Play')}
									</SpottableButton>
									<SpottableButton
										className={`${css.popupBtn} ${css.danger}`}
										onClick={handleDeleteSelectedRecording}
									>
										{$L('Delete')}
									</SpottableButton>
								</>
							)}
							{selectedItem.type === 'timer' && (
								<SpottableButton
									className={`${css.popupBtn} ${css.danger}`}
									onClick={handleCancelSelectedTimer}
								>
									{$L('Cancel Recording')}
								</SpottableButton>
							)}
							{selectedItem.type === 'seriesTimer' && (
								<SpottableButton
									className={`${css.popupBtn} ${css.danger}`}
									onClick={handleCancelSelectedSeriesTimer}
								>
									{$L('Cancel Series')}
								</SpottableButton>
							)}
							{/* Close is the default target whenever the only other action is
							    destructive, so a stray OK press can't delete anything. */}
							<SpottableButton
								className={`${css.popupBtn} ${selectedItem.type === 'recording' ? '' : 'spottable-default'}`}
								onClick={handleClosePopup}
							>
								{$L('Close')}
							</SpottableButton>
						</div>
					</PopupContainer>
				</div>
			)}
		</div>
	);
};

export default Recordings;
