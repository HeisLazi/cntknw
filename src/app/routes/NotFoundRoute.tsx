import { Link, useLocation } from 'react-router';
import { RouteHeader } from '@components/shell/RouteStates';

/**
 * Unknown route.
 *
 * Recoverable: it names what was not found and offers the Library.
 * A dead end here strands anyone who follows a stale bookmark or
 * mistypes a URL, and in a local-first app that reads as data loss
 * even when nothing was lost.
 */
export function NotFoundRoute() {
  const { pathname } = useLocation();

  return (
    <div className="cn-main__inner">
      <RouteHeader
        title="Page not found"
        lede="That address does not match anything in CNTKNW."
      />
      <div className="cn-route-state" role="alert" style={{ paddingInline: 0 }}>
        <p className="cn-route-state__message">
          Nothing is routed at <code>{pathname}</code>.
        </p>
        <div className="cn-route-state__actions">
          <Link className="cn-nav__link" to="/library">
            Back to Library
          </Link>
        </div>
      </div>
    </div>
  );
}
