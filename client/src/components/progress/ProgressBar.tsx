import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { ThickLinearBar } from './ThickLinearBar';
import { SegmentedBar } from './SegmentedBar';
import { CircularBar } from './CircularBar';

interface ProgressBarProps {
  ratio: number;
  color: string;
  isActive?: boolean;
}

export function ProgressBar(props: ProgressBarProps) {
  const barStyle = useSettingsStore((s) => s.barStyle);

  switch (barStyle) {
    case 'segmented':
      return <SegmentedBar {...props} />;
    case 'circular':
      return <CircularBar {...props} />;
    case 'thick-linear':
    default:
      return <ThickLinearBar {...props} />;
  }
}
