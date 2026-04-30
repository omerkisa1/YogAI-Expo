import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export const useAppState = (onChange: (nextState: AppStateStatus, previousState: AppStateStatus) => void) => {
  const previousStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      onChange(nextState, previousStateRef.current);
      previousStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [onChange]);
};
