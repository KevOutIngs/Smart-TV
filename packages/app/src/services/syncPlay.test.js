jest.mock('./jellyfinApi', () => ({
	getServerUrl: () => 'https://server',
	getAuthHeader: () => 'MediaBrowser Token="t"',
	getApiKey: () => 'key',
	getDeviceId: () => 'device'
}));

const pingCount = () => global.fetch.mock.calls.filter(([url]) => url === 'https://server/SyncPlay/Ping').length;

describe('SyncPlay ping', () => {
	let socket;
	let service;

	const groupUpdate = (type) => socket.onmessage({
		data: JSON.stringify({MessageType: 'SyncPlayGroupUpdate', Data: {Type: type, Data: {GroupId: 'g1'}}})
	});

	beforeEach(() => {
		jest.useFakeTimers();
		global.WebSocket = function FakeSocket () {
			socket = this;
			this.close = () => {};
		};
		// The clock sync that runs alongside the ping reads json off its own response.
		global.fetch = jest.fn(() => Promise.resolve({ok: true, status: 204, json: () => Promise.resolve({})}));

		// Group membership lives in module state, so each test gets a fresh copy
		// rather than inheriting whichever group the one before it joined.
		jest.isolateModules(() => {
			service = require('./syncPlay');
		});
		service.connectWebSocket();
		socket.onopen();
	});

	afterEach(() => {
		service.disconnectWebSocket();
		jest.useRealTimers();
		delete global.fetch;
		delete global.WebSocket;
	});

	test('sends nothing while the session is in no group', () => {
		jest.advanceTimersByTime(60000);
		expect(pingCount()).toBe(0);
	});

	test('pings on joining so the server has a round trip before the first unpause', () => {
		expect(pingCount()).toBe(0);
		groupUpdate('GroupJoined');
		expect(pingCount()).toBe(1);
	});

	test('keeps pinging on the timer while in a group', () => {
		groupUpdate('GroupJoined');
		const onJoin = pingCount();
		jest.advanceTimersByTime(30000);
		expect(pingCount()).toBe(onJoin + 3);
	});

	test.each(['GroupLeft', 'NotInGroup', 'GroupDoesNotExist'])('goes quiet again on %s', (type) => {
		groupUpdate('GroupJoined');
		groupUpdate(type);
		const sent = pingCount();
		jest.advanceTimersByTime(60000);
		expect(pingCount()).toBe(sent);
	});
});
