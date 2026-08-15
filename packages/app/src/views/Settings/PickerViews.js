/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';
import Button from '@enact/sandstone/Button';

import SpottableInput from '../../components/SpottableInput/SpottableInput';
import {KEYS} from '../../utils/keys';
import {getRatingSourceOptions, getImageTypeOptions} from './settingsOptions';
import {renderToggle} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import {SectionTitle} from './settingsRows';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// Three screens that edit one value against a scratch copy and offer Cancel or Save, rather
// than writing through on every press the way a plain settings row does.

export const RatingSourcesView = ({selected, onToggleSource, onMoveSource, onReset, onCancel, onSave}) => {
	// Enabled sources first in their stored order, since that order is the one
	// the ratings row draws them in. Everything else follows.
	const options = getRatingSourceOptions();
	const byValue = new Map(options.map((option) => [option.value, option]));
	const ordered = [
		...selected.map((value) => byValue.get(value)).filter(Boolean),
		...options.filter((option) => !selected.includes(option.value))
	];
	const makeKeyDown = (value) => (e) => {
		if (!selected.includes(value)) return;
		if (e.keyCode === KEYS.LEFT) {
			e.preventDefault();
			e.stopPropagation();
			onMoveSource(value, -1);
		} else if (e.keyCode === KEYS.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			onMoveSource(value, 1);
		}
	};
	return (
		<SettingsView spotlightId='rating-sources-view'>
			<SectionTitle>{$L('Enabled Rating Sources')}</SectionTitle>
			<div className={css.viewDescription}>
				{$L('Choose which rating sources are shown in ratings rows. Press left or right on an enabled source to reorder it.')}
			</div>
			{ordered.map((option) => (
				<SpottableDiv
					key={option.value}
					className={css.listItem}
					onClick={() => onToggleSource(option.value)}
					onKeyDown={makeKeyDown(option.value)}
					spotlightId={`rating-source-${option.value}`}
				>
					<div className={css.listItemBody}>
						<div className={css.listItemHeading}>{option.label}</div>
					</div>
					<div className={css.listItemTrailing}>{renderToggle(selected.includes(option.value))}</div>
				</SpottableDiv>
			))}
			<div className={css.actionBar}>
				<Button onClick={onReset} size='small' spotlightId='rating-sources-reset'>
					{$L('Reset to Defaults')}
				</Button>
				<Button onClick={onCancel} size='small' spotlightId='rating-sources-cancel'>
					{$L('Cancel')}
				</Button>
				<Button onClick={onSave} size='small' spotlightId='rating-sources-save'>
					{$L('Save')}
				</Button>
			</div>
		</SettingsView>
	);
};

export const BlockedRatingsView = ({ratings, blocked, loading, onToggleRating}) => (
	<SettingsView spotlightId='blocked-ratings-view'>
		<SectionTitle>{$L('Parental Controls')}</SectionTitle>
		<div className={css.viewDescription}>
			{$L('Blocked ratings are hidden from home screen rows. The list comes from what your libraries hold.')}
		</div>
		{loading && <div className={css.viewDescription}>{$L('Loading ratings...')}</div>}
		{!loading && ratings.length === 0 && (
			<div className={css.viewDescription}>{$L('No ratings found in your libraries')}</div>
		)}
		{ratings.map((rating) => (
			<SpottableDiv
				key={rating}
				className={css.listItem}
				onClick={() => onToggleRating(rating)}
				spotlightId={`blocked-rating-${rating}`}
			>
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{rating}</div>
				</div>
				<div className={css.listItemTrailing}>{renderToggle(blocked.includes(rating))}</div>
			</SpottableDiv>
		))}
	</SettingsView>
);

// One row per enabled home section. Clicking cycles Default and the four
// image types, writing through immediately like the plain settings rows do.
export const RowImageTypesView = ({rows, overrides, globalLabel, onCycleRow}) => (
	<SettingsView spotlightId='row-image-types-view'>
		<SectionTitle>{$L('Row Image Types')}</SectionTitle>
		<div className={css.viewDescription}>
			{$L('Choose the artwork each classic home row uses. Default follows the global Home Rows Image Type.')}
		</div>
		{rows.map((row) => {
			const current = overrides[row.id];
			const currentLabel = current
				? (getImageTypeOptions().find((option) => option.value === current)?.label || current)
				: $L('Default ({global})').replace('{global}', globalLabel);
			return (
				<SpottableDiv
					key={row.id}
					className={css.listItem}
					onClick={() => onCycleRow(row.id)}
					spotlightId={`row-image-type-${row.id}`}
				>
					<div className={css.listItemBody}>
						<div className={css.listItemHeading}>{row.name}</div>
						<div className={css.listItemCaption}>{currentLabel}</div>
					</div>
				</SpottableDiv>
			);
		})}
		{rows.length === 0 && (
			<div className={css.viewDescription}>{$L('No home rows are enabled')}</div>
		)}
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
				purpose='numeric'
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
