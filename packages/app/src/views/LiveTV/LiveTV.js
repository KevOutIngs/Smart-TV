import {useState, useEffect, useCallback, useRef, useMemo, memo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import ri from '@enact/ui/resolution';
import $L from '@enact/i18n/$L';
import {useAuth} from '../../context/AuthContext';
import {pointerHover} from '../../utils/focusScroll';
import {useSettings} from '../../context/SettingsContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import {formatClockTime, formatDayLabel} from '../../utils/clock';
import {KEYS} from '../../utils/keys';

import css from './LiveTV.module.less';

const SpottableDiv = Spottable('div');
const SpottableButton = Spottable('button');
const ToolbarContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');
const FilterRailContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');
// Rows are deliberately not spotlight containers. A row container swallows up and
// down presses and drops focus on its first spottable, the channel cell, instead of
// letting spotlight pick the program cell directly below the one that was focused.
const ProgramGridContainer = SpotlightContainerDecorator({enterTo: 'last-focused', restrict: 'self-first'}, 'div');
// self-only on its own still lets a press at the edge reach the guide behind the
// scrim, so every direction is closed off as well.
const PopupContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''},
	preserveId: true
}, 'div');

// Geometry mirrors moonfin-core's guide at the 1.5 scale the stylesheet explains.
// Core sizes the window to whole hours that fit the screen, which lands on 3 hours
// and no horizontal scrolling.
const GUIDE_HOURS = 3;
const PIXELS_PER_MINUTE = 9;
const GUIDE_WIDTH = GUIDE_HOURS * 60 * PIXELS_PER_MINUTE;
// Matches @row-height in the stylesheet. The build rewrites that to rem, so the real
// on screen height is measured from a rendered row and this is only the fallback
// until one exists.
const ROW_HEIGHT = 126;
const OVERSCAN_ROWS = 6;
const VISIBLE_ROWS = 6;
const PROGRAM_BATCH = 50;
const PREFETCH_ROWS = 12;
// Cells narrower than this keep only their title, dropping the badge and time label.
const META_MIN_WIDTH = 120;

const ICON_PATHS = {
	chevronLeft: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
	chevronRight: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
	sort: 'M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z',
	calendar: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z',
	dvr: 'M17.5 10.5h2v1h-2v-1zm-13 0h2v3h-2v-3zM21 3H3c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h18c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zM8 13.5c0 .85-.65 1.5-1.5 1.5H3V9h3.5c.85 0 1.5.65 1.5 1.5v3zm4.62 1.5h-1.5L9.37 9h1.5l1 3.43 1-3.43h1.5l-1.75 6zM21 11.5c0 .6-.4 1.15-.9 1.4L21 15h-1.5l-.85-2H17.5v2H16V9h3.5c.85 0 1.5.65 1.5 1.5v1z',
	tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
	record: 'M12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8z',
	check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
};

const GuideIcon = ({path, className}) => (
	<svg className={className} viewBox="0 0 24 24">
		<path d={path} />
	</svg>
);

// The genre palette and its precedence order both come from moonfin-core. The rgb
// triple exists so the live cell tint can be built without a css color function.
const GENRES = [
	{flag: 'IsMovie', label: 'Movie', color: '#6c4bd8', rgb: '108, 75, 216'},
	{flag: 'IsSports', label: 'Sports', color: '#2e8b57', rgb: '46, 139, 87'},
	{flag: 'IsNews', label: 'News', color: '#c08a2e', rgb: '192, 138, 46'},
	{flag: 'IsKids', label: 'Kids', color: '#c0497a', rgb: '192, 73, 122'},
	{flag: 'IsSeries', label: 'Series', color: '#2e7d8a', rgb: '46, 125, 138'}
];
const DEFAULT_GENRE = {flag: null, label: '', color: '#00a4dc', rgb: '0, 164, 220'};

const genreFor = (program) => GENRES.find(g => program[g.flag]) || DEFAULT_GENRE;

const FILTERS = [
	{key: 'all', label: 'All'},
	{key: 'movies', label: 'Movies', flag: 'IsMovie'},
	{key: 'series', label: 'Series', flag: 'IsSeries'},
	{key: 'sports', label: 'Sports', flag: 'IsSports'},
	{key: 'news', label: 'News', flag: 'IsNews'},
	{key: 'kids', label: 'Kids', flag: 'IsKids'},
	{key: 'premiere', label: 'Premiere', flag: 'IsPremiere'},
	{key: 'favorites', label: 'Favorites'}
];

const SORT_OPTIONS = [
	{key: 'number', label: 'Channel number'},
	{key: 'name', label: 'Name'},
	{key: 'favoritesFirst', label: 'Favorites first'}
];

const compareByName = (a, b) => (a.Name || '').toLowerCase().localeCompare((b.Name || '').toLowerCase());

// Channel numbers are dot separated segments ('10.10' airs after '10.2'), so compare
// segment-wise as ints rather than as a decimal.
const numberSegments = (number) => {
	if (!number || !String(number).trim()) return null;
	const parts = String(number).trim().split('.');
	const segments = [];
	for (const part of parts) {
		const value = parseInt(part, 10);
		if (isNaN(value) || String(value) !== part) return null;
		segments.push(value);
	}
	return segments;
};

