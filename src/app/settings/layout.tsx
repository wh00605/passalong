import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { SettingsNav } from "./settings-nav";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  await requireUser("/settings/profile");
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Settings</h1>
      <div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
