"use client";
import { useTransition } from "react";
import { deleteSavedSearchAction, toggleSavedSearchAlertsAction } from "@/app/actions/saved-searches";

export function SavedSearchControls({ id, alerts }: { id: string; alerts: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          role="switch"
          checked={alerts}
          disabled={pending}
          onChange={(e) => start(async () => void (await toggleSavedSearchAlertsAction(id, e.target.checked)))}
          className="h-5 w-5 accent-ink"
        />
        Alerts
      </label>
      <button type="button" className="btn-ghost btn-sm text-danger" disabled={pending} onClick={() => start(async () => void (await deleteSavedSearchAction(id)))}>
        Delete
      </button>
    </div>
  );
}
