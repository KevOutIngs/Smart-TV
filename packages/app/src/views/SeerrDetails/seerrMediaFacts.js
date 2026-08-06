// The facts panel beside the overview. Which facts exist depends on the media type and on
// what the server actually filled in, so anything missing is left out rather than shown blank.

import $L from '@enact/i18n/$L';

import {formatCurrency, formatDate, formatRuntime} from './seerrBadges';

export const buildMediaFacts = (details, mediaType) => {
	if (!details) return [];
	const facts = [];

	const tmdbScore = Number(details.voteAverage);
	if (Number.isFinite(tmdbScore) && tmdbScore > 0) {
		facts.push({label: $L('TMDB Score'), value: `${Math.round(tmdbScore * 10)}%`});
	}

	const productionStatus = details.status;
	if (productionStatus) {
		facts.push({label: $L('Status'), value: productionStatus});
	}

	if (mediaType === 'tv') {
		if (details.firstAirDate) {
			const formatted = formatDate(details.firstAirDate);
			if (formatted) facts.push({label: $L('First Air Date'), value: formatted});
		}
		if (details.lastAirDate) {
			const formatted = formatDate(details.lastAirDate);
			if (formatted) facts.push({label: $L('Last Air Date'), value: formatted});
		}
		if (details.numberOfSeasons) {
			facts.push({label: $L('Seasons'), value: details.numberOfSeasons.toString()});
		}
		if (details.networks?.length > 0) {
			facts.push({label: $L('Networks'), value: details.networks.slice(0, 3).map(n => n.name).join(', ')});
		}
	}

	if (mediaType === 'movie') {
		if (details.releaseDate) {
			const formatted = formatDate(details.releaseDate);
			if (formatted) facts.push({label: $L('Release Date'), value: formatted});
		}
		if (details.runtime) {
			facts.push({label: $L('Runtime'), value: formatRuntime(details.runtime)});
		}
		if (details.budget) {
			const formatted = formatCurrency(details.budget);
			if (formatted) facts.push({label: $L('Budget'), value: formatted});
		}
		if (details.revenue) {
			const formatted = formatCurrency(details.revenue);
			if (formatted) facts.push({label: $L('Revenue'), value: formatted});
		}
	}

	return facts;
};
