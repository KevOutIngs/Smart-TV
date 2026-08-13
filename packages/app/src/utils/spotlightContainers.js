import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

// The track pickers the detail screen and the player both raise. Spotlight only
// prefers to keep focus inside a container, so self-only is what stops a press
// towards the edge landing behind the open picker. Explicit Spotlight.focus
// still crosses it, which is how these open and hand focus back on close.
export const ModalContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-selected="true"]',
	restrict: 'self-only',
	preserveId: true
}, 'div');
