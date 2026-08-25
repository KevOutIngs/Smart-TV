import {findParentCollection, __resetCollectionMembership} from './parentCollection';

const ACE = {Id: 'box-ace', Name: 'Ace Ventura Collection', ProviderIds: {Tmdb: '3167'}};
const ALIEN = {Id: 'box-alien', Name: 'Alien Collection', ProviderIds: {Tmdb: '8091'}};
const HAND_MADE = {Id: 'box-mine', Name: 'Saturday Night'};

// Stands in for the server: the collections it holds, and what each one contains.
const serverWith = (collections, members = {}) => {
	const calls = {collections: 0, members: 0};
	const api = {
		getItems: ({IncludeItemTypes, ParentId}) => {
			if (IncludeItemTypes === 'BoxSet') {
				calls.collections++;
				return Promise.resolve({Items: collections});
			}
			calls.members++;
			return Promise.resolve({Items: members[ParentId] || []});
		}
	};
	return {api, calls};
};

const movie = (over = {}) => ({Id: 'movie-1', Name: 'Ace Ventura', ...over});

describe('findParentCollection', () => {
	beforeEach(() => __resetCollectionMembership());

	test('a title naming a collection is matched on that id alone', async () => {
		const {api, calls} = serverWith([ALIEN, ACE]);

		const found = await findParentCollection(api, movie({ProviderIds: {TmdbCollection: '3167'}}));

		expect(found).toBe(ACE);
		expect(calls.members).toBe(0);
	});

	test('the ids are read whatever case the server spells them in', async () => {
		const {api} = serverWith([{...ACE, ProviderIds: {tmdb: '3167'}}]);

		const found = await findParentCollection(api, movie({ProviderIds: {tmdbcollection: '3167'}}));

		expect(found.Id).toBe('box-ace');
	});

	test('a hand made collection is found by asking each one what it holds', async () => {
		const {api, calls} = serverWith([ACE, HAND_MADE], {'box-mine': [{Id: 'movie-1'}]});

		const found = await findParentCollection(api, movie());

		expect(found).toBe(HAND_MADE);
		expect(calls.members).toBe(2);
	});

	test('what each collection holds is asked once and reused', async () => {
		const {api, calls} = serverWith([ACE, HAND_MADE], {'box-mine': [{Id: 'movie-1'}, {Id: 'movie-2'}]});

		await findParentCollection(api, movie());
		await findParentCollection(api, movie({Id: 'movie-2'}));

		expect(calls.members).toBe(2);
	});

	test('a title in no collection comes back with nothing', async () => {
		const {api} = serverWith([ACE], {'box-ace': [{Id: 'someone-else'}]});

		expect(await findParentCollection(api, movie({Id: 'stray'}))).toBeNull();
	});

	test('a collection id nothing on the server carries falls through to the asking', async () => {
		const {api, calls} = serverWith([ACE], {'box-ace': [{Id: 'movie-1'}]});

		const found = await findParentCollection(api, movie({ProviderIds: {TmdbCollection: '999999'}}));

		expect(found).toBe(ACE);
		expect(calls.members).toBe(1);
	});

	test('a server with no collections is left alone', async () => {
		const {api, calls} = serverWith([]);

		expect(await findParentCollection(api, movie())).toBeNull();
		expect(calls.members).toBe(0);
	});

	test('a collection that cant be read is skipped rather than failing the rest', async () => {
		const api = {
			getItems: ({IncludeItemTypes, ParentId}) => {
				if (IncludeItemTypes === 'BoxSet') return Promise.resolve({Items: [ACE, HAND_MADE]});
				if (ParentId === 'box-ace') return Promise.reject(new Error('gone'));
				return Promise.resolve({Items: [{Id: 'movie-1'}]});
			}
		};

		expect(await findParentCollection(api, movie())).toBe(HAND_MADE);
	});

	test('nothing to go on is handled without throwing', async () => {
		const {api} = serverWith([ACE]);

		expect(await findParentCollection(api, null)).toBeNull();
		expect(await findParentCollection(null, movie())).toBeNull();
	});
});
