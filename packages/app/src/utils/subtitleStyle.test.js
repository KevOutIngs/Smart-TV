jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (str) => str}));

import {
	resolveSubtitleStyleSettings,
	subtitleStyleKey,
	getSubtitleTextStyle,
	SUBTITLE_STYLE_KEYS
} from './subtitleConstants';

const settings = {
	subtitleHdrSeparate: false,
	subtitleSize: 'medium',
	subtitleColor: '#ffffff',
	subtitleBackground: 0,
	subtitleBackgroundColor: '#000000',
	subtitleShadowColor: '#000000',
	subtitleShadowOpacity: 100,
	subtitleShadowBlur: 0.1,
	subtitleOpacity: 100,
	subtitlePosition: 'bottom',
	subtitlePositionAbsolute: 90,
	subtitleSizeHdr: 'large',
	subtitleColorHdr: '#808080',
	subtitleBackgroundHdr: 40,
	subtitleBackgroundColorHdr: '#404040',
	subtitleShadowColorHdr: '#404040',
	subtitleShadowOpacityHdr: 50,
	subtitleShadowBlurHdr: 0.5,
	subtitleOpacityHdr: 80,
	subtitlePositionHdr: 'lower',
	subtitlePositionAbsoluteHdr: 70
};

describe('resolveSubtitleStyleSettings', () => {
	it('returns the settings untouched for SDR', () => {
		expect(resolveSubtitleStyleSettings({...settings, subtitleHdrSeparate: true}, false)).toEqual(
			{...settings, subtitleHdrSeparate: true}
		);
	});

	it('returns the settings untouched for HDR while the separate style is off', () => {
		expect(resolveSubtitleStyleSettings(settings, true).subtitleColor).toBe('#ffffff');
	});

	it('overlays every HDR twin once the separate style is on', () => {
		const resolved = resolveSubtitleStyleSettings({...settings, subtitleHdrSeparate: true}, true);

		for (const key of SUBTITLE_STYLE_KEYS) {
			expect(resolved[key]).toEqual(settings[`${key}Hdr`]);
		}
	});

	it('leaves a base value in place when its HDR twin is unset', () => {
		const partial = {subtitleHdrSeparate: true, subtitleColor: '#ffffff', subtitleSize: 'medium', subtitleSizeHdr: 'large'};
		const resolved = resolveSubtitleStyleSettings(partial, true);

		expect(resolved.subtitleColor).toBe('#ffffff');
		expect(resolved.subtitleSize).toBe('large');
	});

	it('does not mutate the settings it was given', () => {
		const input = {...settings, subtitleHdrSeparate: true};
		resolveSubtitleStyleSettings(input, true);

		expect(input.subtitleColor).toBe('#ffffff');
	});

	it('survives missing settings', () => {
		expect(resolveSubtitleStyleSettings(undefined, true)).toBeUndefined();
	});
});

describe('subtitleStyleKey', () => {
	it('writes to the HDR twin only while HDR styling is active', () => {
		expect(subtitleStyleKey('subtitleColor', true)).toBe('subtitleColorHdr');
		expect(subtitleStyleKey('subtitleColor', false)).toBe('subtitleColor');
	});
});

describe('getSubtitleTextStyle through the resolver', () => {
	it('renders the HDR colour for HDR and the SDR colour otherwise', () => {
		const on = {...settings, subtitleHdrSeparate: true};

		expect(getSubtitleTextStyle(resolveSubtitleStyleSettings(on, true)).color).toBe('#808080');
		expect(getSubtitleTextStyle(resolveSubtitleStyleSettings(on, false)).color).toBe('#ffffff');
	});

	it('renders the HDR size for HDR', () => {
		const on = {...settings, subtitleHdrSeparate: true};

		expect(getSubtitleTextStyle(resolveSubtitleStyleSettings(on, true)).fontSize).toBe('52px');
	});
});