const compareByNumber = (a, b) => {
	const segsA = numberSegments(a.ChannelNumber);
	const segsB = numberSegments(b.ChannelNumber);
	if (!segsA || !segsB) {
		if (segsA) return -1;
		if (segsB) return 1;
		return compareByName(a, b);
	}
	const len = Math.max(segsA.length, segsB.length);
	for (let i = 0; i < len; i++) {
		const va = i < segsA.length ? segsA[i] : 0;
		const vb = i < segsB.length ? segsB[i] : 0;
		if (va !== vb) return va - vb;
	}
	return compareByName(a, b);
};

const comparatorFor = (sortBy) => {
	if (sortBy === 'name') return compareByName;
	if (sortBy === 'favoritesFirst') {
		return (a, b) => {
			const favA = Boolean(a.UserData?.IsFavorite);
			const favB = Boolean(b.UserData?.IsFavorite);
			if (favA !== favB) return favA ? -1 : 1;
			return compareByNumber(a, b);
		};
	}
	return compareByNumber;
};

const formatTimeRange = (start, end, clockDisplay) =>
	`${formatClockTime(start, clockDisplay)} - ${formatClockTime(end, clockDisplay)}`;

// The same span moonfin-core's date picker offers, a week back through two weeks out.
const buildDateOptions = () => {
	const options = [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	for (let i = -7; i <= 14; i++) {
		options.push(new Date(today.getTime() + i * 86400000));
	}
	return options;
};

const ChannelCell = memo(({channel, serverUrl, onPlayChannel, onChannelFocus}) => {
	const [logoFailed, setLogoFailed] = useState(false);

	const handleClick = useCallback(() => {
		onPlayChannel(channel);
	}, [channel, onPlayChannel]);

	const handleFocus = useCallback(() => {
		onChannelFocus(channel);
	}, [channel, onChannelFocus]);

	const handleLogoError = useCallback(() => setLogoFailed(true), []);

	// Core renders whatever name the server sends, which leaves the cell blank on
	// lineups without names. Fall back to the number so every row says something.
	const name = channel.Name || channel.ChannelNumber || $L('Channel');
	const logoUrl = channel.ImageTags?.Primary
		? `${serverUrl}/Items/${channel.Id}/Images/Primary?maxHeight=126&tag=${channel.ImageTags.Primary}`
		: null;

	return (
		<SpottableDiv
			className={css.channelCell}
			onClick={handleClick}
			onFocus={handleFocus}
		>
			{logoUrl && !logoFailed ? (
				<img className={css.channelLogo} src={logoUrl} alt="" onError={handleLogoError} />
			) : (
				<div className={css.channelLogoFallback}>
					<GuideIcon path={ICON_PATHS.tv} />
				</div>
			)}
			<div className={css.channelText}>
				{channel.ChannelNumber && <span className={css.channelNumberChip}>{channel.ChannelNumber}</span>}
				<div className={css.channelName}>{name}</div>
			</div>
		</SpottableDiv>
	);
});

const ProgramCell = memo(({program, channel, left, width, hasTimer, clockDisplay, onProgramClick, onProgramFocus}) => {
	// The live tint is an inline style, so the focused background has to be one too
	// rather than fighting it from the stylesheet.
	const [focused, setFocused] = useState(false);

	const handleClick = useCallback(() => {
		onProgramClick(program, channel);
	}, [program, channel, onProgramClick]);

	const handleFocus = useCallback((e) => {
		setFocused(true);
		onProgramFocus(program, channel);
		if (pointerHover()) return;
		const el = e.currentTarget || e.target;
		if (el) el.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'nearest'});
	}, [program, channel, onProgramFocus]);

	const handleBlur = useCallback(() => setFocused(false), []);

	const genre = genreFor(program);
	const now = Date.now();
	const start = new Date(program.StartDate).getTime();
	const end = new Date(program.EndDate).getTime();
	const isLive = now >= start && now < end;
	const showMeta = width > META_MIN_WIDTH;
	const background = focused
		? '#1c2c3c'
		: isLive
			? `rgba(${genre.rgb}, 0.14)`
			: 'rgba(26, 26, 26, 0.5)';

	return (
		<SpottableDiv
			className={`${css.programCell} ${focused ? css.focused : ''}`}
			style={{left: `${left}px`, width: `${Math.max(0, width - 1)}px`, backgroundColor: background}}
			onClick={handleClick}
			onFocus={handleFocus}
			onBlur={handleBlur}
			data-program-id={program.Id}
		>
			<div className={css.genreBar} style={{backgroundColor: genre.color}} />
			<div className={css.programBody}>
				<div className={css.programTitleRow}>
					{isLive && showMeta && (
						<span className={css.liveBadge} style={{backgroundColor: genre.color}}>{$L('LIVE')}</span>
					)}
					<span className={`${css.programTitle} ${focused || isLive ? css.programTitleStrong : ''}`}>
						{program.Name}
					</span>
					{hasTimer && <GuideIcon className={css.timerDot} path={ICON_PATHS.record} />}
				</div>
				{showMeta && (
					<div className={css.programMeta}>
						{formatTimeRange(new Date(start), new Date(end), clockDisplay)}
					</div>
				)}
			</div>
			{isLive && (
				<div className={css.liveProgressTrack}>
					<div
						className={css.liveProgressFill}
						style={{width: `${Math.min(100, ((now - start) / (end - start)) * 100)}%`, backgroundColor: genre.color}}
					/>
				</div>
			)}
		</SpottableDiv>
	);
});

