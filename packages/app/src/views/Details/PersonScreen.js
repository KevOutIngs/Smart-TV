import $L from '@enact/i18n/$L';

import MediaRow from '../../components/MediaRow';
import RatingsRow from '../../components/RatingsRow';
import {getImageUrl} from '../../utils/helpers';
import {isMdblistEnabled} from '../../services/mdblistApi';

import css from './Details.module.less';

const PersonScreen = ({item, serverUrl, settings, personMovies, personSeries, birthDate, birthPlace, onSelectItem}) => (
	<>
		<div className={css.personHeader}>
			<div className={css.personPhotoWrapper}>
				{item.ImageTags?.Primary ? (
					<img
						src={getImageUrl(serverUrl, item.Id, 'Primary', {maxHeight: 450, quality: 90})}
						className={css.personPhoto}
						alt=""
					/>
				) : (
					<div className={css.personPhotoPlaceholder}>
						<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"/></svg>
					</div>
				)}
			</div>
			<div className={css.personInfo}>
				<h1 className={css.title}>{item.Name}</h1>
				<div className={css.infoRow}>
					{birthDate && (
						<span className={css.infoItem}>
							{$L('Born')} {birthDate.toLocaleDateString()}
							{' '}({$L('{age}+')} {Math.floor((Date.now() - birthDate.getTime()) / 31557600000)})
						</span>
					)}
					{birthPlace && <span className={css.infoItem}>{birthPlace}</span>}
				</div>
				<RatingsRow item={item} serverUrl={serverUrl} pluginEnabled={isMdblistEnabled(settings)} />
				{item.Overview && <p className={css.overview}>{item.Overview}</p>}
			</div>
		</div>

		<div className={css.sectionsContainer}>
			{personMovies.length > 0 && (
				<MediaRow
					title={`${$L('Movies')} (${personMovies.length})`}
					items={personMovies}
					serverUrl={serverUrl}
					onSelectItem={onSelectItem}
					className={css.inlineRow}
				/>
			)}
			{personSeries.length > 0 && (
				<MediaRow
					title={`${$L('TV Series')} (${personSeries.length})`}
					items={personSeries}
					serverUrl={serverUrl}
					onSelectItem={onSelectItem}
					className={css.inlineRow}
				/>
			)}
		</div>
	</>
);

export default PersonScreen;
