/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';
import Button from '@enact/sandstone/Button';

import {LOG_FILTERS, logLevelColor} from './useDiagnosticsLog';
import {SectionTitle} from './settingsRows';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// Newest first, which is the order anyone reading a log after something went wrong wants.
const DiagnosticsView = ({
	loggingEnabled,
	logEntries,
	logFilter,
	onFilterChange,
	logRenderLimit,
	onShowMore,
	logMessage,
	sendingReport,
	onClearLogs,
	onSendReport
}) => {
	const entries = logEntries
		.filter((entry) => logFilter === 'all' || entry.category === logFilter)
		.reverse();
	const shown = entries.slice(0, logRenderLimit);

	return (
		<SettingsView spotlightId='diagnostics-view'>
			<SectionTitle>{$L('Logs')}</SectionTitle>
			<div className={css.viewDescription}>
				{$L('Server requests recorded on this device. Video and image traffic is not included.')}
			</div>
			{logMessage && <div className={css.statusMessage}>{logMessage}</div>}
			<div className={css.actionBar}>
				{LOG_FILTERS.map((filter) => (
					<Button
						key={filter.id}
						onClick={() => onFilterChange(filter.id)}
						size='small'
						selected={logFilter === filter.id}
						spotlightId={`logfilter-${filter.id}`}
					>
						{$L(filter.label)}
					</Button>
				))}
			</div>
			{entries.length === 0 && (
				<div className={css.viewDescription}>
					{loggingEnabled
						? $L('Nothing recorded yet.')
						: $L('Turn on Diagnostic Logging to start recording.')}
				</div>
			)}
			{shown.map((entry, index) => (
				<div key={`${entry.timestamp}-${index}`} className={css.listItem}>
					<div className={css.listItemBody}>
						<div className={css.listItemHeading} style={{color: logLevelColor(entry.level)}}>
							{entry.message}
						</div>
						<div className={css.listItemCaption}>
							{`${entry.timestamp.slice(11, 23)}  ${entry.category}`}
						</div>
					</div>
				</div>
			))}
			{entries.length > logRenderLimit && (
				<div className={css.actionBar}>
					<Button
						onClick={onShowMore}
						size='small'
						spotlightId='log-show-more'
					>
						{$L('Show More')} ({entries.length - logRenderLimit})
					</Button>
				</div>
			)}
			<div className={css.actionBar}>
				<Button onClick={onClearLogs} size='small' spotlightId='log-clear'>
					{$L('Clear')}
				</Button>
				<Button onClick={onSendReport} size='small' disabled={sendingReport} spotlightId='log-send'>
					{sendingReport ? $L('Sending...') : $L('Send Report')}
				</Button>
			</div>
		</SettingsView>
	);
};

export default DiagnosticsView;
