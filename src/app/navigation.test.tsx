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
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    const nav = document.getElementById('cn-primary-navigation')!;
    const primary = [...nav.querySelectorAll<HTMLAnchorElement>('.cn-nav__primary a')];
    expect(primary).toHaveLength(3);
    expect(primary.map((link) => link.textContent)).toEqual([
      'Library',
      'Gallery',
      'Notes',
    ]);
  });

  it('promotes no forbidden tool to the primary list', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const nav = document.getElementById('cn-primary-navigation')!;
    const primary = [...nav.querySelectorAll<HTMLAnchorElement>('.cn-nav__primary a')];
    const labels = primary.map((link) => link.textContent ?? '');
    for (const forbidden of FORBIDDEN_AS_PRIMARY) {
      expect(labels, `${forbidden} must not be a primary destination`).not.toContain(
        forbidden,
      );
    }
  });

  it('marks the current destination with aria-current', () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/gallery'] });
    const current = document.querySelector<HTMLAnchorElement>('[aria-current="page"]')!;
    expect(current).toHaveTextContent('Gallery');
  });

  it('hosts the focus timer without promoting another destination', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    await user.click(screen.getByRole('button', { name: /Open navigation/ }));
    const nav = document.getElementById('cn-primary-navigation')!;
    expect(nav.querySelector('.cn-nav__focus')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Focus timer' })
      .querySelector('.cn-pomodoro__summary-time')).toHaveTextContent('25:00');
    expect(nav.querySelectorAll('.cn-nav__primary a')).toHaveLength(3);
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

describe('overlay navigation behaviour', () => {
  it('is hidden by default and its links cannot receive tab focus', async () => {
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const trigger = screen.getByRole('button', { name: /Open navigation/ });
    const nav = document.getElementById('cn-primary-navigation')!;
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(nav).not.toBeVisible();
    expect(screen.queryByRole('link', { name: 'Library' })).not.toBeInTheDocument();

    trigger.focus();
    await userEvent.tab();
    expect(
      nav.querySelector('.cn-nav__link'),
    ).not.toHaveFocus();
  });

  it('opens by button and shortcut, closes with Escape, and returns focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    const trigger = screen.getByRole('button', { name: /Open navigation/ });

    await user.click(trigger);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.keyDown(document, { key: 'M', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    fireEvent.keyDown(document, { key: 'm', ctrlKey: true, shiftKey: true });
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps focus in the open navigation overlay', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    await user.click(screen.getByRole('button', { name: /Open navigation/ }));

    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = screen.getByRole('button', { name: 'Close navigation' });
    const last = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const lastControl = last.item(last.length - 1);
    close.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(lastControl).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(close).toHaveFocus();
  });

  it('closes when the active destination is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />, { initialEntries: ['/library'] });
    await user.click(screen.getByRole('button', { name: /Open navigation/ }));
    await user.click(screen.getByRole('link', { name: 'Library' }));
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
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
