import Spottable from '@enact/spotlight/Spottable';

import {navIconStyle} from '../icons/navIcons';

import css from './Sidebar.module.less';

const SpottableButton = Spottable('button');

// One row of the sidebar, an accent coloured icon plus the label that fades in
// when the rail expands.
const SidebarItem = ({Icon, slot, label, onClick, spotlightId, active = false, className = '', children}) => (
	<SpottableButton
		className={[css.sidebarItem, active && css.active, className].filter(Boolean).join(' ')}
		onClick={onClick}
		spotlightId={spotlightId}
	>
		<Icon className={css.sidebarIcon} style={navIconStyle(slot)} />
		<span className={css.sidebarLabel}>{label}</span>
		{children}
	</SpottableButton>
);

export default SidebarItem;
