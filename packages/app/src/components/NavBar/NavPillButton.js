import Spottable from '@enact/spotlight/Spottable';

import {navIconStyle} from '../icons/navIcons';

import css from './NavBar.module.less';

const SpottableButton = Spottable('button');

// One entry in the centre pill, an icon that grows a label when focused. Every
// nav destination goes through this so they all look and behave the same.
const NavPillButton = ({Icon, slot, label, onClick, spotlightId, active = false, isDefault = false, className = '', onSpotlightLeft}) => (
	<SpottableButton
		className={[css.navBtn, css.navBtnIcon, css.expandableBtn, active && css.active, isDefault && 'spottable-default', className].filter(Boolean).join(' ')}
		onClick={onClick}
		spotlightId={spotlightId}
		onSpotlightLeft={onSpotlightLeft}
	>
		<Icon className={css.navIcon} style={navIconStyle(slot)} />
		<span className={css.expandLabel}>{label}</span>
	</SpottableButton>
);

export default NavPillButton;
