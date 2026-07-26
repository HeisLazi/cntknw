import { RouteHeader } from '@components/shell/RouteStates';
import { Surface } from '@components/primitives';

/**
 * Settings — a secondary route.
 *
 * Deliberately not a primary destination. INV-001 fixes those at
 * three, and settings is the classic fourth tab that erodes an
 * information architecture: it is used rarely and belongs where
 * rarely used things go.
 *
 * Real preferences (theme, motion, storage, backup) arrive with the
 * features they configure. Phase 0D establishes the route and its
 * place in the hierarchy.
 */
export function SettingsRoute() {
  return (
    <div className="cn-main__inner">
      <RouteHeader
        title="Settings"
        lede="Preferences for reading, storage and backup."
      />
      <Surface tone="raised" pad="lg" bordered>
        <p className="cn-lab__note" style={{ marginBottom: 0 }}>
          Settings are added alongside the features they configure. Nothing here
          is configurable yet, and an empty panel is a more honest statement of
          that than a page of controls that do nothing.
        </p>
      </Surface>
    </div>
  );
}
