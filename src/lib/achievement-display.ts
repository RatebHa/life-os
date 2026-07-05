import type { Achievement, Domain } from './types';

type AchievementDisplay = {
  title: string;
  description: string;
};

export function getAchievementDisplay(
  achievement: Achievement,
  _domains: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>,
): AchievementDisplay {
  if (achievement.id === 'first_blood') {
    return { title: 'First Win', description: 'Complete your first task.' };
  }

  if (achievement.id === 'mit_master') {
    return { title: 'MIT Streak', description: 'Complete your most important task 5 days in a row.' };
  }

  if (achievement.id === 'warrior') {
    return { title: 'Domain Adept I', description: 'Build strong consistency in one focus area.' };
  }

  if (achievement.id === 'architect') {
    return { title: 'Domain Adept II', description: 'Build strong consistency in two focus areas.' };
  }

  if (achievement.id === 'monk') {
    return { title: 'Domain Adept III', description: 'Build strong consistency in three focus areas.' };
  }

  if (achievement.id === 'balanced') {
    return { title: 'Balanced System', description: 'Keep your active domains moving at a similar pace.' };
  }

  if (achievement.id === 'comeback') {
    return { title: 'Recovery', description: 'Recover from RED ALERT to 70+ momentum.' };
  }

  if (achievement.id === 'triple_threat') {
    return { title: 'Range', description: 'Complete work across multiple domains in a single day.' };
  }

  if (achievement.id === 'level_10') {
    return { title: 'Legend', description: 'Sustain exceptional consistency in one focus area.' };
  }

  return {
    title: achievement.title,
    description: achievement.description,
  };
}
