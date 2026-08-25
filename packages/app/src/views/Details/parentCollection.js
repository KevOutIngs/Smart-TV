// Which collection a title belongs to.
//
// No route answers this. Ancestors describes the folders above an item, and a
// collection is a link rather than a folder, so a title in one comes back with
// nothing but its library.
//
// Provider ids are what settle it. A collection built from TMDB carries the same
// id the title names, so the collections and a local match are enough. Anything
// hand made carries no such id and has to be asked what it holds, which is dear
// enough that the answers are kept and the asking done at most once.

const MAX_COLLECTIONS = 500;
const MEMBER_LOOKUPS_AT_ONCE = 8;

const providerId = (item, name) => {
	const ids = item?.ProviderIds;
	if (!ids) return '';
	const key = Object.keys(ids).find((entry) => entry.trim().toLowerCase() === name);
	return key ? String(ids[key] ?? '').trim() : '';
};

// Only the ids and names are read here, and the artwork and watch state the server
// sends by default are the bulk of the answer.
const LEAN = {EnableImages: false, EnableUserData: false, EnableTotalRecordCount: false};

let membershipCache = null;

// Exported so tests can clear the module state between cases.
export const __resetCollectionMembership = () => {
	membershipCache = null;
};

const allCollections = (api) => api.getItems({
	...LEAN,
	IncludeItemTypes: 'BoxSet',
	Recursive: true,
	Limit: MAX_COLLECTIONS,
	Fields: 'ProviderIds'
}).then((result) => result?.Items || []).catch(() => []);

// Every collection asked what it holds, kept for the rest of the session. Built only
// when a title turns out not to name a collection of its own, which on a library of
// TMDB collections is never.
const membershipFor = async (api, collections) => {
	if (membershipCache) return membershipCache;
	const owners = {};
	for (let start = 0; start < collections.length; start += MEMBER_LOOKUPS_AT_ONCE) {
		const batch = collections.slice(start, start + MEMBER_LOOKUPS_AT_ONCE);
		// eslint-disable-next-line no-await-in-loop
		await Promise.all(batch.map(async (collection) => {
			const members = await api.getItems({...LEAN, ParentId: collection.Id})
				.then((result) => result?.Items || [])
				.catch(() => []);
			members.forEach((member) => {
				if (member?.Id && !owners[member.Id]) owners[member.Id] = collection;
			});
		}));
	}
	membershipCache = owners;
	return owners;
};

export const findParentCollection = async (api, item) => {
	if (!api || !item?.Id) return null;
	const collections = await allCollections(api);
	if (collections.length === 0) return null;

	const wanted = providerId(item, 'tmdbcollection');
	if (wanted) {
		const match = collections.find((collection) => providerId(collection, 'tmdb') === wanted);
		if (match) return match;
	}

	const owners = await membershipFor(api, collections);
	return owners[item.Id] || null;
};
