/**
 * Distinguishes a tap from a double tap on a pointer surface.
 * A single tap fires only after the double-tap window passes without a second tap.
 * Presses that move more than `slop` pixels, or last longer than `maxPressMs`, are ignored.
 */
export class TapGesture {
  private downX = 0;
  private downY = 0;
  private downAt = 0;
  private tracking = false;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onTap: () => void,
    private readonly onDoubleTap: () => void,
    private readonly windowMs = 280,
    private readonly slop = 10,
    private readonly maxPressMs = 500,
  ) {}

  pointerDown(x: number, y: number, timeMs: number): void {
    this.downX = x;
    this.downY = y;
    this.downAt = timeMs;
    this.tracking = true;
  }

  pointerUp(x: number, y: number, timeMs: number): void {
    if (!this.tracking) return;
    this.tracking = false;
    const moved = Math.hypot(x - this.downX, y - this.downY);
    if (moved > this.slop || timeMs - this.downAt > this.maxPressMs) return;

    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
      this.onDoubleTap();
      return;
    }
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this.onTap();
    }, this.windowMs);
  }

  pointerCancel(): void {
    this.tracking = false;
  }

  dispose(): void {
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
  }
}
