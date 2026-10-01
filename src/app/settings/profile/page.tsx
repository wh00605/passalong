import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ActionForm, Field } from "@/components/ui/form";
import { Avatar } from "@/components/avatar";
import { updateProfileAction } from "../actions";
import { RemovePhotoButton } from "./remove-photo";

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  return (
    <section aria-labelledby="h">
      <h2 id="h" className="text-2xl font-extrabold">Profile</h2>
      <p className="mt-1 text-sm text-muted">
        This is what other members see on <Link href={`/members/${user.username}`} className="link">your wardrobe page</Link>.
      </p>
      <ActionForm action={updateProfileAction} className="mt-6 max-w-xl space-y-5" submitLabel="Save profile" encType="multipart/form-data">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} image={user.image} size={72} />
          <div className="space-y-2">
            <Field name="photo" label="Profile photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" hint="JPEG, PNG or WebP, up to 10 MB. Location data is removed automatically." className="[&_input]:py-1.5" />
            {user.image && <RemovePhotoButton />}
          </div>
        </div>
        <Field name="name" label="Display name" defaultValue={user.name} required maxLength={60} autoComplete="name" />
        <Field name="username" label="Username" defaultValue={user.username} required maxLength={20} hint="Changing this changes your wardrobe link." autoCapitalize="none" spellCheck={false} />
        <Field name="location" label="Town or city" defaultValue={user.location ?? ""} maxLength={60} hint="Optional. Shown on your profile – don't add your full address." autoComplete="address-level2" />
        <Field name="bio" label="About you" hint="Up to 500 characters." textarea rows={4} maxLength={500} defaultValue={user.bio ?? ""} />
      </ActionForm>
    </section>
  );
}
