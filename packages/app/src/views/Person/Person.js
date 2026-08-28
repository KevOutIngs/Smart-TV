import {useState, useEffect, useCallback} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import Image from '@enact/sandstone/Image';
import {useAuth} from '../../context/AuthContext';
import MediaRow from '../../components/MediaRow';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePersonSeerrCredits from '../../hooks/usePersonSeerrCredits';
import {KEYS} from '../../utils/keys';
import {personDateLines, splitFilmography} from '../../utils/personCredits';

import css from './Person.module.less';

const SpottableDiv = Spottable('div');

const Person = ({personId, onSelectItem, onSelectSeerrItem, onSelectSeerrPerson}) => {
	const {api, serverUrl} = useAuth();
	const [person, setPerson] = useState(null);
	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [overviewExpanded, setOverviewExpanded] = useState(false);
	const handleToggleOverview = useCallback(() => setOverviewExpanded(prev => !prev), []);

	useEffect(() => {
		const loadPerson = async () => {
			try {
				const [personData, itemsData] = await Promise.all([
					api.getPerson(personId),
					api.getItemsByPerson(personId)
				]);
				setPerson(personData);
				setItems(itemsData.Items || []);
			} catch (err) {
				console.error('Failed to load person:', err);
			} finally {
				setIsLoading(false);
			}
		};

		if (personId) {
			setOverviewExpanded(false);
			loadPerson();
		}
	}, [api, personId]);

	const tmdbId = person?.ProviderIds?.Tmdb;
	const {appearances, crewCredits, seerrEnabled} = usePersonSeerrCredits(tmdbId);

	const handleSelectItem = useCallback((item) => {
		onSelectItem?.(item);
	}, [onSelectItem]);

	const handleSelectCredit = useCallback((item) => {
		if (item?._seerrRaw) onSelectSeerrItem?.(item._seerrRaw);
	}, [onSelectSeerrItem]);

	const handleToggleFavorite = useCallback(async () => {
		if (!person) return;
		const newVal = !person.UserData?.IsFavorite;
		try {
			await api.setFavorite(person.Id, newVal);
			setPerson(prev => ({
				...prev,
				UserData: {...prev.UserData, IsFavorite: newVal}
			}));
		} catch { /* ignore */ }
	}, [api, person]);

	const handleOpenSeerr = useCallback(() => {
		if (tmdbId) onSelectSeerrPerson?.(tmdbId, person?.Name);
	}, [tmdbId, person, onSelectSeerrPerson]);

	const handleHeaderKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus('navbar');
		}
	}, []);

	if (isLoading) {
		return (
			<div className={css.page}>
				<LoadingSpinner />
			</div>
		);
	}

	if (!person) {
		return (
			<div className={css.page}>
				<div className={css.empty}>{$L('Person not found')}</div>
			</div>
		);
	}

	const imageUrl = person.ImageTags?.Primary
		? `${serverUrl}/Items/${person.Id}/Images/Primary?maxHeight=400&quality=90`
		: null;
	const dateLines = personDateLines(person.PremiereDate, person.EndDate);
	const birthPlace = person.ProductionLocations?.[0];
	const {movies, series, guestAppearances, musicVideos} = splitFilmography(items);
	const showSeerrButton = Boolean(tmdbId && seerrEnabled && onSelectSeerrPerson);

	return (
		<div className={css.page}>
			<div className={css.content}>
				<div className={css.personInfo}>
					{imageUrl ? (
						<Image className={css.personImage} src={imageUrl} sizing="fill" />
					) : (
						<div className={css.noImage}>{person.Name?.[0]}</div>
					)}
					<div className={css.personDetails}>
						<h1 className={css.name}>{person.Name}</h1>
						{dateLines.map((line) => (
							<div key={line} className={css.meta}>{line}</div>
						))}
						{birthPlace && <div className={css.meta}>{birthPlace}</div>}
						{person.Overview && (
							<SpottableDiv
								className={`${css.overview} ${overviewExpanded ? css.overviewExpanded : ''}`}
								onClick={handleToggleOverview}
								onKeyDown={handleHeaderKeyDown}
								spotlightId="person-overview"
							>
								{person.Overview}
								<span className={css.overviewToggle}>{overviewExpanded ? $L('Show Less') : $L('Show More')}</span>
							</SpottableDiv>
						)}
						<div className={css.personActions}>
							<SpottableDiv className={css.favoriteBtn} onClick={handleToggleFavorite} onKeyDown={handleHeaderKeyDown} spotlightId="person-favorite-btn">
								<svg className={`${css.favoriteIcon} ${person.UserData?.IsFavorite ? css.favorited : ''}`} viewBox="0 -960 960 960" fill="currentColor">
									<path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z"/>
								</svg>
								<span>{person.UserData?.IsFavorite ? $L('Favorited') : $L('Favorite')}</span>
							</SpottableDiv>
							{showSeerrButton && (
								<SpottableDiv className={css.favoriteBtn} onClick={handleOpenSeerr} onKeyDown={handleHeaderKeyDown} spotlightId="person-seerr-btn">
									<span>{$L('Seerr')}</span>
								</SpottableDiv>
							)}
						</div>
					</div>
				</div>

				{movies.length > 0 && (
					<MediaRow title={`${$L('Movies')} (${movies.length})`} items={movies} serverUrl={serverUrl} onSelectItem={handleSelectItem} rowId="person-movies" />
				)}
				{series.length > 0 && (
					<MediaRow title={`${$L('Series')} (${series.length})`} items={series} serverUrl={serverUrl} onSelectItem={handleSelectItem} rowId="person-series" />
				)}
				{guestAppearances.length > 0 && (
					<MediaRow title={`${$L('Guest Appearances')} (${guestAppearances.length})`} items={guestAppearances} serverUrl={serverUrl} cardType="landscape" onSelectItem={handleSelectItem} rowId="person-guest" />
				)}
				{musicVideos.length > 0 && (
					<MediaRow title={`${$L('Music Videos')} (${musicVideos.length})`} items={musicVideos} serverUrl={serverUrl} onSelectItem={handleSelectItem} rowId="person-music-videos" />
				)}
				{crewCredits.length > 0 && (
					<MediaRow title={`${$L('Crew Contributions (Seerr)')} (${crewCredits.length})`} items={crewCredits} serverUrl={serverUrl} onSelectItem={handleSelectCredit} rowId="person-seerr-crew" />
				)}
				{appearances.length > 0 && (
					<MediaRow title={`${$L('Appearances (Seerr)')} (${appearances.length})`} items={appearances} serverUrl={serverUrl} onSelectItem={handleSelectCredit} rowId="person-seerr-appearances" />
				)}
			</div>
		</div>
	);
};

export default Person;
