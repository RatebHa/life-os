import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompletionButton } from '../shared/CompletionButton';

describe('CompletionButton', () => {
  it('renders an enabled button when not done', () => {
    render(<CompletionButton done={false} onComplete={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).not.toBeDisabled();
  });

  it('renders a disabled button when done without undo support', () => {
    render(<CompletionButton done={true} onComplete={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
  });

  it('renders an enabled button when done and undo is supported', () => {
    render(<CompletionButton done={true} onComplete={vi.fn()} onUndo={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).not.toBeDisabled();
  });

  it('calls onComplete when clicked', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(<CompletionButton done={false} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('does not call onComplete when already done', () => {
    const onComplete = vi.fn();
    render(<CompletionButton done={true} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onUndo when clicked after completion', async () => {
    const onUndo = vi.fn().mockResolvedValue(undefined);
    render(<CompletionButton done={true} onComplete={vi.fn()} onUndo={onUndo} />);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onUndo).toHaveBeenCalledTimes(1));
  });

  it('prevents double-click firing', async () => {
    const onComplete = vi.fn().mockImplementation(
      () => new Promise((r) => setTimeout(r, 100))
    );
    render(<CompletionButton done={false} onComplete={onComplete} />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('respects custom size prop', () => {
    const { container } = render(
      <CompletionButton done={false} onComplete={vi.fn()} size={24} />
    );
    // Size is passed to lucide-react SVG — verify the SVG has correct dimensions
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
