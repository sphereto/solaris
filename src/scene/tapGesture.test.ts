import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { TapGesture } from './tapGesture';

describe('TapGesture', () => {
  let tap: Mock<() => void>;
  let dbl: Mock<() => void>;
  let g: TapGesture;

  beforeEach(() => {
    vi.useFakeTimers();
    tap = vi.fn<() => void>();
    dbl = vi.fn<() => void>();
    g = new TapGesture(tap, dbl);
  });

  afterEach(() => {
    g.dispose();
    vi.useRealTimers();
  });

  const press = (x = 5, y = 5, t = 0, dur = 60, ux = x, uy = y) => {
    g.pointerDown(x, y, t);
    g.pointerUp(ux, uy, t + dur);
  };

  it('fires a single tap only after the double-tap window', () => {
    press();
    expect(tap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(tap).toHaveBeenCalledTimes(1);
    expect(dbl).not.toHaveBeenCalled();
  });

  it('fires a double tap and no single tap when two taps are close together', () => {
    press(5, 5, 0);
    vi.advanceTimersByTime(120);
    press(5, 5, 120);
    vi.advanceTimersByTime(600);
    expect(dbl).toHaveBeenCalledTimes(1);
    expect(tap).not.toHaveBeenCalled();
  });

  it('treats two slow taps as two single taps', () => {
    press(5, 5, 0);
    vi.advanceTimersByTime(400);
    press(5, 5, 400);
    vi.advanceTimersByTime(400);
    expect(tap).toHaveBeenCalledTimes(2);
    expect(dbl).not.toHaveBeenCalled();
  });

  it('ignores drags and long presses', () => {
    press(5, 5, 0, 60, 80, 5);
    press(5, 5, 100, 900);
    vi.advanceTimersByTime(600);
    expect(tap).not.toHaveBeenCalled();
    expect(dbl).not.toHaveBeenCalled();
  });
});
