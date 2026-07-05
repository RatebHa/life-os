import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useDomainStore } from '../../store/useDomainStore';
import { getDomainLabel, getLevelTitle, getDomainThemeStyle } from '../../lib/domain-utils';

export const LevelUpCeremony: React.FC = () => {
  const { levelUpEvent, dismissLevelUp } = useAppStore();
  const domains = useDomainStore((state) => state.domains);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!levelUpEvent) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(dismissLevelUp, 400);
    }, 3200);
    return () => clearTimeout(timer);
  }, [levelUpEvent, dismissLevelUp]);

  if (!levelUpEvent) return null;

  const title = getLevelTitle(levelUpEvent.newLevel);
  const domainLabel = getDomainLabel(levelUpEvent.domainId, domains).toUpperCase();

  return (
    <div
      className="level-up-overlay"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 400ms linear',
        pointerEvents: visible ? 'all' : 'none',
      }}
      onClick={dismissLevelUp}
    >
      <div className="level-up-shell" data-domain={levelUpEvent.domainId} style={getDomainThemeStyle(levelUpEvent.domainId, domains)}>
        <div className="level-up-hud">
          <span>DOMAIN</span>
          <span>{domainLabel}</span>
        </div>
        <div className="level-up-kicker">LEVEL UP</div>
        <div className="level-up-rank">{levelUpEvent.newLevel}</div>
        <div className="level-up-title">{title}</div>
        <div className="level-up-subtitle">RANK ADVANCEMENT CONFIRMED</div>
        <div className="level-up-grid">
          <span>STATUS // PROMOTION LOCKED</span>
          <span>CLICK TO CONTINUE</span>
        </div>
      </div>
    </div>
  );
};
