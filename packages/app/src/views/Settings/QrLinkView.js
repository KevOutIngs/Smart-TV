import {useEffect, useRef} from 'react';
import $L from '@enact/i18n/$L';
import qrcode from 'qrcode-generator';

import {SpottableDiv} from './settingsSpottables';
import {SectionTitle} from './settingsRows';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// A TV has no browser worth sending anyone to, so links render as a QR code
// for the viewer's phone, with the address printed under it.

const TARGET_SIZE = 360;
const QUIET_MODULES = 4;

const QrLinkView = ({title, url, onClose}) => {
	const canvasRef = useRef(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !url) return;
		try {
			const qr = qrcode(0, 'M');
			qr.addData(url);
			qr.make();
			const count = qr.getModuleCount();
			const scale = Math.max(2, Math.floor(TARGET_SIZE / (count + QUIET_MODULES * 2)));
			const size = scale * (count + QUIET_MODULES * 2);
			canvas.width = size;
			canvas.height = size;
			const context = canvas.getContext('2d');
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, size, size);
			context.fillStyle = '#000000';
			for (let row = 0; row < count; row++) {
				for (let col = 0; col < count; col++) {
					if (qr.isDark(row, col)) {
						context.fillRect((col + QUIET_MODULES) * scale, (row + QUIET_MODULES) * scale, scale, scale);
					}
				}
			}
		} catch (e) {
			void e;
		}
	}, [url]);

	return (
		<SettingsView spotlightId='qr-link-view'>
			<SectionTitle>{title}</SectionTitle>
			<div className={css.viewDescription}>{$L('Scan with your phone to open this link')}</div>
			<div className={css.qrContainer}>
				<canvas ref={canvasRef} className={css.qrCanvas} />
			</div>
			<div className={css.viewDescription}>{url}</div>
			<SpottableDiv className={css.listItem} onClick={onClose} spotlightId='qr-link-close'>
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{$L('Close')}</div>
				</div>
			</SpottableDiv>
		</SettingsView>
	);
};

export default QrLinkView;
