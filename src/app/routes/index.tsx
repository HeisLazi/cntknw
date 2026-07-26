import { Suspense, lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from '@components/shell/AppShell';
import { RouteLoading } from '@components/shell/RouteStates';
import { LibraryRoute } from './LibraryRoute';
import { GalleryRoute } from './GalleryRoute';
import { NotesRoute } from './NotesRoute';
import { StudyRoute } from './StudyRoute';
import { SettingsRoute } from './SettingsRoute';
import { NotFoundRoute } from './NotFoundRoute';

/**
 * The component lab, behind a statically-eliminable branch.
 *
 * A plain top-level `import` would put the lab in the production
 * bundle even though nothing routes to it — which is what happened
 * first, and it is not a cosmetic problem: development-only surfaces
 * ship demo content and interaction affordances to real users.
 *
 * `import.meta.env.DEV` is replaced with a literal at build time, so
 * in production this is `false ? … : null` and the dynamic import
 * inside it is dead code the bundler removes. The build asserts the
 * result rather than assuming it — see `bundle.test.ts`.
 */
const LazyComponentsRoute = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import('./ComponentsRoute')).ComponentsRoute }))
  : null;

/**
 * The route table.
 *
 * Stable URLs, because a study tool whose state cannot be linked to
 * or refreshed is a study tool people lose their place in. Every
 * route here survives a reload — the Playwright suite proves it by
 * navigating directly and then refreshing.
 *
 * Three primary destinations only (INV-001, IA-001). `/study` is a
 * shared workspace reached by opening a source, `/settings` is
 * secondary, `/components` is development-only. None of them appears
 * in permanent navigation.
 *
 * @param includeDevRoutes false in production. The component lab is
 *   not merely hidden from the nav — it is absent from the table, so
 *   `/components` 404s in a production build rather than rendering a
 *   development surface to a user.
 */
export function createRoutes(includeDevRoutes: boolean): RouteObject[] {
  const children: RouteObject[] = [
    // `/` is a redirect, not a landing page. A separate home would be
    // a fourth destination in everything but name, and Library is
    // where the work starts.
    { index: true, element: <Navigate to="/library" replace /> },

    { path: 'library', element: <LibraryRoute /> },
    { path: 'gallery', element: <GalleryRoute /> },
    { path: 'notes', element: <NotesRoute /> },

    // Books and artworks. One route, per INV-002.
    { path: 'study/:sourceId', element: <StudyRoute /> },

    { path: 'settings', element: <SettingsRoute /> },
  ];

  if (includeDevRoutes && LazyComponentsRoute) {
    children.push({
      path: 'components',
      element: (
        <Suspense fallback={<RouteLoading label="Loading the component lab…" />}>
          <LazyComponentsRoute />
        </Suspense>
      ),
    });
  }

  children.push({ path: '*', element: <NotFoundRoute /> });

  return [{ path: '/', element: <AppShell />, children }];
}
