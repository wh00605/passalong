import type { Metadata } from "next";
import { requireStaff } from "@/lib/session";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const me = await requireStaff();
  return (
    <div className="container-page py-6">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
        <p className="font-mono text-xs tracking-[0.14em] uppercase">Passalong admin · {me.role}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <AdminNav role={me.role} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
