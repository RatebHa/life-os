import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useDomainStore } from '../../store/useDomainStore';
import { getAchievementDisplay } from '../../lib/achievement-display';

export const AchievementToast: React.FC = () => {
  const { pendingUnlocks, dismissUnlock } = useAppStore();
  const domains = useDomainStore((state) => state.domains);

  useEffect(() => {
    if (pendingUnlocks.length === 0) return;
    const timer = setTimeout(() => {
      dismissUnlock(pendingUnlocks[0].id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [pendingUnlocks, dismissUnlock]);

  const current = pendingUnlocks[0];
  if (!current) return null;
  const display = getAchievementDisplay(current, domains);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 achievement-toast-wrap"
      style={{ maxWidth: 360 }}
    >
      <div className="achievement-toast fade-in">
        <div className="achievement-toast-icon">{current.icon}</div>
        <div style={{ flex: 1 }}>
          <div className="achievement-toast-kicker">ACHIEVEMENT UNLOCKED</div>
          <div className="achievement-toast-title">{display.title}</div>
          <div className="achievement-toast-copy">{display.description}</div>
        </div>
      </div>
    </div>
  );
};
