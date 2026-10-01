import { requireUser } from "@/lib/session";
import { ActionForm } from "@/components/ui/form";
import { Toggle } from "@/components/ui/toggle";
import { setHolidayModeAction } from "../actions";

export default async function HolidayPage() {
  const user = await requireUser();
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-medium">Holiday mode</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Going away? Holiday mode hides all your items from search, the feed and your wardrobe page so nobody can buy them. Orders you&apos;ve already sold still need to be posted.
      </p>
      <ActionForm action={setHolidayModeAction} className="mt-6 max-w-xl space-y-4" submitLabel="Save">
        <div className="card px-4">
          <Toggle name="holidayMode" label="Holiday mode" description={user.holidayMode ? "On – your items are hidden." : "Off – your items are visible."} defaultChecked={user.holidayMode} />
        </div>
      </ActionForm>
    </section>
  );
}