const GuideRow = memo(({channel, programs, filterFlag, loaded, timersByProgram, clockDisplay, serverUrl, windowStartMs, onPlayChannel, onChannelFocus, onProgramClick, onProgramFocus}) => {
	const totalMinutes = GUIDE_HOURS * 60;
	const cells = [];
	if (loaded) {
		const list = filterFlag ? programs.filter(p => p[filterFlag]) : programs;
		for (const program of list) {
			const startMin = (new Date(program.StartDate).getTime() - windowStartMs) / 60000;
			const endMin = (new Date(program.EndDate).getTime() - windowStartMs) / 60000;
			const clampedStart = Math.max(0, startMin);
			const clampedEnd = Math.min(totalMinutes, endMin);
			const width = (clampedEnd - clampedStart) * PIXELS_PER_MINUTE;
			if (width <= 0) continue;
			cells.push(
				<ProgramCell
					key={program.Id}
					program={program}
					channel={channel}
					left={clampedStart * PIXELS_PER_MINUTE}
					width={width}
					hasTimer={Boolean(timersByProgram[program.Id])}
					clockDisplay={clockDisplay}
					onProgramClick={onProgramClick}
					onProgramFocus={onProgramFocus}
				/>
			);
		}
	}

	return (
		<div className={css.guideRow} data-channel-id={channel.Id}>
			<div className={css.channelCellWrap}>
				<ChannelCell
					channel={channel}
					serverUrl={serverUrl}
					onPlayChannel={onPlayChannel}
					onChannelFocus={onChannelFocus}
				/>
			</div>
			<div className={css.programsArea} style={{width: `${GUIDE_WIDTH}px`}}>
				{loaded ? cells : <div className={css.skeleton} />}
			</div>
		</div>
	);
});

const HeroBand = ({program, channel, clockDisplay, serverUrl}) => {
	const [logoFailed, setLogoFailed] = useState(false);

	useEffect(() => {
		setLogoFailed(false);
	}, [channel?.Id]);

	const title = program?.Name || channel?.Name || $L('Guide Timeline');
	const metaParts = [];
	let synopsis = '';
	if (program) {
		const start = new Date(program.StartDate);
		const end = new Date(program.EndDate);
		const now = Date.now();
		if (now >= start.getTime() && now < end.getTime()) metaParts.push($L('Live'));
		metaParts.push(formatTimeRange(start, end, clockDisplay));
		const genre = genreFor(program);
		if (genre.label) metaParts.push($L(genre.label));
		synopsis = program.Overview || '';
	}

	const logoUrl = channel?.ImageTags?.Primary
		? `${serverUrl}/Items/${channel.Id}/Images/Primary?maxHeight=138&tag=${channel.ImageTags.Primary}`
		: null;
	const handleLogoError = useCallback(() => setLogoFailed(true), []);

	return (
		<div className={css.hero}>
			<div className={css.heroInfo}>
				<div className={css.heroTitle}>{title}</div>
				{metaParts.length > 0 && <div className={css.heroMeta}>{metaParts.join('  ·  ')}</div>}
				{synopsis && <div className={css.heroSynopsis}>{synopsis}</div>}
			</div>
			{channel && (
				<div className={css.heroChannel}>
					{logoUrl && !logoFailed ? (
						<img className={css.heroChannelLogo} src={logoUrl} alt="" onError={handleLogoError} />
					) : (
						<div className={css.heroChannelFallback}>
							<GuideIcon path={ICON_PATHS.tv} />
						</div>
					)}
					<div className={css.heroChannelName}>{channel.Name || channel.ChannelNumber || $L('Channel')}</div>
					{channel.ChannelNumber && <div className={css.heroChannelNumber}>{channel.ChannelNumber}</div>}
				</div>
			)}
		</div>
	);
};

