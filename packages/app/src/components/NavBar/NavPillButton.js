import Spottable from '@enact/spotlight/Spottable';

import css from './NavBar.module.less';

const SpottableButton = Spottable('button');

// One entry in the centre pill, an icon that grows a label when focused. Every
// nav destination goes through this so they all look and behave the same. The
// slot lets themes with a nav color cycle tint each entry on its own.
const NavPillButton = ({Icon, slot, label, onClick, spotlightId, active = false, isDefault = false, className = '', onSpotlightLeft}) => (
	<SpottableButton
		className={[css.navBtn, css.navBtnIcon, css.expandableBtn, active && css.active, isDefault && 'spottable-default', className].filter(Boolean).join(' ')}
		onClick={onClick}
		spotlightId={spotlightId}
		onSpotlightLeft={onSpotlightLeft}
		data-nav-slot={slot}
	>
		<Icon className={css.navIcon} />
		<span className={css.expandLabel}>{label}</span>
	</SpottableButton>
);

export default NavPillButton;
