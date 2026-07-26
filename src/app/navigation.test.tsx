/**
 * Information architecture, checked.
 *
 * INV-001 and IA-001: exactly three primary destinations — Library,
 * Gallery, Notes. This is the invariant most likely to be eroded by
 * good intentions. Every feature that arrives will feel like it
 * deserves a tab, and each individual addition will look reasonable.
 * These tests make the fourth one fail rather than ship.
 */
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppShell, PRIMARY_DESTINATIONS } from '@components/shell/AppShell';
import { createRoutes } from '@app/routes';
import { renderWithProviders } from '@tests/renderWithProviders';

/** Things that must never become a fourth primary destination. */
const FORBIDDEN_AS_PRIMARY = [
  'Sessions',
  'Whiteboard',
  'PDF Reader',
  'Reader',
  'Dictionary',
  'Export',
  'Settings',
  'Chess',
  'Atlas',
  'Components',
  'Home',
  'Dashboard',
  'Search',
];

describe('primary navigation', () => {
  it('declares exactly three primary destinations', () => {
    expect(PRIMARY_DESTINATIONS).toHaveLength(3);
    expect(PRIMARY_DESTINATIONS.map((item) => item.label)).toEqual([
      'Library',
      'Gallery',
      'Notes',
    ]);
  });

  it('renders exactly three links in the primary list', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const lists = within(nav).getAllByRole('list');
    const primary = within(lists[0]!).getAllByRole('link');
    expect(primary).toHaveLength(3);
    expect(primary.map((link) => link.textContent)).toEqual([
      'Library',
      'Gallery',
      'Notes',
    ]);
  });

  it('promotes no forbidden tool to the primary list', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const primary = within(within(nav).getAllByRole('list')[0]!).getAllByRole('link');
    const labels = primary.map((link) => link.textContent ?? '');
    for (const forbidden of FORBIDDEN_AS_PRIMARY) {
      expect(labels, `${forbidden} must not be a primary destination`).not.toContain(
        forbidden,
      );
    }
  });

  it('marks the current destination with aria-current', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/gallery'] });
    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveTextContent('Gallery');
  });

  it('keeps settings and the component lab out of primary navigation', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const lists = within(nav).getAllByRole('list');
    // Secondary list exists and is separate from the primary one.
    expect(lists.length).toBeGreaterThan(1);
    const secondaryLabels = within(lists[1]!)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(secondaryLabels).toContain('Settings');
  });

  it('offers a skip link before the navigation', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#cn-main');
  });

  it('exposes one main landmark that the skip link targets', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'cn-main');
    // Focusable, so the skip link actually moves focus rather than
    // only moving the viewport.
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});

describe('route table', () => {
  const paths = (includeDev: boolean) =>
    (createRoutes(includeDev)[0]?.children ?? []).map((route) =>
      'index' in route && route.index ? '(index)' : (route.path ?? '(none)'),
    );

  it('routes books and artworks to one shared study workspace', () => {
    // INV-002. Two routes here would fork every workspace capability.
    const table = paths(false);
    expect(table).toContain('study/:sourceId');
    expect(table.filter((path) => path.includes('study'))).toHaveLength(1);
    expect(table.some((path) => path.startsWith('gallery/'))).toBe(false);
    expect(table.some((path) => path.startsWith('library/'))).toBe(false);
  });

  it('declares the three primary routes, settings and a catch-all', () => {
    const table = paths(false);
    expect(table).toEqual([
      '(index)',
      'library',
      'gallery',
      'notes',
      'study/:sourceId',
      'settings',
      '*',
    ]);
  });

  it('adds the component lab only when development routes are enabled', () => {
    expect(paths(false)).not.toContain('components');
    expect(paths(true)).toContain('components');
  });

  it('keeps the catch-all last', () => {
    // A wildcard placed before a real route swallows it.
    const table = paths(true);
    expect(table.at(-1)).toBe('*');
  });
});

describe('production build', () => {
  it('excludes the component lab from the shipped route module', () => {
    // The lab was, at first, statically imported and therefore
    // present in the production bundle even though nothing routed to
    // it. The import is now inside an `import.meta.env.DEV` branch
    // that the bundler eliminates. This asserts the shape that makes
    // the elimination possible, so a future plain import fails here
    // rather than silently shipping development surfaces to users.
    const source = readFileSync(
      join(process.cwd(), 'src', 'app', 'routes', 'index.tsx'),
      'utf-8',
    );
    expect(source).not.toMatch(/^import .*ComponentsRoute.* from/m);
    expect(source).toMatch(/import\.meta\.env\.DEV/);
    expect(source).toMatch(/import\(['"]\.\/ComponentsRoute['"]\)/);
  });
});
