import {buildThemeOverrideCss} from './themeOverrides';
import {resolveThemeById} from './themeRegistry';

describe('buildThemeOverrideCss', () => {
	it('scopes every rule to the active theme id', () => {
		const css = buildThemeOverrideCss(resolveThemeById('moonfin'));
		const selectors = css.split('\n').filter(Boolean);
		expect(selectors.length).toBeGreaterThan(50);
		for (const line of selectors) {
			expect(line.startsWith("html[data-theme-id='moonfin'][data-theme-id]")).toBe(true);
		}
	});

	it('emits literal theme colors instead of custom properties', () => {
		const css = buildThemeOverrideCss(resolveThemeById('moonfin'));
		expect(css).toContain('rgb(0, 164, 220)');
		expect(css).not.toContain('var(--theme');
	});

	it('emits the nav color cycle per slot for themes that have one', () => {
		const css = buildThemeOverrideCss(resolveThemeById('neon_pulse'));
		expect(css).toContain("[data-nav-slot='1'] { color: rgb(255, 46, 146); }");
		expect(css).toContain("[data-nav-slot='2'] { color: rgb(0, 229, 255); }");
		const moonfin = buildThemeOverrideCss(resolveThemeById('moonfin'));
		expect(moonfin).not.toContain('data-nav-slot');
	});

	it('squares off radii for pixel themes', () => {
		const css = buildThemeOverrideCss(resolveThemeById('8bit_hero'));
		expect(css).toContain('border-radius: 0;');
		const moonfin = buildThemeOverrideCss(resolveThemeById('moonfin'));
		expect(moonfin).not.toContain('border-radius: 0;');
	});

	it('carries theme fonts as far as the wrapper that names its own', () => {
		const eightbit = buildThemeOverrideCss(resolveThemeById('8bit_hero'));
		expect(eightbit).toContain('.sandstone-theme');
		expect(eightbit).toContain("font-family: 'EightBitHero', sans-serif;");
		// Neon Pulse saves its display face for titles and reads body copy in the
		// condensed companion.
		const neon = buildThemeOverrideCss(resolveThemeById('neon_pulse'));
		expect(neon).toContain("font-family: 'NeonPulseBody', sans-serif; letter-spacing: 0.6px;");
		const moonfin = buildThemeOverrideCss(resolveThemeById('moonfin'));
		expect(moonfin).not.toContain('font-family');
	});

	it('fills the media bar card from its own overlay setting', () => {
		const theme = resolveThemeById('moonfin');
		// Three quarters of the chosen opacity.
		expect(buildThemeOverrideCss(theme, {mediaBarOverlayColor: 'black', mediaBarOverlayOpacity: 100}))
			.toContain('background-color: rgba(0, 0, 0, 0.75)');
		expect(buildThemeOverrideCss(theme)).toContain('background-color: rgba(107, 114, 128, 0.375)');
	});

	it('prefers the focus border color setting over the theme focus border', () => {
		const theme = resolveThemeById('moonfin');
		expect(buildThemeOverrideCss(theme, {focusBorderColor: '#ff0000'})).toContain('rgb(255, 0, 0)');
		expect(buildThemeOverrideCss(theme, {focusBorderColor: 'nonsense'})).not.toContain('nonsense');
	});
});
