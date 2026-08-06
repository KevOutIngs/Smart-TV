// Seerr tracks a title's availability twice, once for HD and once for 4K, and each can also
// be declined on its own. The badge on the detail screen has to say something sensible about
// every pairing of those, which is what most of this file is.

import $L from '@enact/i18n/$L';

import {MEDIA_STATUS, REQUEST_STATUS} from '../../utils/seerrStatus';

export const getSeasonStatusLabel = (status) => {
	switch (status) {
		case REQUEST_STATUS.PENDING: return $L('Pending');
		case REQUEST_STATUS.APPROVED: return $L('Processing');
		case REQUEST_STATUS.DECLINED: return $L('Declined');
		case REQUEST_STATUS.FAILED: return $L('Failed');
		case REQUEST_STATUS.COMPLETED: return $L('Available');
		default: return null;
	}
};

export const getSeasonStatusColor = (status) => {
	switch (status) {
		case REQUEST_STATUS.PENDING: return 'yellow';
		case REQUEST_STATUS.APPROVED: return 'indigo';
		case REQUEST_STATUS.DECLINED: return 'red';
		case REQUEST_STATUS.FAILED: return 'red';
		case REQUEST_STATUS.COMPLETED: return 'green';
		default: return 'gray';
	}
};

export const isSeasonRerequestable = (status) =>
	status === REQUEST_STATUS.DECLINED || status === REQUEST_STATUS.FAILED;

// Declined beats everything, then availability, then the states on the way to it. Order
// matters throughout: each check assumes the ones above it already said no.
export const getStatusBadge = (hdStatus, status4k, hdDeclined, fourKDeclined) => {
	if (hdDeclined && fourKDeclined) return {text: $L('DECLINED'), color: 'red'};
	if (fourKDeclined && hdStatus === MEDIA_STATUS.AVAILABLE) return {text: $L('HD AVAILABLE • 4K DECLINED'), color: 'mixed'};
	if (hdDeclined && status4k === MEDIA_STATUS.AVAILABLE) return {text: $L('HD DECLINED • 4K AVAILABLE'), color: 'mixed'};
	if (fourKDeclined) return {text: $L('4K DECLINED'), color: 'red'};
	if (hdDeclined) return {text: $L('HD DECLINED'), color: 'red'};

	if (hdStatus === MEDIA_STATUS.AVAILABLE && status4k === MEDIA_STATUS.AVAILABLE) return {text: $L('HD + 4K AVAILABLE'), color: 'green'};

	if (status4k === MEDIA_STATUS.AVAILABLE) return {text: $L('4K AVAILABLE'), color: 'green'};
	if (hdStatus === MEDIA_STATUS.AVAILABLE) return {text: $L('HD AVAILABLE'), color: 'green'};

	if (hdStatus === MEDIA_STATUS.PARTIALLY_AVAILABLE && status4k === MEDIA_STATUS.PARTIALLY_AVAILABLE) return {text: $L('PARTIALLY AVAILABLE'), color: 'purple'};
	if (hdStatus === MEDIA_STATUS.PARTIALLY_AVAILABLE && status4k === MEDIA_STATUS.PROCESSING) return {text: $L('HD PARTIAL • 4K PROCESSING'), color: 'mixed'};
	if (hdStatus === MEDIA_STATUS.PARTIALLY_AVAILABLE && status4k === MEDIA_STATUS.PENDING) return {text: $L('HD PARTIAL • 4K PENDING'), color: 'mixed'};
	if (hdStatus === MEDIA_STATUS.PARTIALLY_AVAILABLE) return {text: $L('HD PARTIALLY AVAILABLE'), color: 'purple'};
	if (status4k === MEDIA_STATUS.PARTIALLY_AVAILABLE && hdStatus === MEDIA_STATUS.PROCESSING) return {text: $L('HD PROCESSING • 4K PARTIAL'), color: 'mixed'};
	if (status4k === MEDIA_STATUS.PARTIALLY_AVAILABLE && hdStatus === MEDIA_STATUS.PENDING) return {text: $L('HD PENDING • 4K PARTIAL'), color: 'mixed'};
	if (status4k === MEDIA_STATUS.PARTIALLY_AVAILABLE) return {text: $L('4K PARTIALLY AVAILABLE'), color: 'purple'};

	if (hdStatus === MEDIA_STATUS.PROCESSING && status4k === MEDIA_STATUS.PROCESSING) return {text: $L('PROCESSING'), color: 'indigo'};
	if (hdStatus === MEDIA_STATUS.PROCESSING && status4k === MEDIA_STATUS.PENDING) return {text: $L('HD PROCESSING • 4K PENDING'), color: 'mixed'};
	if (status4k === MEDIA_STATUS.PROCESSING && hdStatus === MEDIA_STATUS.PENDING) return {text: $L('HD PENDING • 4K PROCESSING'), color: 'mixed'};
	if (status4k === MEDIA_STATUS.PROCESSING) return {text: $L('4K PROCESSING'), color: 'indigo'};
	if (hdStatus === MEDIA_STATUS.PROCESSING) return {text: $L('HD PROCESSING'), color: 'indigo'};

	if (hdStatus === MEDIA_STATUS.PENDING && status4k === MEDIA_STATUS.PENDING) return {text: $L('PENDING'), color: 'yellow'};
	if (status4k === MEDIA_STATUS.PENDING) return {text: $L('4K PENDING'), color: 'yellow'};
	if (hdStatus === MEDIA_STATUS.PENDING) return {text: $L('HD PENDING'), color: 'yellow'};

	if (hdStatus === MEDIA_STATUS.BLOCKLISTED || status4k === MEDIA_STATUS.BLOCKLISTED) return {text: $L('BLACKLISTED'), color: 'red'};

	return {text: $L('NOT REQUESTED'), color: 'gray'};
};

// Anything past unknown is already requested, so it can't be requested again. Partially
// available is the exception, since the seasons that are missing still can be.
export const isStatusBlocked = (currentStatus) => {
	return currentStatus != null && currentStatus >= 2 && currentStatus !== MEDIA_STATUS.PARTIALLY_AVAILABLE;
};

export const formatDate = (dateStr) => {
	if (!dateStr) return null;
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
	} catch {
		return null;
	}
};

// Seerr reports budget and revenue in US dollars whatever the viewer's locale, so only the
// grouping and symbol placement follow the locale.
export const formatCurrency = (amount) => {
	if (!amount || amount <= 0) return null;
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	} catch {
		return `$${Math.round(amount).toLocaleString()}`;
	}
};

// Takes minutes, which is what the Seerr API reports.
export const formatRuntime = (minutes) => {
	if (!minutes) return null;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};
