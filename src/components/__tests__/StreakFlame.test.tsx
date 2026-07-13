import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreakFlame } from '../gamification/StreakFlame';

describe('StreakFlame', () => {
  it('displays day count with D suffix', () => {
    render(<StreakFlame count={7} />);
    expect(screen.getByText('7D')).toBeTruthy();
  });

  it('shows 0D when count is 0', () => {
    render(<StreakFlame count={0} />);
    expect(screen.getByText('0D')).toBeTruthy();
  });

  it('applies faint color when count is 0', () => {
    const { container } = render(<StreakFlame count={0} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toContain('color-text-faint');
  });

  it('applies warning color when count > 0', () => {
    const { container } = render(<StreakFlame count={5} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toContain('color-warning');
  });

  it('renders with sm size (default)', () => {
    const { container } = render(<StreakFlame count={3} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('var(--text-sm)');
  });

  it('renders with md size', () => {
    const { container } = render(<StreakFlame count={3} size="md" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('var(--text-lg)');
  });

  it('renders with lg size', () => {
    const { container } = render(<StreakFlame count={3} size="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('var(--text-lg)');
  });
});
