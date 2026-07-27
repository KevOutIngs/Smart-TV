import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import {isBackKey} from '../../utils/keys';

/**
 * Drives the skip prompt for any segment the server marked up, plus the credits
 * and next episode prompts that follow an episode into the one after it.
 */
const useSegmentPopups = ({
	mediaSegments,
	nextEpisode,
	settings,
	runTimeRef,
	activeModal,
	controlsVisible,
	hideControls,
	showControls,
	onSeekToSegmentEnd,
	onPlayNext,
	// A pre-roll runs straight into the feature, so it gets no credits or next-up prompt.
	currentIsPreroll = false
}) => {
	// The segment being offered right now, as {type, start, end, remainingSeconds, progress}.
	const [skipSegment, setSkipSegment] = useState(null);
	const [showSkipCredits, setShowSkipCredits] = useState(false);
	const [showNextEpisode, setShowNextEpisode] = useState(false);
	const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(null);

	const dismissedSegmentsRef = useRef(new Set());
	// Mirrored so the skip handler can stay stable, because the players keep
	// checkSegments in a dependency array and it must not change every second.
	const skipSegmentRef = useRef(null);
	useEffect(() => {
		skipSegmentRef.current = skipSegment;
	}, [skipSegment]);
	const hasTriggeredNextEpisodeRef = useRef(false);
	const nextEpisodeTimerRef = useRef(null);
	const nextEpisodeTimeoutRef = useRef(null);

	// --- Countdown ---

	const cancelNextEpisodeCountdown = useCallback(() => {
		if (nextEpisodeTimerRef.current) {
			clearInterval(nextEpisodeTimerRef.current);
			nextEpisodeTimerRef.current = null;
		}
		if (nextEpisodeTimeoutRef.current) {
			clearTimeout(nextEpisodeTimeoutRef.current);
			nextEpisodeTimeoutRef.current = null;
		}
		hasTriggeredNextEpisodeRef.current = true;
		setNextEpisodeCountdown(null);
		setShowNextEpisode(false);
		setShowSkipCredits(false);
	}, []);

	const handlePlayNextEpisode = useCallback(async () => {
		if (nextEpisode && onPlayNext) {
			cancelNextEpisodeCountdown();
			await onPlayNext(nextEpisode);
		}
	}, [nextEpisode, onPlayNext, cancelNextEpisodeCountdown]);

	const startNextEpisodeCountdown = useCallback(() => {
		if (nextEpisodeTimeoutRef.current) return;

		const timeout = settings.nextUpTimeout ?? 7;
		if (timeout === 0) {
			handlePlayNextEpisode();
			return;
		}
		setNextEpisodeCountdown(timeout);

		nextEpisodeTimeoutRef.current = setTimeout(() => {
			nextEpisodeTimeoutRef.current = null;
			handlePlayNextEpisode();
		}, timeout * 1000);

		// Both the timer text and the ring read this, so it ticks whichever the
		// viewer has chosen to see.
		let countdown = timeout;
		nextEpisodeTimerRef.current = setInterval(() => {
			countdown--;
			setNextEpisodeCountdown(countdown);
			if (countdown <= 0) {
				clearInterval(nextEpisodeTimerRef.current);
				nextEpisodeTimerRef.current = null;
			}
		}, 1000);
	}, [handlePlayNextEpisode, settings.nextUpTimeout]);

	// --- Skip segment ---

	// Takes the segment when called from the auto skip path, and falls back to
	// whichever one is on screen when the viewer presses the button.
	const handleSkipSegment = useCallback((segment) => {
		const target = segment || skipSegmentRef.current;
		if (!target?.end) return;
		dismissedSegmentsRef.current.add(target.start);
		onSeekToSegmentEnd?.(target.end);
		setSkipSegment(null);
	}, [onSeekToSegmentEnd]);

	// --- Reset on new media ---

	const resetPopups = useCallback(() => {
		setSkipSegment(null);
		setShowSkipCredits(false);
		setShowNextEpisode(false);
		setNextEpisodeCountdown(null);
		dismissedSegmentsRef.current.clear();
		hasTriggeredNextEpisodeRef.current = false;
		if (nextEpisodeTimerRef.current) {
			clearInterval(nextEpisodeTimerRef.current);
			nextEpisodeTimerRef.current = null;
		}
		if (nextEpisodeTimeoutRef.current) {
			clearTimeout(nextEpisodeTimeoutRef.current);
			nextEpisodeTimeoutRef.current = null;
		}
	}, []);

	// --- Segment checking (call from timeupdate) ---

	const checkSegments = useCallback((ticks) => {
		const introAction = settings.introAction || 'ask';
		const outroAction = settings.outroAction || 'ask';

		if (mediaSegments) {
			const {creditsStart} = mediaSegments;

			// End credits are worth skipping on a normal episode too, so the outro
			// keeps its own prompt unless the viewer asked for the next episode card
			// in its place, and even then only when that card would really appear.
			const nextUpWouldShow = Boolean(nextEpisode) && !currentIsPreroll &&
				settings.nextUpBehavior !== 'disabled' && settings.stillWatchingPrompt !== false;
			const outroBecomesNextUp = settings.replaceSkipOutroWithNextUp === true && nextUpWouldShow;

			const active = (mediaSegments.list || []).find((seg) => {
				if (seg.end == null || ticks < seg.start || ticks >= seg.end) return false;
				if (seg.type === 'intro') return introAction !== 'none';
				if (seg.type === 'outro') return outroAction !== 'none' && !outroBecomesNextUp;
				return true;
			});

			if (active && !dismissedSegmentsRef.current.has(active.start)) {
				const autoSkip = (active.type === 'intro' && introAction === 'auto') ||
					(active.type === 'outro' && outroAction === 'auto');
				if (autoSkip) {
					handleSkipSegment(active);
				} else {
					const total = Math.max(1, (active.end - active.start) / 10000000);
					const remaining = Math.max(0, Math.round((active.end - ticks) / 10000000));
					setSkipSegment((prev) => (
						prev && prev.type === active.type && prev.remainingSeconds === remaining
							? prev
							: {type: active.type, start: active.start, end: active.end, remainingSeconds: remaining, progress: remaining / total}
					));
				}
			} else if (!active) {
				setSkipSegment((prev) => (prev ? null : prev));
			}

			if (creditsStart != null && outroBecomesNextUp && !hasTriggeredNextEpisodeRef.current && outroAction !== 'none') {
				const inCredits = ticks >= creditsStart;
				if (inCredits) {
					setShowSkipCredits(prev => {
						if (!prev) {
							if (outroAction === 'auto') {
								setTimeout(() => handlePlayNextEpisode(), 0);
								return false;
							}
							return true;
						}
						return prev;
					});
				}
			}
		}

		if (nextEpisode && !currentIsPreroll && runTimeRef.current > 0 && settings.nextUpBehavior !== 'disabled' && settings.stillWatchingPrompt !== false) {
			const remaining = runTimeRef.current - ticks;
			const nearEnd = remaining < 300000000;
			if (nearEnd && !hasTriggeredNextEpisodeRef.current) {
				setShowNextEpisode(true);
			}
		}
	}, [mediaSegments, settings.introAction, settings.nextUpBehavior, settings.outroAction, settings.replaceSkipOutroWithNextUp, settings.stillWatchingPrompt, nextEpisode, currentIsPreroll, runTimeRef, handlePlayNextEpisode, handleSkipSegment]);

	// --- Auto-focus effects ---

	// Keyed on which segment it is, not the object, because that carries a
	// countdown that ticks every second and focus must only move when it appears.
	const skipSegmentStart = skipSegment?.start ?? null;
	useEffect(() => {
		if (skipSegmentStart == null || activeModal) return;
		hideControls();
		window.requestAnimationFrame(() => {
			Spotlight.focus('skip-segment-btn');
		});
	}, [skipSegmentStart, activeModal, hideControls]);

	useEffect(() => {
		if (showSkipCredits && nextEpisode && !activeModal) {
			hideControls();
			if (settings.autoPlay) {
				startNextEpisodeCountdown();
			}
			window.requestAnimationFrame(() => {
				const defaultBtn = document.querySelector('[data-spot-default="true"]');
				if (defaultBtn) {
					Spotlight.focus(defaultBtn);
				}
			});
		}
	}, [showSkipCredits, nextEpisode, activeModal, settings.autoPlay, startNextEpisodeCountdown, hideControls]);

	useEffect(() => {
		if (showNextEpisode && !showSkipCredits && nextEpisode && !activeModal) {
			hideControls();
			if (settings.autoPlay) {
				startNextEpisodeCountdown();
			}
			window.requestAnimationFrame(() => {
				const defaultBtn = document.querySelector('[data-spot-default="true"]');
				if (defaultBtn) {
					Spotlight.focus(defaultBtn);
				}
			});
		}
	}, [showNextEpisode, showSkipCredits, nextEpisode, activeModal, settings.autoPlay, startNextEpisodeCountdown, hideControls]);

	// --- Keydown handler (returns true if event was consumed) ---

	const handlePopupKeyDown = useCallback((e) => {
		const key = e.key || e.keyCode;
		const skipSegmentVisible = skipSegmentStart != null && !activeModal && !controlsVisible;
		const nextEpisodeVisible = (showSkipCredits || showNextEpisode) && nextEpisode && !activeModal && !controlsVisible;

		if (!skipSegmentVisible && !nextEpisodeVisible) return false;

		const back = isBackKey(e) || key === 'GoBack';

		const dismissSegment = () => {
			dismissedSegmentsRef.current.add(skipSegmentStart);
			setSkipSegment(null);
		};

		if (skipSegmentVisible) {
			if (back) {
				e.preventDefault();
				e.stopPropagation();
				dismissSegment();
				return true;
			}
			if (key === 'Enter' || e.keyCode === 13) return false;
			// Any other key dismisses it and brings the controls back.
			e.preventDefault();
			e.stopPropagation();
			dismissSegment();
			showControls();
			return true;
		}

		// Next episode / skip credits popup
		if (nextEpisodeVisible) {
			if (back) {
				e.preventDefault();
				e.stopPropagation();
				cancelNextEpisodeCountdown();
				return true;
			}
			if (key === 'Enter' || e.keyCode === 13) return false;
			// Allow Left/Right for navigation
			if (key === 'ArrowLeft' || e.keyCode === 37 || key === 'ArrowRight' || e.keyCode === 39) {
				return false;
			}
			e.preventDefault();
			e.stopPropagation();
			return true;
		}

		return false;
	}, [skipSegmentStart, showSkipCredits, showNextEpisode, nextEpisode, activeModal, controlsVisible, showControls, cancelNextEpisodeCountdown]);

	return {
		skipSegment,
		showSkipCredits,
		showNextEpisode,
		nextEpisodeCountdown,
		handleSkipSegment,
		handlePlayNextEpisode,
		cancelNextEpisodeCountdown,
		checkSegments,
		handlePopupKeyDown,
		resetPopups
	};
};

export default useSegmentPopups;
