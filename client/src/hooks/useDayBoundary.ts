import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useDayBoundary(onDayChange: () => void) {
  const dayStartHour = useSettingsStore((s) => s.dayStartHour);

  useEffect(() => {
    const checkBoundary = () => {
      const now = new Date();
      if (now.getHours() === dayStartHour && now.getMinutes() === 0) {
        onDayChange();
      }
    };

    const interval = setInterval(checkBoundary, 60_000);
    return () => clearInterval(interval);
  }, [dayStartHour, onDayChange]);
}
