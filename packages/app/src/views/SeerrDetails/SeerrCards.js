import {memo, useCallback, useRef} from 'react';
import Image from '@enact/sandstone/Image';

import seerrApi from '../../services/seerrApi';
import {KEYS} from '../../utils/keys';
import {LastFocusedContainer, SpottableDiv} from './seerrFocus';

import css from './SeerrDetails.module.less';

// The small repeated pieces of the detail screen: a cast member, a related title, a keyword,
// and the horizontal row that holds a set of them.

export const CastCard = memo(({person, onSelect}) => {
	const photoUrl = person.profilePath
		? seerrApi.getImageUrl(person.profilePath, 'w185')
		: null;

	const handleClick = useCallback(() => {
		onSelect(person);
	}, [person, onSelect]);

	return (
		<SpottableDiv className={css.castCard} onClick={handleClick}>
			<div className={css.castPhotoContainer}>
				{photoUrl ? (
					<Image className={css.castPhoto} src={photoUrl} sizing="fill" />
				) : (
					<div className={css.castPhotoPlaceholder}>{person.name?.[0]}</div>
				)}
			</div>
			<p className={css.castName}>{person.name}</p>
			{person.character && <p className={css.castCharacter}>{person.character}</p>}
		</SpottableDiv>
	);
});

export const MediaCard = memo(({item, onSelect}) => {
	const posterUrl = seerrApi.getImageUrl(item.posterPath || item.poster_path, 'w342');
	const title = item.title || item.name;

	const handleClick = useCallback(() => {
		onSelect(item);
	}, [item, onSelect]);

	return (
		<SpottableDiv className={css.recommendationCard} onClick={handleClick}>
			{posterUrl ? (
				<Image className={css.recommendationPoster} src={posterUrl} sizing="fill" />
			) : (
				<div className={css.recommendationNoPoster}>{title?.[0]}</div>
			)}
			<div className={css.recommendationTitle}>{title}</div>
		</SpottableDiv>
	);
});

export const KeywordTag = memo(({keyword, onSelect}) => {
	const handleClick = useCallback(() => {
		onSelect(keyword);
	}, [keyword, onSelect]);

	return (
		<SpottableDiv className={css.keywordTag} onClick={handleClick}>
			{keyword.name}
		</SpottableDiv>
	);
});

export const HorizontalMediaRow = memo(({title, items, onSelect, rowIndex, onNavigateUp, onNavigateDown, sectionClass}) => {
	const scrollerRef = useRef(null);

	const handleFocus = useCallback((e) => {
		const card = e.target.closest(`.${css.recommendationCard}`);
		const scroller = scrollerRef.current;
		if (card && scroller) {
			const cardRect = card.getBoundingClientRect();
			const scrollerRect = scroller.getBoundingClientRect();

			if (cardRect.left < scrollerRect.left) {
				scroller.scrollLeft -= (scrollerRect.left - cardRect.left + 50);
			} else if (cardRect.right > scrollerRect.right) {
				scroller.scrollLeft += (cardRect.right - scrollerRect.right + 50);
			}
		}
	}, []);

	const handleKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP) {
			e.preventDefault();
			e.stopPropagation();
			onNavigateUp?.(rowIndex);
		} else if (e.keyCode === KEYS.DOWN) {
			e.stopPropagation();
			onNavigateDown?.(rowIndex);
		}
	}, [rowIndex, onNavigateUp, onNavigateDown]);

	if (!items || items.length === 0) return null;

	return (
		<div className={sectionClass}>
			<h2 className={css.sectionTitle}>{title}</h2>
			<LastFocusedContainer
				className={css.rowContainer}
				spotlightId={`details-row-${rowIndex}`}
				data-row-index={rowIndex}
				onKeyDown={handleKeyDown}
				ref={scrollerRef}
				onFocus={handleFocus}
			>
				{items.map(item => (
					<MediaCard key={item.id} item={item} onSelect={onSelect} />
				))}
			</LastFocusedContainer>
		</div>
	);
});
