// Shared pieces of the two playback overlays, so the countdown maths and the
// glyphs only exist once.

export const formatRemaining = (seconds) => {
	const safe = Math.max(0, seconds);
	const rest = String(safe % 60).padStart(2, '0');
	return safe >= 60 ? `${Math.floor(safe / 60)}:${rest}` : `:${rest}`;
};

export const SkipGlyph = ({className}) => (
	<svg className={className} viewBox="0 0 24 24" aria-hidden="true">
		<path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
	</svg>
);

export const PlayGlyph = ({className}) => (
	<svg className={className} viewBox="0 0 24 24" aria-hidden="true">
		<path fill="currentColor" d="M8 5v14l11-7z" />
	</svg>
);

// Drains clockwise from the top as progress falls from 1 to 0. Sizes differ
// between the two overlays, so the geometry is worked out from the size given
// rather than baked into the stylesheet.
export const CountdownRing = ({size, stroke, progress, classes, children}) => {
	const radius = (size - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const clamped = Math.min(1, Math.max(0, progress));
	const centre = size / 2;

	return (
		<span className={classes.ring}>
			<svg className={classes.svg} viewBox={`0 0 ${size} ${size}`}>
				<circle className={classes.track} cx={centre} cy={centre} r={radius} strokeWidth={stroke} fill="none" />
				<circle
					className={classes.value}
					cx={centre}
					cy={centre}
					r={radius}
					strokeWidth={stroke}
					fill="none"
					strokeDasharray={circumference}
					strokeDashoffset={circumference * (1 - clamped)}
				/>
			</svg>
			<span className={classes.center}>{children}</span>
		</span>
	);
};
