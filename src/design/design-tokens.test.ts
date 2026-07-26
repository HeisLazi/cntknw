/**
 * The tokens are the styling source of truth — checked, not trusted.
 *
 * The Phase 0D gate says "tokens are the styling source of truth".
 * That is only true if a component *cannot* quietly write a hex
 * value or a magic pixel size, and the only way to know is to read
 * the stylesheets and fail the build when one does. Without this
 * test the sentence is an intention; with it, it is a property.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');
const TOKENS = join(SRC, 'design', 'tokens.css');

function allStylesheets(directory: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'legacy-v1') continue;
      found.push(...allStylesheets(full));
    } else if (entry.endsWith('.css')) {
      found.push(full);
    }
  }
  return found;
}

/** Strip comments so prose mentioning a hex value is not a match. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Remove `prefers-reduced-motion` blocks.
 *
 * They are the one place a literal duration is correct: the whole
 * point of the block is to override whatever the tokens say, so
 * requiring it to use a token would be circular.
 */
function withoutReducedMotionBlocks(css: string): string {
  return css.replace(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g,
    '',
  );
}

const tokenSource = readFileSync(TOKENS, 'utf-8');

describe('design tokens', () => {
  it('declares both a raw palette and a semantic layer', () => {
    expect(tokenSource).toMatch(/--cn-palette-/);
    expect(tokenSource).toMatch(/--cn-canvas:/);
    expect(tokenSource).toMatch(/--cn-paper:/);
    expect(tokenSource).toMatch(/--cn-ink:/);
  });

  it('covers every role the gate names', () => {
    // Colour and surface, typography, spacing, radius, borders,
    // shadows, motion, z-index, panel and reading widths, focus ring.
    const required = [
      '--cn-canvas',
      '--cn-surface',
      '--cn-paper',
      '--cn-ink',
      '--cn-ink-muted',
      '--cn-accent',
      '--cn-success',
      '--cn-warning',
      '--cn-danger',
      '--cn-font-sans',
      '--cn-font-serif',
      '--cn-font-mono',
      '--cn-text-base',
      '--cn-leading-relaxed',
      '--cn-tracking-tight',
      '--cn-space-lg',
      '--cn-radius-md',
      '--cn-border-width',
      '--cn-shadow-md',
      '--cn-duration-normal',
      '--cn-ease-standard',
      '--cn-z-dialog',
      '--cn-panel-default',
      '--cn-measure',
      '--cn-reading-width',
      '--cn-focus-ring-width',
      '--cn-focus-ring-offset',
      '--cn-target-min',
    ];
    const missing = required.filter(
      (token) => !new RegExp(`${token}\\s*:`).test(tokenSource),
    );
    expect(missing).toEqual([]);
  });

  it('defines no colour literal outside the token file', () => {
    const offenders: string[] = [];
    for (const file of allStylesheets()) {
      if (file === TOKENS) continue;
      const css = withoutComments(readFileSync(file, 'utf-8'));
      const hex = css.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
      const functional = css.match(/\b(rgba?|hsla?|oklch|lab)\s*\(/gi) ?? [];
      if (hex.length > 0 || functional.length > 0) {
        offenders.push(`${relative(SRC, file)}: ${[...hex, ...functional].join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses no hard-coded transition or animation duration', () => {
    // A component that writes `200ms` opts itself out of the
    // reduced-motion collapse the duration tokens perform, and does
    // so invisibly.
    const offenders: string[] = [];
    for (const file of allStylesheets()) {
      if (file === TOKENS) continue;
      const css = withoutReducedMotionBlocks(
        withoutComments(readFileSync(file, 'utf-8')),
      );
      for (const match of css.matchAll(
        /(transition|animation)(-duration)?\s*:[^;}]*/gi,
      )) {
        const declaration = match[0];
        // A bare time unit that is not inside var(...) is the defect.
        const withoutVars = declaration.replace(/var\([^)]*\)/g, '');
        if (/\d+m?s\b/.test(withoutVars)) {
          offenders.push(`${relative(SRC, file)}: ${declaration.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('stacks only through named z-index tokens', () => {
    const offenders: string[] = [];
    for (const file of allStylesheets()) {
      if (file === TOKENS) continue;
      const css = withoutComments(readFileSync(file, 'utf-8'));
      for (const match of css.matchAll(/z-index\s*:\s*([^;}]+)/gi)) {
        const value = match[1]!.trim();
        if (!value.startsWith('var(--cn-z-')) {
          offenders.push(`${relative(SRC, file)}: z-index: ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('collapses every motion duration under prefers-reduced-motion', () => {
    const block = tokenSource.match(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\n}/,
    );
    expect(block, 'tokens.css must collapse durations').not.toBeNull();
    const durations = [...tokenSource.matchAll(/--cn-duration-([a-z]+)\s*:/g)].map(
      (m) => m[1],
    );
    const collapsed = [...(block?.[0] ?? '').matchAll(/--cn-duration-([a-z]+)\s*:/g)].map(
      (m) => m[1],
    );
    expect(new Set(collapsed)).toEqual(new Set(durations));
  });

  it('keeps light mode to the semantic layer only', () => {
    // A light theme that had to redeclare component rules would not
    // be a theme; it would be a second stylesheet.
    const light = tokenSource.match(/:root\[data-theme='light'\][\s\S]*?\n}/);
    expect(light, 'a light-mode block must exist').not.toBeNull();
    const redeclared = [...(light?.[0] ?? '').matchAll(/(--cn-[a-z0-9-]+)\s*:/g)].map(
      (m) => m[1]!,
    );
    expect(redeclared.length).toBeGreaterThan(10);
    // No raw palette entry is redefined — only roles.
    expect(redeclared.filter((name) => name.startsWith('--cn-palette-'))).toEqual([]);
  });
});
