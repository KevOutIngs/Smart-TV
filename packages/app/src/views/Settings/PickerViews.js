/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';
import Button from '@enact/sandstone/Button';

import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {getRatingSourceOptions} from './settingsOptions';
import {renderToggle} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import {SectionTitle} from './settingsRows';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// Three screens that edit one value against a scratch copy and offer Cancel or Save, rather
// than writing through on every press the way a plain settings row does.

export const RatingSourcesView = ({selected, onToggleSource, onCancel, onSave}) => (
	<SettingsView spotlightId='rating-sources-view'>
		<SectionTitle>{$L('Enabled Rating Sources')}</SectionTitle>
		<div className={css.viewDescription}>
			{$L('Choose which rating sources are shown in ratings rows.')}
		</div>
		{getRatingSourceOptions().map((option) => (
			<SpottableDiv
				key={option.value}
				className={css.listItem}
				onClick={() => onToggleSource(option.value)}
				spotlightId={`rating-source-${option.value}`}
			>
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{option.label}</div>
				</div>
				<div className={css.listItemTrailing}>{renderToggle(selected.includes(option.value))}</div>
			</SpottableDiv>
		))}
		<div className={css.actionBar}>
			<Button onClick={onCancel} size='small' spotlightId='rating-sources-cancel'>
				{$L('Cancel')}
			</Button>
			<Button onClick={onSave} size='small' spotlightId='rating-sources-save'>
				{$L('Save')}
			</Button>
		</div>
	</SettingsView>
);

export const ExcludedGenresView = ({text, onTextChange, onCancel, onSave}) => (
	<SettingsView spotlightId='excluded-genres-view'>
		<SectionTitle>{$L('Excluded Genres')}</SectionTitle>
		<div className={css.viewDescription}>
			{$L('Enter a comma-separated list of genre names to hide from the featured media bar.')}
		</div>
		<div className={css.inputGroup}>
			<label>{$L('Genres')}</label>
			<SpottableInput
				className={css.input}
				type='text'
				value={text}
				onChange={(e) => onTextChange(e.target.value)}
				placeholder={$L('Example: horror, reality, documentary')}
				spotlightId='excluded-genres-input'
			/>
		</div>
		<div className={css.actionBar}>
			<Button onClick={onCancel} size='small' spotlightId='excluded-genres-cancel'>
				{$L('Cancel')}
			</Button>
			<Button onClick={onSave} size='small' spotlightId='excluded-genres-save'>
				{$L('Save')}
			</Button>
		</div>
	</SettingsView>
);

export const PinCodeView = ({pin, error, onPinChange, onCancel, onSave}) => (
	<SettingsView spotlightId='pin-code-view'>
		<SectionTitle>{$L('Set PIN Code')}</SectionTitle>
		<div className={css.viewDescription}>
			{$L('Enter a 4-digit PIN used to unlock the app when PIN protection is enabled.')}
		</div>
		<div className={css.inputGroup}>
			<label>{$L('PIN')}</label>
			<SpottableInput
				className={css.input}
				type='password'
				value={pin}
				onChange={(e) => onPinChange(String(e.target.value || '').replace(/\D/g, '').slice(0, 4))}
				placeholder={$L('4 digits')}
				maxLength={4}
				spotlightId='pin-code-input'
			/>
		</div>
		{error && <div className={`${css.statusMessage} ${css.statusError}`}>{error}</div>}
		<div className={css.actionBar}>
			<Button onClick={onCancel} size='small' spotlightId='pin-code-cancel'>
				{$L('Cancel')}
			</Button>
			<Button onClick={onSave} size='small' spotlightId='pin-code-save'>
				{$L('Save')}
			</Button>
		</div>
	</SettingsView>
);
