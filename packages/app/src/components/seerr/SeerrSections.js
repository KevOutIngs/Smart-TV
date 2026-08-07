import {memo, useCallback, useMemo} from 'react';
import $L from '@enact/i18n/$L';

import seerrApi from '../../services/seerrApi';
import {buildMediaFacts} from '../../utils/seerrMediaFacts';
import {LastFocusedContainer, SpottableDiv} from './seerrFocus';

import css from './SeerrSections.module.less';

// The parts of a title that only Seerr knows: what it is filed under, the production facts the
// library has no field for, and the collection it belongs to. Shared by both detail styles so
// the Seerr block reads the same whichever one the viewer picked.

const Chip = memo(({entry, onSelect}) => {
	const handleClick = useCallback(() => onSelect(entry), [entry, onSelect]);
	return <SpottableDiv className={css.chip} onClick={handleClick}>{entry.name}</SpottableDiv>;
});

export const hasSeerrChips = (details) => Boolean(
	details?.genres?.length || details?.networks?.length || details?.keywords?.length
);

// Genres, networks and keywords each lead into Seerr browse rather than the library, which is
// why they stay separate from the library's own genres even though they look alike.
export const SeerrChips = memo(({details, mediaType, seerrNav}) => {
	const handleGenre = useCallback((genre) => {
		seerrNav?.onSelectGenre?.(genre.id, genre.name, mediaType);
	}, [seerrNav, mediaType]);

	const handleNetwork = useCallback((network) => {
		seerrNav?.onSelectNetwork?.(network.id, network.name);
	}, [seerrNav]);

	const handleKeyword = useCallback((keyword) => {
		seerrNav?.onSelectKeyword?.(keyword, mediaType);
	}, [seerrNav, mediaType]);

	if (!hasSeerrChips(details)) return null;

	return (
		<div>
			<h3 className={css.heading}>{$L('Browse')}</h3>
			<LastFocusedContainer className={css.chipList}>
				{(details.genres || []).map((genre) => (
					<Chip key={`genre-${genre.id}`} entry={genre} onSelect={handleGenre} />
				))}
				{(details.networks || []).map((network) => (
					<Chip key={`network-${network.id}`} entry={network} onSelect={handleNetwork} />
				))}
				{(details.keywords || []).map((keyword) => (
					<Chip key={`keyword-${keyword.id}`} entry={keyword} onSelect={handleKeyword} />
				))}
			</LastFocusedContainer>
		</div>
	);
});

export const SeerrFacts = memo(({details, mediaType}) => {
	const facts = useMemo(() => buildMediaFacts(details, mediaType), [details, mediaType]);
	if (facts.length === 0) return null;

	return (
		<div className={css.facts}>
			{facts.map((fact) => (
				<div key={fact.label} className={css.factRow}>
					<span className={css.factLabel}>{fact.label}</span>
					<span className={css.factValue}>{fact.value}</span>
				</div>
			))}
		</div>
	);
});

export const SeerrCollectionBanner = memo(({collection, onOpen}) => {
	const handleClick = useCallback(() => {
		if (collection?.id != null) onOpen?.(collection.id);
	}, [collection, onOpen]);

	if (!collection || !onOpen) return null;

	const backdrop = collection.backdropPath
		? {backgroundImage: `url(${seerrApi.getImageUrl(collection.backdropPath, 'w780')})`}
		: undefined;

	return (
		<SpottableDiv className={css.collectionBanner} onClick={handleClick} style={backdrop}>
			<div className={css.collectionBannerScrim} />
			<span className={css.collectionBannerText}>
				{$L('Part of {name}').replace('{name}', collection.name || '')}
			</span>
			<span className={css.collectionBannerCta}>{$L('View Collection')} ›</span>
		</SpottableDiv>
	);
});
