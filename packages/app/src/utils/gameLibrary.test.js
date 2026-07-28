jest.mock('../services/gamesApi', () => ({getLibraries: jest.fn()}));

import * as gamesApi from '../services/gamesApi';
import {isGameLibrary, refreshGameLibraries, resolveGameLibraryId, resetGameLibraries} from './gameLibrary';

const load = (libs) => {
	gamesApi.getLibraries.mockResolvedValue(libs);
	return refreshGameLibraries();
};

describe('gameLibrary', () => {
	beforeEach(() => {
		resetGameLibraries();
		gamesApi.getLibraries.mockReset();
	});

	describe('before the plugin list has loaded', () => {
		it('falls back to matching a mixed content library by name', () => {
			expect(isGameLibrary('1', null, 'Games')).toBe(true);
			expect(isGameLibrary('2', 'mixed', 'My ROMs')).toBe(true);
			expect(isGameLibrary('3', 'movies', 'Games')).toBe(false);
			expect(isGameLibrary('4', null, 'Movies')).toBe(false);
		});

		it('leaves the id alone', () => {
			expect(resolveGameLibraryId({Id: 'view-1', Name: 'Games'})).toBe('view-1');
		});
	});

	describe('once the plugin list has loaded', () => {
		it('treats the list as the authority over the name', async () => {
			await load([{Id: 'lib-1', Name: 'Retro Corner'}]);
			// Picked by an admin, so it counts even though nothing in the name says game.
			expect(isGameLibrary('lib-1', 'movies', 'Retro Corner')).toBe(true);
			// Named like a game library but not in the list.
			expect(isGameLibrary('lib-9', null, 'Games')).toBe(false);
		});

		it('treats an empty list as no game libraries at all', async () => {
			await load([]);
			expect(isGameLibrary('lib-1', null, 'Games')).toBe(false);
		});

		it('matches a library the plugin reports under a different id', async () => {
			await load([{Id: 'folder-7', Name: 'Games'}]);
			expect(isGameLibrary('view-7', null, 'Games')).toBe(true);
			expect(resolveGameLibraryId({Id: 'view-7', Name: 'Games'})).toBe('folder-7');
		});

		it('matches names case insensitively and ignores surrounding space', async () => {
			await load([{Id: 'folder-7', Name: 'Games'}]);
			expect(resolveGameLibraryId({Id: 'view-7', Name: '  games '})).toBe('folder-7');
		});

		it('keeps the id when the plugin already agrees on it', async () => {
			await load([{Id: 'view-7', Name: 'Games'}]);
			expect(resolveGameLibraryId({Id: 'view-7', Name: 'Games'})).toBe('view-7');
		});

		it('keeps the id when nothing matches', async () => {
			await load([{Id: 'folder-7', Name: 'Games'}]);
			expect(resolveGameLibraryId({Id: 'view-3', Name: 'Movies'})).toBe('view-3');
		});
	});

	it('shares one request between concurrent callers', async () => {
		gamesApi.getLibraries.mockResolvedValue([]);
		await Promise.all([refreshGameLibraries(), refreshGameLibraries(), refreshGameLibraries()]);
		expect(gamesApi.getLibraries).toHaveBeenCalledTimes(1);
	});

	it('keeps the cached list when a refresh fails', async () => {
		await load([{Id: 'lib-1', Name: 'Retro Corner'}]);
		gamesApi.getLibraries.mockRejectedValue(new Error('offline'));
		await refreshGameLibraries();
		expect(isGameLibrary('lib-1', 'movies', 'Retro Corner')).toBe(true);
	});
});
