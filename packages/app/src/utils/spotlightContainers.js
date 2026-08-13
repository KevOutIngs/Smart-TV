import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

// The track pickers the detail screen and the player both raise. self-only on its
// own still lets a press at the edge reach what sits behind the picker, so every
// direction is closed off as well. Explicit Spotlight.focus still crosses it,
// which is how these open and hand focus back on close.
export const ModalContainer = SpotlightContainerDecorator({
	enterTo: 'default-element',
	defaultElement: '[data-selected="true"]',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''},
	preserveId: true
}, 'div');
