import {useCallback} from 'react';

import {ViewContainer} from './settingsSpottables';

import css from './Settings.module.less';

// scrollIntoView options are ignored on older Tizen and webOS WebKit, which would leave a
// deep linked row focused somewhere off screen, so the scroller is nudged by hand instead.
const SCROLL_PADDING = 24;

// The frame every settings screen sits in. Each one is a single spotlight container, which
// is also what the focus fallback lands on when a screen has nothing better to offer.
const SettingsView = ({spotlightId, children}) => {
	const handleListFocus = useCallback((e) => {
		const container = e.currentTarget;
		const el = e.target;
		if (!container || !el || !el.getBoundingClientRect) return;
		const view = container.getBoundingClientRect();
		const row = el.getBoundingClientRect();
		if (row.top < view.top) {
			container.scrollTop -= (view.top - row.top) + SCROLL_PADDING;
		} else if (row.bottom > view.bottom) {
			container.scrollTop += (row.bottom - view.bottom) + SCROLL_PADDING;
		}
	}, []);

	return (
		<ViewContainer className={css.viewContainer} spotlightId={spotlightId}>
			<div className={css.listContent} onFocus={handleListFocus}>
				<div className={css.listInner}>
					{children}
				</div>
			</div>
		</ViewContainer>
	);
};

export default SettingsView;
