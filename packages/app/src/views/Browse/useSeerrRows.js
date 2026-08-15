import {useEffect, useState} from 'react';

import {getSeerrHomeRowConfigs, fetchSeerrHomeRow, SEERR_SECTION_TO_CONFIG} from '../../utils/seerrHomeRows';

// The discover rows Seerr provides. They are fetched separately from the library rows because
// they come from a different server and only exist while Seerr is connected and signed in.
const useSeerrRows = ({seerrEnabled, seerrAuthenticated, seerrUserId, homeRows}) => {
	const [seerrRows, setSeerrRows] = useState([]);

	useEffect(() => {
		if (!seerrEnabled || !seerrAuthenticated) {
			setSeerrRows([]);
			return undefined;
		}
		const enabledSections = (homeRows || []).filter((r) => r.enabled && SEERR_SECTION_TO_CONFIG[r.id]);
		if (enabledSections.length === 0) {
			setSeerrRows([]);
			return undefined;
		}

		let cancelled = false;
		const configs = getSeerrHomeRowConfigs();

		(async () => {
			const built = await Promise.all(enabledSections.map(async (section) => {
				const configId = SEERR_SECTION_TO_CONFIG[section.id];
				const cfg = configs.find((c) => c.id === configId);
				if (!cfg) return null;
				const items = await fetchSeerrHomeRow(configId, {userId: seerrUserId});
				if (!items.length) return null;
				return {
					id: section.id,
					title: cfg.title,
					items,
					type: cfg.cardType,
					isSeerrRow: true,
					isTileRow: cfg.type === 'genre' || cfg.type === 'studio' || cfg.type === 'network' || cfg.type === 'shortcut'
				};
			}));
			if (!cancelled) setSeerrRows(built.filter(Boolean));
		})();

		return () => {
			cancelled = true;
		};
	}, [seerrEnabled, seerrAuthenticated, seerrUserId, homeRows]);

	return seerrRows;
};

export default useSeerrRows;
