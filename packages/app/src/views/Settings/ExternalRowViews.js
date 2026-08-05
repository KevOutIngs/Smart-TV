/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';

import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {TMDB_PRESETS} from '../../utils/externalHomeRows';
import {renderSettingsIcon, renderToggle} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import {SectionTitle, ToggleRow} from './settingsRows';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// Home rows that come from somewhere other than the Jellyfin library: TMDB charts, the
// Radarr and Sonarr calendars, and lists the viewer pastes a URL for.

export const ExternalTmdbListsView = ({enabledMap, onToggleRow}) => (
	<SettingsView spotlightId='external-tmdb-lists-view'>
		<SectionTitle>{$L('TMDB Lists')}</SectionTitle>
		<div className={css.viewDescription}>
			{$L('Choose which TMDB chart rows appear on the home screen.')}
		</div>
		{TMDB_PRESETS.map((cfg) => (
			<SpottableDiv
				key={cfg.id}
				className={css.listItem}
				onClick={() => onToggleRow(cfg.id)}
				spotlightId={`tmdbrow-${cfg.id}`}
			>
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{cfg.title}</div>
				</div>
				<div className={css.listItemTrailing}>{renderToggle(enabledMap.get(cfg.id) === true)}</div>
			</SpottableDiv>
		))}
	</SettingsView>
);

export const ExternalCalendarsView = ({enabledMap, settings, onToggleRow, onToggleSetting}) => {
	const radarrOn = enabledMap.get('radarr_calendar') === true;
	const sonarrOn = enabledMap.get('sonarr_calendar') === true;
	const toggleRow = (settingKey, title, desc, icon) => (
		<ToggleRow
			settingKey={settingKey}
			title={title}
			desc={desc}
			icon={icon}
			checked={settings[settingKey]}
			onToggle={() => onToggleSetting(settingKey)}
		/>
	);

	return (
		<SettingsView spotlightId='external-calendars-view'>
			<SectionTitle>{$L('Upcoming Calendars')}</SectionTitle>
			<div className={css.viewDescription}>
				{$L('Show upcoming releases from Radarr and Sonarr. Requires the servers to be configured in Seerr.')}
			</div>
			<SpottableDiv className={css.listItem} onClick={() => onToggleRow('radarr_calendar')} spotlightId='calendar-radarr'>
				{renderSettingsIcon('movie')}
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{$L('Radarr Upcoming')}</div>
					<div className={css.listItemCaption}>{$L('Upcoming movie releases')}</div>
				</div>
				<div className={css.listItemTrailing}>{renderToggle(radarrOn)}</div>
			</SpottableDiv>
			{radarrOn && toggleRow('radarrCalendarShowCinema', $L('Show Cinema Releases'), '', 'movie')}
			{radarrOn && toggleRow('radarrCalendarShowDigital', $L('Show Digital Releases'), '', 'movie')}
			{radarrOn && toggleRow('radarrCalendarShowPhysical', $L('Show Physical Releases'), '', 'movie')}
			{radarrOn && toggleRow('radarrCalendarShowDate', $L('Show Release Date'), '', 'movie')}
			<SpottableDiv className={css.listItem} onClick={() => onToggleRow('sonarr_calendar')} spotlightId='calendar-sonarr'>
				{renderSettingsIcon('tv')}
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{$L('Sonarr Upcoming')}</div>
					<div className={css.listItemCaption}>{$L('Upcoming episode releases')}</div>
				</div>
				<div className={css.listItemTrailing}>{renderToggle(sonarrOn)}</div>
			</SpottableDiv>
			{sonarrOn && toggleRow('sonarrCalendarShowEpisodeInfo', $L('Show Episode Information'), '', 'tv')}
			{sonarrOn && toggleRow('sonarrCalendarShowDate', $L('Show Release Date'), '', 'tv')}
			{radarrOn && sonarrOn &&
				toggleRow('mergeRadarrSonarrCalendars', $L('Merge Into One Row'), $L('Combine Radarr and Sonarr into a single upcoming row'), 'list')}
		</SettingsView>
	);
};

const getSourceLabel = (source) => {
	if (source === 'tmdb') return $L('TMDB');
	if (source === 'mdblist') return $L('MDBList');
	if (source === 'letterboxd') return $L('Letterboxd');
	if (source === 'imdb') return $L('IMDb');
	return source;
};

export const ExternalCustomRowsView = ({
	rows,
	url,
	name,
	error,
	saving,
	onUrlChange,
	onNameChange,
	onToggleRow,
	onDeleteRow,
	onAddRow
}) => (
	<SettingsView spotlightId='external-custom-rows-view'>
		<SectionTitle>{$L('Custom Home Rows')}</SectionTitle>
		<div className={css.viewDescription}>
			{$L('Add a home row from a TMDB list or collection, an MDBList list, or a Letterboxd profile by pasting its URL.')}
		</div>
		{rows.map((row) => (
			<div key={row.id} className={css.listItem}>
				<SpottableDiv
					className={css.listItemBody}
					onClick={() => onToggleRow(row.id)}
					spotlightId={`customrow-${row.id}`}
				>
					<div className={css.listItemHeading}>{row.name}</div>
					<div className={css.listItemCaption}>{getSourceLabel(row.source)}</div>
				</SpottableDiv>
				<div className={css.listItemTrailing}>{renderToggle(row.enabled === true)}</div>
				<SpottableDiv
					className={css.listItem}
					onClick={() => onDeleteRow(row.id)}
					spotlightId={`customrow-del-${row.id}`}
				>
					<div className={css.listItemHeading}>{$L('Delete')}</div>
				</SpottableDiv>
			</div>
		))}
		<div className={css.inputGroup}>
			<label>{$L('List URL')}</label>
			<SpottableInput
				className={css.input}
				type='text'
				value={url}
				onChange={(e) => onUrlChange(e.target.value)}
				placeholder={$L('Paste a TMDB, MDBList, or Letterboxd URL')}
				spotlightId='custom-row-url-input'
			/>
		</div>
		<div className={css.inputGroup}>
			<label>{$L('Row Name (optional)')}</label>
			<SpottableInput
				className={css.input}
				type='text'
				value={name}
				onChange={(e) => onNameChange(e.target.value)}
				placeholder={$L('Home row title')}
				spotlightId='custom-row-name-input'
			/>
		</div>
		{error && <div className={css.viewDescription}>{error}</div>}
		<SpottableDiv
			className={css.listItem}
			onClick={saving ? undefined : onAddRow}
			spotlightId='custom-row-add'
		>
			<div className={css.listItemHeading}>{saving ? $L('Checking...') : $L('Add Row')}</div>
		</SpottableDiv>
	</SettingsView>
);
