// Spotlight focuses without scrolling, so anything taller than its box has to
// bring the focused row into view itself. scrollIntoView options are ignored on
// older Tizen and webOS WebKit, which would leave the row parked off screen, so
// the scroller is nudged by hand instead.
const SCROLL_PADDING = 24;

/**
 * Scrolls the focused element into view inside its container, on whichever axis
 * it has run past the edge. Goes straight on the scrolling element as its
 * onFocus handler. A container that only scrolls one way ignores the other,
 * since setting the offset it has no room for does nothing.
 *
 * @param {Object} e - the focus event, whose currentTarget is the scroller
 */
export const keepFocusInView = (e) => {
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
	if (row.left < view.left) {
		container.scrollLeft -= (view.left - row.left) + SCROLL_PADDING;
	} else if (row.right > view.right) {
		container.scrollLeft += (row.right - view.right) + SCROLL_PADDING;
	}
};
