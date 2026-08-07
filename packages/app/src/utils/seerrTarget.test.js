import {seerrTargetFor} from './seerrTarget';

const movie = (providerIds) => ({Type: 'Movie', ProviderIds: providerIds});

describe('seerrTargetFor', () => {
	it('hands back a number, since Seerr rejects a request whose mediaId is a string', () => {
		expect(seerrTargetFor(movie({Tmdb: '603'}))).toEqual({mediaId: 603, mediaType: 'movie'});
	});

	it('calls a series tv, which is what Seerr calls it', () => {
		expect(seerrTargetFor({Type: 'Series', ProviderIds: {Tmdb: '1399'}}))
			.toEqual({mediaId: 1399, mediaType: 'tv'});
	});

	it('stays idle for anything with no Seerr counterpart', () => {
		const idle = {mediaId: null, mediaType: null};
		expect(seerrTargetFor({Type: 'Episode', ProviderIds: {Tmdb: '603'}})).toEqual(idle);
		expect(seerrTargetFor({Type: 'Season', ProviderIds: {Tmdb: '603'}})).toEqual(idle);
		expect(seerrTargetFor(null)).toEqual(idle);
	});

	it('stays idle when the title carries no usable TMDB id', () => {
		const idle = {mediaId: null, mediaType: null};
		expect(seerrTargetFor(movie({Imdb: 'tt0133093'}))).toEqual(idle);
		expect(seerrTargetFor(movie({Tmdb: ''}))).toEqual(idle);
		expect(seerrTargetFor(movie({Tmdb: 'not-a-number'}))).toEqual(idle);
		expect(seerrTargetFor(movie(undefined))).toEqual(idle);
	});
});