const LiveTV = ({onPlayChannel, onRecordings, backHandlerRef}) => {
	const {api, serverUrl} = useAuth();
	const {settings} = useSettings();
	const clockDisplay = settings.clockDisplay;

	const [channels, setChannels] = useState([]);
	const [channelsLoading, setChannelsLoading] = useState(true);
	const [programsByChannel, setProgramsByChannel] = useState({});
	const [loadedIds, setLoadedIds] = useState(() => new Set());
	const [programsLoading, setProgramsLoading] = useState(true);
	const [windowStart, setWindowStart] = useState(() => {
		const d = new Date();
		d.setMinutes(0, 0, 0);
		return d;
	});
	const [filter, setFilter] = useState('all');
	const [sortBy, setSortBy] = useState('number');
	const [hero, setHero] = useState({program: null, channel: null});
	const [selectedProgram, setSelectedProgram] = useState(null);
	const [sortOpen, setSortOpen] = useState(false);
	const [dateOpen, setDateOpen] = useState(false);
	const [channelWindowStart, setChannelWindowStart] = useState(0);
	const [channelNumberBuffer, setChannelNumberBuffer] = useState('');
	// ProgramId to timer Id, so an already scheduled program offers Cancel
	// instead of silently creating a duplicate timer.
	const [timersByProgram, setTimersByProgram] = useState({});

	const gridRef = useRef(null);
	const rowHeightRef = useRef(ROW_HEIGHT);
	const [measuredRowHeight, setMeasuredRowHeight] = useState(0);
	const channelWindowStartRef = useRef(0);
	const loadedIdsRef = useRef(loadedIds);
	const sortedChannelsRef = useRef([]);
	const filteredChannelsRef = useRef([]);
	const windowStartRef = useRef(windowStart);
	// Bumped on every window change so a fetch that raced a page turn gets dropped
	// instead of merging old-window programs into the new grid.
	const windowKeyRef = useRef(0);
	const loadingMoreRef = useRef(false);
	const channelNumberTimeoutRef = useRef(null);
	// Nothing renders from these, they only stop a double press firing two requests.
	const recordBusyRef = useRef(false);
	const favoriteBusyRef = useRef(false);

	const windowEnd = useMemo(() => new Date(windowStart.getTime() + GUIDE_HOURS * 3600000), [windowStart]);

	const sortedChannels = useMemo(
		() => [...channels].sort(comparatorFor(sortBy)),
		[channels, sortBy]
	);
	sortedChannelsRef.current = sortedChannels;

	const activeFilter = useMemo(() => FILTERS.find(f => f.key === filter) || FILTERS[0], [filter]);

	const filteredChannels = useMemo(() => {
		if (filter === 'all') return sortedChannels;
		if (filter === 'favorites') return sortedChannels.filter(c => c.UserData?.IsFavorite);
		return sortedChannels.filter(c => (programsByChannel[c.Id] || []).some(p => p[activeFilter.flag]));
	}, [sortedChannels, filter, activeFilter, programsByChannel]);
	filteredChannelsRef.current = filteredChannels;

	const loadProgramsFor = useCallback(async (batch) => {
		if (!batch.length) return;
		const windowKey = windowKeyRef.current;
		const ids = batch.map(c => c.Id);
		const result = await api.getLiveTvPrograms(ids, windowStartRef.current, new Date(windowStartRef.current.getTime() + GUIDE_HOURS * 3600000));
		if (windowKey !== windowKeyRef.current) return;
		const items = result.Items || [];
		setProgramsByChannel(prev => {
			const next = {...prev};
			const touched = new Set();
			for (const program of items) {
				if (!program.ChannelId) continue;
				next[program.ChannelId] = next[program.ChannelId] ? [...next[program.ChannelId], program] : [program];
				touched.add(program.ChannelId);
			}
			for (const id of touched) {
				next[id].sort((a, b) => new Date(a.StartDate) - new Date(b.StartDate));
			}
			return next;
		});
		// Every requested channel counts as loaded, even with no programs, so its
		// row stops showing the placeholder.
		const merged = new Set(loadedIdsRef.current);
		ids.forEach(id => merged.add(id));
		loadedIdsRef.current = merged;
		setLoadedIds(merged);
	}, [api]);

	// Walks the lineup in sorted order and fetches program batches until the rows the
	// viewport needs, plus a prefetch margin, are all covered. Filters that hide
	// channels without matches keep pulling batches until enough rows qualify.
	const ensureViewportLoaded = useCallback(async () => {
		if (loadingMoreRef.current) return;
		loadingMoreRef.current = true;
		try {
			let guard = 0;
			while (guard++ < 20) {
				const all = sortedChannelsRef.current;
				if (!all.length) return;
				const scroller = gridRef.current;
				const lastNeeded = scroller
					? Math.ceil((scroller.scrollTop + scroller.clientHeight) / rowHeightRef.current) + PREFETCH_ROWS
					: VISIBLE_ROWS + PREFETCH_ROWS;
				const rows = filteredChannelsRef.current.slice(0, lastNeeded);
				const rowsCovered = rows.every(c => loadedIdsRef.current.has(c.Id));
				const enoughRows = filteredChannelsRef.current.length >= lastNeeded;
				const hasMore = loadedIdsRef.current.size < all.length;
				if (rowsCovered && (enoughRows || !hasMore)) return;
				const batch = [];
				for (const channel of all) {
					if (loadedIdsRef.current.has(channel.Id)) continue;
					batch.push(channel);
					if (batch.length >= PROGRAM_BATCH) break;
				}
				if (!batch.length) return;
				await loadProgramsFor(batch);
			}
		} catch (err) {
			console.error('Failed to load guide programs:', err);
		} finally {
			loadingMoreRef.current = false;
		}
	}, [loadProgramsFor]);

	useEffect(() => {
		let cancelled = false;
		const init = async () => {
			setChannelsLoading(true);
			try {
				const result = await api.getLiveTvChannels();
				if (!cancelled) setChannels(result.Items || []);
			} catch (err) {
				console.error('Failed to load channels:', err);
			} finally {
				if (!cancelled) setChannelsLoading(false);
			}
		};
		init();
		return () => {
			cancelled = true;
		};
	}, [api]);

	// A window change invalidates every fetched program, so clear the cache and
	// refill from the top like core's full reload.
	useEffect(() => {
		windowStartRef.current = windowStart;
		windowKeyRef.current += 1;
		if (!channels.length) return;
		let cancelled = false;
		const reload = async () => {
			setProgramsLoading(true);
			setProgramsByChannel({});
			loadedIdsRef.current = new Set();
			setLoadedIds(new Set());
			if (gridRef.current) gridRef.current.scrollTop = 0;
			channelWindowStartRef.current = 0;
			setChannelWindowStart(0);
			await ensureViewportLoaded();
			if (!cancelled) setProgramsLoading(false);
		};
		reload();
		return () => {
			cancelled = true;
		};
	}, [windowStart, channels, ensureViewportLoaded]);

	// A sort or filter change can surface channels whose programs were never
	// fetched, so top the viewport back up.
	useEffect(() => {
		if (!channels.length || programsLoading) return;
		ensureViewportLoaded();
	}, [sortBy, filter, channels, programsLoading, ensureViewportLoaded]);

	// Favorites can sit anywhere in the lineup, past the lazily loaded prefix, so
	// fetch all of them when that filter is selected.
	useEffect(() => {
		if (filter !== 'favorites') return;
		const favorites = sortedChannelsRef.current.filter(
			c => c.UserData?.IsFavorite && !loadedIdsRef.current.has(c.Id)
		);
		if (!favorites.length) return;
		const run = async () => {
			for (let i = 0; i < favorites.length; i += PROGRAM_BATCH) {
				try {
					await loadProgramsFor(favorites.slice(i, i + PROGRAM_BATCH));
				} catch (err) {
					console.error('Failed to load favorite programs:', err);
					return;
				}
			}
		};
		run();
	}, [filter, channels, loadProgramsFor]);

	// Timers only decide which buttons the dialog shows and which cells get the
	// recording dot, so a server without recording support just leaves this empty.
	const loadTimers = useCallback(async () => {
		const result = await api.getLiveTvTimers().catch(() => null);
		const map = {};
		for (const timer of result?.Items || []) {
			if (timer.ProgramId) map[timer.ProgramId] = timer.Id;
		}
		setTimersByProgram(map);
	}, [api]);

	useEffect(() => {
		loadTimers();
	}, [loadTimers]);

	const handleScroll = useCallback(() => {
		const scroller = gridRef.current;
		if (!scroller) return;
		const firstVisibleIndex = Math.floor(scroller.scrollTop / rowHeightRef.current);
		const nextWindowStart = Math.max(0, firstVisibleIndex - OVERSCAN_ROWS);
		if (nextWindowStart !== channelWindowStartRef.current) {
			channelWindowStartRef.current = nextWindowStart;
			setChannelWindowStart(nextWindowStart);
		}
		ensureViewportLoaded();
	}, [ensureViewportLoaded]);

	const shiftWindow = useCallback((hours) => {
		setWindowStart(prev => new Date(prev.getTime() + hours * 3600000));
	}, []);

	const handlePrevWindow = useCallback(() => shiftWindow(-GUIDE_HOURS), [shiftWindow]);
	const handleNextWindow = useCallback(() => shiftWindow(GUIDE_HOURS), [shiftWindow]);

	const goToNow = useCallback(() => {
		const d = new Date();
		d.setMinutes(0, 0, 0);
		setWindowStart(d);
	}, []);

	const openSort = useCallback(() => {
		setSortOpen(true);
		setTimeout(() => Spotlight.focus('livetv-sort'), 100);
	}, []);

	const openDate = useCallback(() => {
		setDateOpen(true);
		setTimeout(() => Spotlight.focus('livetv-date'), 100);
	}, []);

	const handleSortSelect = useCallback((key) => {
		setSortBy(key);
		setSortOpen(false);
		Spotlight.focus('livetv-toolbar');
	}, []);

	const handleDateSelect = useCallback((date) => {
		setDateOpen(false);
		setWindowStart(prev => {
			const next = new Date(date);
			next.setHours(prev.getHours(), 0, 0, 0);
			return next;
		});
		Spotlight.focus('livetv-toolbar');
	}, []);

	const handleFilterSelect = useCallback((key) => {
		setFilter(key);
	}, []);

	const handleProgramClick = useCallback((program, channel) => {
		setSelectedProgram({program, channel});
		setTimeout(() => Spotlight.focus('livetv-popup'), 100);
	}, []);

	const handleProgramFocus = useCallback((program, channel) => {
		setHero({program, channel});
	}, []);

	const handleChannelFocus = useCallback((channel) => {
		setHero({program: null, channel});
	}, []);

	const handlePlayChannel = useCallback((channel) => {
		onPlayChannel?.(channel);
	}, [onPlayChannel]);

	const handleWatchChannel = useCallback(() => {
		if (selectedProgram?.channel) {
			onPlayChannel?.(selectedProgram.channel);
		}
	}, [selectedProgram, onPlayChannel]);

	const handleClosePopup = useCallback(() => {
		setSelectedProgram(null);
	}, []);

	const handleRecordProgram = useCallback(async () => {
		const program = selectedProgram?.program;
		if (!program?.Id || recordBusyRef.current) return;
		recordBusyRef.current = true;
		try {
			await api.createLiveTvTimer(program.Id);
			// Re-read rather than guessing the new timer id, so the Cancel button
			// that replaces this one always has something real to cancel.
			await loadTimers();
		} catch (err) {
			console.error('Failed to create timer:', err);
		} finally {
			recordBusyRef.current = false;
		}
	}, [api, selectedProgram, loadTimers]);

	const handleCancelProgramTimer = useCallback(async () => {
		const program = selectedProgram?.program;
		const timerId = program?.Id ? timersByProgram[program.Id] : null;
		if (!timerId || recordBusyRef.current) return;
		recordBusyRef.current = true;
		try {
			await api.cancelLiveTvTimer(timerId);
			setTimersByProgram(prev => {
				const next = {...prev};
				delete next[program.Id];
				return next;
			});
		} catch (err) {
			console.error('Failed to cancel timer:', err);
		} finally {
			recordBusyRef.current = false;
		}
	}, [api, selectedProgram, timersByProgram]);

	const handleRecordSeries = useCallback(async () => {
		const program = selectedProgram?.program;
		if (!program?.Id || recordBusyRef.current) return;
		recordBusyRef.current = true;
		try {
			await api.createLiveTvSeriesTimer(program.Id);
			// The series rule schedules this airing too, so re-reading turns the
			// button for it into Cancel Recording.
			await loadTimers();
		} catch (err) {
			console.error('Failed to create series timer:', err);
		} finally {
			recordBusyRef.current = false;
		}
	}, [api, selectedProgram, loadTimers]);

	const handleToggleChannelFavorite = useCallback(async () => {
		const channel = selectedProgram?.channel;
		if (!channel?.Id || favoriteBusyRef.current) return;
		favoriteBusyRef.current = true;
		const next = !channel.UserData?.IsFavorite;
		try {
			await api.setFavorite(channel.Id, next);
			const patch = c => ({...c, UserData: {...(c.UserData || {}), IsFavorite: next}});
			setChannels(prev => prev.map(c => (c.Id === channel.Id ? patch(c) : c)));
			setSelectedProgram(prev => (prev ? {...prev, channel: patch(prev.channel)} : prev));
		} catch (err) {
			console.error('Failed to toggle channel favorite:', err);
		} finally {
			favoriteBusyRef.current = false;
		}
	}, [api, selectedProgram]);

	useEffect(() => {
		if (!backHandlerRef) return;
		const handler = () => {
			if (selectedProgram) {
				setSelectedProgram(null);
				return true;
			}
			if (sortOpen) {
				setSortOpen(false);
				Spotlight.focus('livetv-toolbar');
				return true;
			}
			if (dateOpen) {
				setDateOpen(false);
				Spotlight.focus('livetv-toolbar');
				return true;
			}
			return false;
		};
		backHandlerRef.current = handler;
		return () => {
			if (backHandlerRef.current === handler) backHandlerRef.current = null;
		};
	}, [backHandlerRef, selectedProgram, sortOpen, dateOpen]);

	const handleChannelNumber = useCallback((digit) => {
		if (channelNumberTimeoutRef.current) {
			clearTimeout(channelNumberTimeoutRef.current);
		}

		setChannelNumberBuffer(prev => prev + digit);

		channelNumberTimeoutRef.current = setTimeout(() => {
			const channelNum = channelNumberBuffer + digit;
			const channelIndex = filteredChannelsRef.current.findIndex(ch => ch.ChannelNumber === channelNum);
			if (channelIndex >= 0) {
				const channel = filteredChannelsRef.current[channelIndex];
				const scroller = gridRef.current;
				if (scroller) {
					scroller.scrollTop = Math.max(0, channelIndex * rowHeightRef.current - scroller.clientHeight / 2);
				}
				setTimeout(() => {
					const row = document.querySelector(`[data-channel-id="${channel.Id}"]`);
					const spottable = row && row.querySelector('[tabindex]');
					if (spottable) spottable.focus();
				}, 100);
			}
			setChannelNumberBuffer('');
		}, 1500);
	}, [channelNumberBuffer]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (selectedProgram || sortOpen || dateOpen) return;
			const keyCode = e.keyCode;
			if (keyCode >= KEYS.NUM_0 && keyCode <= KEYS.NUM_9) {
				e.preventDefault();
				handleChannelNumber(String.fromCharCode(keyCode));
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [selectedProgram, sortOpen, dateOpen, handleChannelNumber]);

	useEffect(() => {
		if (channelsLoading || programsLoading) return;
		if (!Spotlight.getCurrent()) {
			Spotlight.focus('program-grid');
		}
	}, [channelsLoading, programsLoading]);

	const timeSlots = useMemo(() => {
		const slots = [];
		for (let i = 0; i < GUIDE_HOURS * 2; i++) {
			const slotTime = new Date(windowStart.getTime() + i * 30 * 60000);
			slots.push(formatClockTime(slotTime, clockDisplay));
		}
		return slots;
	}, [windowStart, clockDisplay]);

	// The stylesheet's row height comes back from the build in rem, so the pixel value
	// the scroll math needs is read off a rendered row rather than assumed.
	useEffect(() => {
		const row = gridRef.current?.querySelector('[data-channel-id]');
		if (row && row.offsetHeight && row.offsetHeight !== measuredRowHeight) {
			setMeasuredRowHeight(row.offsetHeight);
		}
	}, [measuredRowHeight, programsLoading, filteredChannels]);

	const scaledRowHeight = ri.scale(ROW_HEIGHT);
	const rowHeight = measuredRowHeight || (Number.isFinite(scaledRowHeight) && scaledRowHeight > 0 ? scaledRowHeight : ROW_HEIGHT);
	rowHeightRef.current = rowHeight;

	const windowStartMs = windowStart.getTime();
	const safeWindowStart = Math.min(channelWindowStart, Math.max(0, filteredChannels.length - VISIBLE_ROWS));
	const rowsEnd = Math.min(filteredChannels.length, safeWindowStart + VISIBLE_ROWS + OVERSCAN_ROWS * 2);
	const visibleChannels = filteredChannels.slice(safeWindowStart, rowsEnd);
	const topSpacerHeight = safeWindowStart * rowHeight;
	const bottomSpacerHeight = Math.max(0, (filteredChannels.length - rowsEnd) * rowHeight);

	if (channelsLoading) {
		return (
			<div className={css.page}>
				<div className={css.loadingContainer}>
					<LoadingSpinner />
					<p>{$L('Loading TV Guide...')}</p>
				</div>
			</div>
		);
	}

	// There is nothing to schedule once a program has already finished.
	const canSchedule = selectedProgram
		? new Date(selectedProgram.program.EndDate).getTime() > Date.now()
		: false;
	const isSeriesProgram = Boolean(selectedProgram?.program.SeriesId || selectedProgram?.program.IsSeries);
	const selectedIsFavorite = Boolean(selectedProgram?.channel?.UserData?.IsFavorite);
	const selectedGenres = selectedProgram
		? [...GENRES.filter(g => selectedProgram.program[g.flag]).map(g => g.label),
			...(selectedProgram.program.IsPremiere ? ['Premiere'] : [])]
		: [];

	return (
		<div className={css.page}>
			<ToolbarContainer className={css.toolbar} spotlightId="livetv-toolbar">
				<SpottableButton className={css.pill} onClick={handlePrevWindow} aria-label={$L('Earlier')}>
					<GuideIcon path={ICON_PATHS.chevronLeft} />
				</SpottableButton>
				<SpottableButton className={`${css.pill} ${css.gapXs}`} onClick={goToNow}>
					<span className={css.pillText}>{$L('Now')}</span>
				</SpottableButton>
				<SpottableButton className={`${css.pill} ${css.gapXs}`} onClick={handleNextWindow} aria-label={$L('Later')}>
					<GuideIcon path={ICON_PATHS.chevronRight} />
				</SpottableButton>
				<div className={css.toolbarLabel}>
					{`${formatDayLabel(windowStart)}  ${formatTimeRange(windowStart, windowEnd, clockDisplay)}`}
				</div>
				<SpottableButton className={css.pill} onClick={openSort} aria-label={$L('Sort')}>
					<GuideIcon path={ICON_PATHS.sort} />
				</SpottableButton>
				<SpottableButton className={`${css.pill} ${css.gapSm}`} onClick={openDate} aria-label={$L('Select date')}>
					<GuideIcon path={ICON_PATHS.calendar} />
				</SpottableButton>
				<SpottableButton className={`${css.pill} ${css.pillWithLabel} ${css.gapSm}`} onClick={onRecordings}>
					<GuideIcon path={ICON_PATHS.dvr} />
					<span className={css.pillText}>{$L('Recordings')}</span>
				</SpottableButton>
			</ToolbarContainer>

			<FilterRailContainer className={css.filterRail} spotlightId="livetv-filters">
				{FILTERS.map(f => (
					<SpottableButton
						key={f.key}
						className={`${css.filterChip} ${filter === f.key ? css.selected : ''}`}
						onClick={() => handleFilterSelect(f.key)} // eslint-disable-line react/jsx-no-bind
					>
						{$L(f.label)}
					</SpottableButton>
				))}
			</FilterRailContainer>

			<HeroBand
				program={hero.program}
				channel={hero.channel}
				clockDisplay={clockDisplay}
				serverUrl={serverUrl}
			/>

			<div className={css.guideSection}>
				<div className={css.timelineTitle}>{$L('Guide Timeline')}</div>
				<div className={css.timeRuler}>
					<div className={css.rulerSpacer} />
					{timeSlots.map((label, idx) => (
						<div key={idx} className={css.timeSlot}>{label}</div>
					))}
				</div>
				<div className={css.rulerDivider} />
				{programsLoading ? (
					<div className={css.loadingContainer}>
						<LoadingSpinner />
					</div>
				) : (
					<ProgramGridContainer className={css.gridWrap} spotlightId="program-grid">
						{/* The spotlight decorator's ref is the component instance, so the
						    scroller is a plain div to make gridRef a real DOM node. */}
						<div className={css.gridBody} ref={gridRef} onScroll={handleScroll}>
							{topSpacerHeight > 0 && <div style={{height: `${topSpacerHeight}px`, flexShrink: 0}} />}
							{visibleChannels.map(channel => (
								<GuideRow
									key={channel.Id}
									channel={channel}
									programs={programsByChannel[channel.Id] || []}
									filterFlag={activeFilter.flag || null}
									loaded={loadedIds.has(channel.Id)}
									timersByProgram={timersByProgram}
									clockDisplay={clockDisplay}
									serverUrl={serverUrl}
									windowStartMs={windowStartMs}
									onPlayChannel={handlePlayChannel}
									onChannelFocus={handleChannelFocus}
									onProgramClick={handleProgramClick}
									onProgramFocus={handleProgramFocus}
								/>
							))}
							{bottomSpacerHeight > 0 && <div style={{height: `${bottomSpacerHeight}px`, flexShrink: 0}} />}
							{filteredChannels.length === 0 && (
								<div className={css.empty}>
									{filter === 'favorites' ? $L('No favorite channels') : $L('No channels available')}
								</div>
							)}
						</div>
					</ProgramGridContainer>
				)}
			</div>

			{channelNumberBuffer && (
				<div className={css.channelNumberOverlay}>
					{channelNumberBuffer}
				</div>
			)}

			{sortOpen && (
				<div className={css.dialogScrim}>
					<PopupContainer className={css.dialog} spotlightId="livetv-sort">
						<div className={css.dialogTitle}>{$L('Sort channels')}</div>
						<div className={css.dialogBody}>
							{SORT_OPTIONS.map((option, idx) => (
								<SpottableDiv
									key={option.key}
									className={`${css.optionRow} ${sortBy === option.key ? css.selectedOption : ''} ${idx === 0 ? 'spottable-default' : ''}`}
									onClick={() => handleSortSelect(option.key)} // eslint-disable-line react/jsx-no-bind
								>
									<span>{$L(option.label)}</span>
									{sortBy === option.key && <GuideIcon path={ICON_PATHS.check} />}
								</SpottableDiv>
							))}
						</div>
					</PopupContainer>
				</div>
			)}

			{dateOpen && (
				<div className={css.dialogScrim}>
					<PopupContainer className={css.dialog} spotlightId="livetv-date">
						<div className={css.dialogTitle}>{$L('Select date')}</div>
						<div className={css.dialogBody}>
							{buildDateOptions().map((date, idx) => {
								const isSelected = date.getFullYear() === windowStart.getFullYear() &&
									date.getMonth() === windowStart.getMonth() &&
									date.getDate() === windowStart.getDate();
								return (
									<SpottableDiv
										key={idx}
										className={`${css.optionRow} ${isSelected ? css.selectedOption : ''} ${isSelected ? 'spottable-default' : ''}`}
										onClick={() => handleDateSelect(date)} // eslint-disable-line react/jsx-no-bind
									>
										<span>{idx === 7 ? `${formatDayLabel(date)} (${$L('Today')})` : formatDayLabel(date)}</span>
										{isSelected && <GuideIcon path={ICON_PATHS.check} />}
									</SpottableDiv>
								);
							})}
						</div>
					</PopupContainer>
				</div>
			)}

			{selectedProgram && (
				<div className={css.dialogScrim}>
					<PopupContainer className={css.dialog} spotlightId="livetv-popup">
						<div className={css.dialogTitle}>{selectedProgram.program.Name}</div>
						<div className={css.dialogBody}>
							<div className={css.dialogTime}>
								{formatTimeRange(
									new Date(selectedProgram.program.StartDate),
									new Date(selectedProgram.program.EndDate),
									clockDisplay
								)}
							</div>
							{selectedProgram.program.EpisodeTitle && (
								<div className={css.dialogEpisode}>{selectedProgram.program.EpisodeTitle}</div>
							)}
							<div className={css.dialogOverview}>
								{selectedProgram.program.Overview || $L('No description available.')}
							</div>
							{selectedGenres.length > 0 && (
								<div className={css.chipRow}>
									{selectedGenres.map(label => (
										<span key={label} className={css.genreChip}>{$L(label)}</span>
									))}
								</div>
							)}
						</div>
						<div className={css.dialogActions}>
							{canSchedule && (
								timersByProgram[selectedProgram.program.Id] ? (
									<SpottableButton
										className={`${css.dialogBtn} ${css.danger}`}
										onClick={handleCancelProgramTimer}
									>
										{$L('Cancel Recording')}
									</SpottableButton>
								) : (
									<SpottableButton className={css.dialogBtn} onClick={handleRecordProgram}>
										{$L('Record')}
									</SpottableButton>
								)
							)}
							{canSchedule && isSeriesProgram && (
								<SpottableButton className={css.dialogBtn} onClick={handleRecordSeries}>
									{$L('Record Series')}
								</SpottableButton>
							)}
							<SpottableButton className={css.dialogBtn} onClick={handleToggleChannelFavorite}>
								{selectedIsFavorite ? $L('Unfavorite Channel') : $L('Favorite Channel')}
							</SpottableButton>
							<SpottableButton className={css.dialogBtn} onClick={handleWatchChannel}>
								{$L('Watch')}
							</SpottableButton>
							<SpottableButton
								className={`${css.dialogBtn} spottable-default`}
								onClick={handleClosePopup}
							>
								{$L('Close')}
							</SpottableButton>
						</div>
					</PopupContainer>
				</div>
			)}
		</div>
	);
};

export default LiveTV;
