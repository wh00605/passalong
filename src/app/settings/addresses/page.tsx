import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm, Field } from "@/components/ui/form";
import { saveAddressAction } from "../actions";
import { DeleteAddressButton } from "./delete-address";

export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return (
    <div className="space-y-10">
      <section aria-labelledby="h">
        <h2 id="h" className="text-2xl font-extrabold">Addresses</h2>
        <p className="mt-1 text-sm text-muted">Used for deliveries and as the return address on your shipping labels. Only shared with the other member in an order.</p>
        {addresses.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2" role="list">
            {addresses.map((a) => (
              <li key={a.id} className="card p-4">
                {a.isDefault && <span className="tag mb-2 text-xs">Default</span>}
                <address className="text-sm not-italic">
                  <strong>{a.fullName}</strong>
                  <br />
                  {a.line1}
                  {a.line2 && (
                    <>
                      <br />
                      {a.line2}
                    </>
                  )}
                  <br />
                  {a.city}
                  <br />
                  {a.postcode}
                </address>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold underline">Edit</summary>
                  <AddressForm address={a} />
                </details>
                <DeleteAddressButton id={a.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border-2 border-dashed border-ink/40 p-4 text-sm text-muted">You haven&apos;t saved any addresses yet.</p>
        )}
      </section>
      <section aria-labelledby="add-h">
        <h2 id="add-h" className="text-xl font-extrabold">Add an address</h2>
        <AddressForm />
      </section>
    </div>
  );
}

function AddressForm({ address }: { address?: { id: string; fullName: string; line1: string; line2: string | null; city: string; postcode: string; phone: string | null; isDefault: boolean } }) {
  return (
    <ActionForm action={saveAddressAction} className="mt-4 max-w-xl space-y-4" submitLabel={address ? "Save changes" : "Add address"}>
      {address && <input type="hidden" name="id" value={address.id} />}
      <Field name="fullName" label="Full name" defaultValue={address?.fullName} autoComplete="name" required />
      <Field name="line1" label="Address line 1" defaultValue={address?.line1} autoComplete="address-line1" required />
      <Field name="line2" label="Address line 2" defaultValue={address?.line2 ?? ""} autoComplete="address-line2" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="city" label="Town or city" defaultValue={address?.city} autoComplete="address-level2" required />
        <Field name="postcode" label="Postcode" defaultValue={address?.postcode} autoComplete="postal-code" required className="[&_input]:uppercase" />
      </div>
      <Field name="phone" label="Phone (optional)" type="tel" defaultValue={address?.phone ?? ""} autoComplete="tel" hint="Some carriers text delivery updates." />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} className="h-5 w-5 accent-ink" /> Make this my default address
      </label>
    </ActionForm>
  );
}
