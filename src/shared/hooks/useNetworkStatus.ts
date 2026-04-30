import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = Boolean(state.isConnected);
      const reachable = state.isInternetReachable;
      setIsOnline(connected && reachable !== false);
      setIsInternetReachable(reachable);
    });
    return () => unsubscribe();
  }, []);

  return { isOnline, isOffline: !isOnline, isInternetReachable };
};
