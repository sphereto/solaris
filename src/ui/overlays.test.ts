import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The HUD ignores taps (pointer-events: none) so they reach the 3D canvas underneath.
 * Anything drawn inside the HUD that people tap must switch pointer-events back on,
 * otherwise taps fall through to the canvas (this once made Settings untappable).
 */
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`No rule found for ${selector}`);
  return m[1];
}

describe('tappable overlays inside the HUD', () => {
  it('the HUD itself lets taps through', () => {
    expect(ruleBody('.hud')).toMatch(/pointer-events:\s*none/);
  });

  for (const selector of ['.settings', '.discover-sheet', '.credits-backdrop', '.hud-actions', '.focus-pill', '.focus-cta']) {
    it(`${selector} catches its own taps`, () => {
      expect(ruleBody(selector)).toMatch(/pointer-events:\s*auto/);
    });
  }
});
