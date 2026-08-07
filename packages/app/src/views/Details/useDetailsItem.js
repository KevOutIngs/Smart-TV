import {useState, useEffect, useCallback} from 'react';
import $L from '@enact/i18n/$L';

import * as playback from '../../services/playback';
import {fetchTmdbSeasonRatings, resolveSeriesTmdbId, isRatingSourceAllowed} from '../../services/mdblistApi';
import {getItemSubtitlePref, getSeriesSubtitlePref} from '../../services/subtitlePrefs';

// Everything the screen shows about one item. The item itself is fetched first and rendered
// on its own, then the rows that hang off it fill in behind, because waiting for all of them
// would leave the screen blank for as long as the slowest one takes.
const useDetailsItem = ({itemId, effectiveApi, effectiveServerUrl, settings, tagWithServerInfo, skip}) => {
	const [item, setItem] = useState(null);
	const [seasons, setSeasons] = useState([]);
	const [episodes, setEpisodes] = useState([]);
	const [similar, setSimilar] = useState([]);
	const [extras, setExtras] = useState([]);
	const [cast, setCast] = useState([]);
	const [nextUp, setNextUp] = useState([]);
	const [nextEpisode, setNextEpisode] = useState(null);
	const [collectionItems, setCollectionItems] = useState([]);
	const [parentCollection, setParentCollection] = useState([]);
	const [parentCollectionName, setParentCollectionName] = useState('');
	const [albumTracks, setAlbumTracks] = useState([]);
	const [artistAlbums, setArtistAlbums] = useState([]);
	const [playlistItems, setPlaylistItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [episodeRatings, setEpisodeRatings] = useState({});

	const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
	const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
	const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1);

	useEffect(() => {
		// Whatever the last item brought with it has to go before anything else, or its rows
		// stay on screen under the next title.
		setSeasons([]);
		setEpisodes([]);
		setEpisodeRatings({});
		setSimilar([]);
		setExtras([]);
		setCast([]);
		setNextUp([]);
		setCollectionItems([]);
		setParentCollection([]);
		setParentCollectionName('');
		setAlbumTracks([]);
		setArtistAlbums([]);
		setPlaylistItems([]);

		// A Seerr title has no id the server would recognise, so asking for one would only 404
		// and leave the screen spinning.
		if (skip) {
			setIsLoading(false);
			return;
		}

		const loadItem = async () => {
			setIsLoading(true);

			let data;
			try {
				data = await effectiveApi.getItemForDetail(itemId);
			} catch (err) {
				console.error('[Details] Error loading item', err);
				setIsLoading(false);
				return;
			}

			setItem(tagWithServerInfo(data));
			setSelectedVersionIndex(0);
			const ms = data.MediaSources?.[0];
			if (ms) {
				const initAudioStreams = ms.MediaStreams?.filter(s => s.Type === 'Audio') || [];
				const initSubtitleStreams = ms.MediaStreams?.filter(s => s.Type === 'Subtitle') || [];
				if (ms.DefaultAudioStreamIndex != null) {
					const idx = initAudioStreams.findIndex(s => s.Index === ms.DefaultAudioStreamIndex);
					if (idx >= 0) setSelectedAudioIndex(idx);
				}
				// Show the remembered pick as active so it doesn't look like it needs
				// reselecting. The per-item index restores the exact track, and an episode
				// otherwise inherits its series' remembered language.
				let savedSubtitlePos = null;
				const savedItemIndex = await getItemSubtitlePref(itemId);
				if (savedItemIndex !== undefined) {
					if (savedItemIndex < 0) {
						savedSubtitlePos = -1;
					} else {
						const pos = initSubtitleStreams.findIndex(s => s.Index === savedItemIndex);
						if (pos >= 0) savedSubtitlePos = pos;
					}
				}
				if (savedSubtitlePos === null && data.SeriesId) {
					const savedLanguage = await getSeriesSubtitlePref(data.SeriesId);
					if (savedLanguage !== undefined) {
						if (!savedLanguage) {
							savedSubtitlePos = -1;
						} else {
							const pos = initSubtitleStreams.findIndex(s => s.Language === savedLanguage);
							if (pos >= 0) savedSubtitlePos = pos;
						}
					}
				}
				if (savedSubtitlePos !== null) {
					setSelectedSubtitleIndex(savedSubtitlePos);
				} else if (ms.DefaultSubtitleStreamIndex != null) {
					const idx = initSubtitleStreams.findIndex(s => s.Index === ms.DefaultSubtitleStreamIndex);
					if (idx >= 0) setSelectedSubtitleIndex(idx);
				} else {
					setSelectedSubtitleIndex(-1);
				}
			} else {
				setSelectedAudioIndex(0);
				setSelectedSubtitleIndex(-1);
			}
			if (data.People?.length > 0) {
				setCast(data.People.slice(0, 20));
			}

			setIsLoading(false);

			const bg = async () => {
				if (data.Type === 'Series') {
					const [seasonsData, nextUpData] = await Promise.all([
						effectiveApi.getSeasons(itemId).catch(() => null),
						effectiveApi.getNextUp(1, itemId).catch(() => null)
					]);
					if (seasonsData) setSeasons(tagWithServerInfo(seasonsData.Items || []));
					if (nextUpData?.Items?.length > 0) setNextUp(tagWithServerInfo(nextUpData.Items));
				}

				if (data.Type === 'Season') {
					const episodesData = await effectiveApi.getEpisodes(data.SeriesId, data.Id).catch(() => null);
					if (episodesData) setEpisodes(tagWithServerInfo(episodesData.Items || []));
				}

				if (data.Type === 'Episode') {
					const seasonId = data.SeasonId || data.ParentId;
					if (data.SeriesId && seasonId) {
						const episodesData = await effectiveApi.getEpisodes(data.SeriesId, seasonId).catch(() => null);
						if (episodesData) setEpisodes(tagWithServerInfo(episodesData.Items || []));
					}
				}

				if (data.Type === 'BoxSet') {
					const collectionData = await effectiveApi.getItems({
						ParentId: data.Id,
						SortBy: 'ProductionYear,SortName',
						SortOrder: 'Ascending',
						Fields: 'PrimaryImageAspectRatio,ProductionYear'
					}).catch(() => null);
					if (collectionData) setCollectionItems(tagWithServerInfo(collectionData.Items || []));
				}

				if (data.Type === 'MusicAlbum') {
					const [tracksData, albumSimilarData] = await Promise.all([
						effectiveApi.getAlbumTracks(data.Id).catch(() => null),
						effectiveApi.getSimilar(itemId).catch(() => null)
					]);
					if (tracksData) setAlbumTracks(tagWithServerInfo(tracksData.Items || []));
					if (albumSimilarData) setSimilar(tagWithServerInfo(albumSimilarData.Items || []));
				}

				if (data.Type === 'MusicArtist') {
					const [albumsData, artistSimilarData] = await Promise.all([
						effectiveApi.getAlbumsByArtist(data.Id).catch(() => null),
						effectiveApi.getSimilar(itemId).catch(() => null)
					]);
					if (albumsData) setArtistAlbums(tagWithServerInfo(albumsData.Items || []));
					if (artistSimilarData) setSimilar(tagWithServerInfo(artistSimilarData.Items || []));
				}

				if (data.Type === 'Playlist') {
					const playlistData = await effectiveApi.getPlaylistItems(data.Id).catch(() => null);
					if (playlistData) setPlaylistItems(tagWithServerInfo(playlistData.Items || []));
				}

				const needsSimilar = data.Type !== 'Person' && data.Type !== 'BoxSet' &&
					data.Type !== 'MusicAlbum' && data.Type !== 'MusicArtist' && data.Type !== 'Playlist';
				const needsExtras = data.Type === 'Movie' || data.Type === 'Episode' || data.Type === 'Video';
				const needsBoxSet = data.Type === 'Movie' || data.Type === 'Video';

				const [similarData, extrasData, ancestorsData] = await Promise.all([
					needsSimilar ? effectiveApi.getSimilar(itemId).catch(() => null) : Promise.resolve(null),
					needsExtras ? effectiveApi.getSpecialFeatures(itemId).catch(() => null) : Promise.resolve(null),
					needsBoxSet ? effectiveApi.getAncestors(itemId).catch(() => null) : Promise.resolve(null)
				]);

				if (similarData) setSimilar(tagWithServerInfo(similarData.Items || []));
				if (extrasData) setExtras(tagWithServerInfo(extrasData.filter(e => e.Id !== itemId)));
				if (ancestorsData) {
					const boxSet = ancestorsData.find(a => a.Type === 'BoxSet') || null;
					if (boxSet) {
						setParentCollectionName(boxSet.Name || $L('Collection'));
						const colData = await effectiveApi.getItems({
							ParentId: boxSet.Id,
							SortBy: 'PremiereDate,SortName',
							SortOrder: 'Ascending',
							Fields: 'PrimaryImageAspectRatio,ProductionYear'
						}).catch(() => null);
						if (colData) setParentCollection(tagWithServerInfo(colData.Items || []));
					}
				}

				if (data.Type === 'Person') {
					const filmography = await effectiveApi.getItemsByPerson(itemId, 50).catch(() => null);
					if (filmography) setSimilar(tagWithServerInfo(filmography.Items || []));
				}
			};

			bg().catch(() => {});
		};
		loadItem();
	}, [effectiveApi, itemId, tagWithServerInfo, skip]);

	useEffect(() => {
		if (!item || !episodes.length) return undefined;
		if (!settings.useMoonfinPlugin || !settings.tmdbEpisodeRatingsEnabled) return undefined;
		if (!isRatingSourceAllowed(settings.mdblistRatingSources, 'tmdb')) return undefined;
		if (item.Type !== 'Season' && item.Type !== 'Episode') return undefined;

		const seasonNumber = item.Type === 'Season' ? item.IndexNumber : item.ParentIndexNumber;
		if (seasonNumber == null) return undefined;

		let cancelled = false;
		// The SeasonRatings route wants the series TMDB id, not the Season/Episode
		// item's own provider id.
		resolveSeriesTmdbId(item).then(seriesTmdbId => {
			if (cancelled || !seriesTmdbId) return null;
			return fetchTmdbSeasonRatings(effectiveServerUrl, seriesTmdbId, seasonNumber);
		}).then(data => {
			if (cancelled || !data?.episodes) return;
			const ratingsMap = {};
			for (const ep of data.episodes) {
				ratingsMap[ep.episodeNumber] = ep.voteAverage;
			}
			setEpisodeRatings(ratingsMap);
		});
		return () => { cancelled = true; };
	}, [item, episodes.length, settings.useMoonfinPlugin, settings.tmdbEpisodeRatingsEnabled, settings.mdblistRatingSources, effectiveServerUrl]);

	// The card has to reach into the next season, which the current season's episode
	// list can't answer on its own.
	useEffect(() => {
		if (item?.Type !== 'Episode') {
			setNextEpisode(null);
			return undefined;
		}
		let cancelled = false;
		playback.getNextEpisode(item).then((next) => {
			if (!cancelled) setNextEpisode(next);
		});
		return () => { cancelled = true; };
	}, [item]);

	const refreshItem = useCallback(async () => {
		try {
			const data = await effectiveApi.getItemForDetail(itemId);
			if (data) {
				setItem(tagWithServerInfo(data));
			}
		} catch (err) {
			console.error('[Details] Error refreshing item', err);
		}
	}, [effectiveApi, itemId, tagWithServerInfo]);

	return {
		item,
		setItem,
		isLoading,
		seasons,
		episodes,
		similar,
		extras,
		cast,
		nextUp,
		nextEpisode,
		collectionItems,
		parentCollection,
		parentCollectionName,
		albumTracks,
		artistAlbums,
		playlistItems,
		setPlaylistItems,
		episodeRatings,
		selectedVersionIndex,
		setSelectedVersionIndex,
		selectedAudioIndex,
		setSelectedAudioIndex,
		selectedSubtitleIndex,
		setSelectedSubtitleIndex,
		refreshItem
	};
};

export default useDetailsItem;
