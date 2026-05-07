import { useEffect, useRef } from "react";
import { SavedViewMenu } from "./SavedViewMenu";
import { useSavedViews, type SavedViewConfig } from "@/hooks/useSavedViews";

interface SavedViewsBarProps {
  /** Stable scope key, e.g. "helpdesk.tickets", "tasks.list", "projects.list" */
  scope: string;
  /** Current page state to be persisted in the view */
  state: SavedViewConfig;
  /** Called when a view (or default) is loaded — page should hydrate its UI */
  onApply: (config: SavedViewConfig) => void;
  showAssignmentChips?: boolean;
}

/**
 * Drop-in toolbar that integrates Saved Views with any register page.
 * - When the user picks a saved view (or defaults load), `onApply` is fired.
 * - When the page state changes, it is mirrored into the active view's working config
 *   so "Save view" captures what is currently on screen.
 */
export function SavedViewsBar({ scope, state, onApply, showAssignmentChips }: SavedViewsBarProps) {
  const views = useSavedViews(scope, state);
  const lastAppliedRef = useRef<string>("");

  // Apply view config -> page state
  useEffect(() => {
    const serialized = JSON.stringify(views.activeConfig ?? {});
    if (serialized !== lastAppliedRef.current) {
      lastAppliedRef.current = serialized;
      onApply(views.activeConfig ?? {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.activeView?.id, views.loading]);

  // Mirror page state -> working config (so Save captures it)
  useEffect(() => {
    const serialized = JSON.stringify(state);
    if (serialized !== JSON.stringify(views.activeConfig)) {
      views.setActiveConfig(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state)]);

  return <SavedViewMenu scope={scope} views={views} showAssignmentChips={showAssignmentChips} />;
}
