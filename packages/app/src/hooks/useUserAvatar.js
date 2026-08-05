import {useCallback, useState} from 'react';
import {useAuth} from '../context/AuthContext';

// The signed in user's avatar. Falls back to the initial when there's no
// picture, or when the server has a tag on record but the image won't load.
export function useUserAvatar() {
	const {user, serverUrl} = useAuth();
	const [failed, setFailed] = useState(false);

	const onError = useCallback(() => setFailed(true), []);

	const avatarUrl = user?.PrimaryImageTag && !failed
		? `${serverUrl}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}&quality=90&maxHeight=100`
		: null;

	return {user, avatarUrl, initial: user?.Name?.[0] || 'U', onError};
}

export default useUserAvatar;
