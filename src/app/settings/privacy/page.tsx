import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/ui/form";
import { Toggle } from "@/components/ui/toggle";
import { savePrivacyAction } from "../actions";
import { CookieSettingsButton } from "./cookie-settings-button";

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const marketing = await db.notificationPreference.findUnique({ where: { userId_type: { userId: user.id, type: "MARKETING" } } });
  return (
    <div className="space-y-10">
      <section aria-labelledby="h">
        <h2 id="h" className="text-2xl font-medium">Privacy</h2>
        <ActionForm action={savePrivacyAction} className="mt-4 max-w-2xl" submitLabel="Save privacy settings">
          <div className="card px-4">
            <Toggle name="showOnlineStatus" label="Show when I was last active" description="Other members see e.g. “Active 2 hours ago” on your profile." defaultChecked={user.showOnlineStatus} />
            <Toggle name="allowPersonalisation" label="Personalised feed" description="Use my sizes, brands, views and favourites to rank items for me." defaultChecked={user.allowPersonalisation} />
            <Toggle name="allowSearchIndexing" label="Let search engines show my wardrobe" description="When off, we ask Google and others not to index your profile page." defaultChecked={user.allowSearchIndexing} />
            <Toggle name="marketing" label="News and tips by email" description="Occasional emails about new features and offers. You can unsubscribe any time." defaultChecked={marketing?.email ?? false} />
          </div>
        </ActionForm>
      </section>
      <section id="cookies" aria-labelledby="cookies-h">
        <h2 id="cookies-h" className="text-2xl font-medium">Cookies</h2>
        <p className="mt-1 text-sm text-muted">
          Change which optional cookies you allow on this device. See our <Link href="/legal/cookies" className="link">cookie policy</Link>.
        </p>
        <CookieSettingsButton />
      </section>
    </div>
  );
}
