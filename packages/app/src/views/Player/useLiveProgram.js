import {useState, useEffect} from 'react';
import {api as jellyfinApi, createApiForServer} from '../../services/jellyfinApi';

// Fetches the program currently airing on a live channel so the OSD can show its
// name and progress, then refetches shortly after that program ends. Errors and
// channels without guide data just leave the OSD without a program line.
const useLiveProgram = (item, isLiveTV) => {
	const [program, setProgram] = useState(null);

	useEffect(() => {
		if (!isLiveTV || !item?.Id) {
			setProgram(null);
			return;
		}

		let cancelled = false;
		let timer = null;

		const apiClient = item._serverUrl
			? createApiForServer(item._serverUrl, item._serverAccessToken, item._serverUserId)
			: jellyfinApi;

		const load = async () => {
			let current = null;
			try {
				const now = new Date();
				const result = await apiClient.getLiveTvPrograms([item.Id], now, now);
				const t = Date.now();
				current = (result.Items || []).find(p => {
					const start = new Date(p.StartDate).getTime();
					const end = new Date(p.EndDate).getTime();
					return t >= start && t < end;
				}) || null;
			} catch {
				current = null;
			}
			if (cancelled) return;
			setProgram(current);
			// A little past the end so the server has rolled over to the next program.
			const delay = current
				? Math.max(30000, new Date(current.EndDate).getTime() - Date.now() + 5000)
				: 300000;
			timer = setTimeout(load, delay);
		};

		load();
		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
	}, [item, isLiveTV]);

	return program;
};

export default useLiveProgram;
