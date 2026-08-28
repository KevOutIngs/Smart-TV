import {useCallback} from 'react';
import $L from '@enact/i18n/$L';

import MediaRow from '../../components/MediaRow';
import RatingsRow from '../../components/RatingsRow';
import usePersonSeerrCredits from '../../hooks/usePersonSeerrCredits';
import {getImageUrl} from '../../utils/helpers';
import {isMdblistEnabled} from '../../services/mdblistApi';

import css from './Details.module.less';

const PersonScreen = ({item, serverUrl, settings, filmography, personDates, birthPlace, onSelectItem, onSelectSeerrItem}) => {
	const {appearances, crewCredits} = usePersonSeerrCredits(item.ProviderIds?.Tmdb);
	const {movies, series, guestAppearances, musicVideos} = filmography || {movies: [], series: [], guestAppearances: [], musicVideos: []};

	const handleSelectCredit = useCallback((credit) => {
		if (credit?._seerrRaw) onSelectSeerrItem?.(credit._seerrRaw);
	}, [onSelectSeerrItem]);

	return (
		<>
			<div className={css.personHeader}>
				<div className={css.personPhotoWrapper}>
					{item.ImageTags?.Primary ? (
						<img
							src={getImageUrl(serverUrl, item.Id, 'Primary', {maxHeight: 450, quality: 90})}
							className={css.personPhoto}
							alt=""
						/>
					) : (
						<div className={css.personPhotoPlaceholder}>
							<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"/></svg>
						</div>
					)}
				</div>
				<div className={css.personInfo}>
					<h1 className={css.title}>{item.Name}</h1>
					<div className={css.infoRow}>
						{personDates?.map((line) => (
							<span key={line} className={css.infoItem}>{line}</span>
						))}
						{birthPlace && <span className={css.infoItem}>{birthPlace}</span>}
					</div>
					<RatingsRow item={item} serverUrl={serverUrl} pluginEnabled={isMdblistEnabled(settings)} />
					{item.Overview && <p className={css.overview}>{item.Overview}</p>}
				</div>
			</div>

			<div className={css.sectionsContainer}>
				{movies.length > 0 && (
					<MediaRow title={`${$L('Movies')} (${movies.length})`} items={movies} serverUrl={serverUrl} onSelectItem={onSelectItem} className={css.inlineRow} />
				)}
				{series.length > 0 && (
					<MediaRow title={`${$L('Series')} (${series.length})`} items={series} serverUrl={serverUrl} onSelectItem={onSelectItem} className={css.inlineRow} />
				)}
				{guestAppearances.length > 0 && (
					<MediaRow title={`${$L('Guest Appearances')} (${guestAppearances.length})`} items={guestAppearances} serverUrl={serverUrl} cardType="landscape" onSelectItem={onSelectItem} className={css.inlineRow} />
				)}
				{musicVideos.length > 0 && (
					<MediaRow title={`${$L('Music Videos')} (${musicVideos.length})`} items={musicVideos} serverUrl={serverUrl} onSelectItem={onSelectItem} className={css.inlineRow} />
				)}
				{crewCredits.length > 0 && (
					<MediaRow title={`${$L('Crew Contributions (Seerr)')} (${crewCredits.length})`} items={crewCredits} serverUrl={serverUrl} onSelectItem={handleSelectCredit} className={css.inlineRow} />
				)}
				{appearances.length > 0 && (
					<MediaRow title={`${$L('Appearances (Seerr)')} (${appearances.length})`} items={appearances} serverUrl={serverUrl} onSelectItem={handleSelectCredit} className={css.inlineRow} />
				)}
			</div>
		</>
	);
};

export default PersonScreen;
