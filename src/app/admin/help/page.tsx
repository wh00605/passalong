import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { ActionForm, Field } from "@/components/ui/form";
import { saveHelpArticleAction } from "../actions";

export const metadata = { title: "Help articles" };

export default async function AdminHelp() {
  await requireAdmin();
  const articles = await db.helpArticle.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }] });
  const Form = ({ a }: { a?: (typeof articles)[number] }) => (
    <ActionForm action={saveHelpArticleAction} className="space-y-3" submitLabel={a ? "Save" : "Create article"} submitClassName="btn-secondary btn-sm">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="title" label="Title" defaultValue={a?.title} required />
        <Field name="category" label="Category" defaultValue={a?.category} required />
      </div>
      <Field name="body" label="Body (Markdown: ## headings, - bullets, **bold**, [links](/path))" textarea rows={8} defaultValue={a?.body} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={a?.published ?? true} className="h-4 w-4 accent-ink" /> Published</label>
    </ActionForm>
  );
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Help articles</h1>
      <details className="card p-4"><summary className="cursor-pointer font-semibold">New article</summary><div className="mt-3"><Form /></div></details>
      <ul className="space-y-2" role="list">
        {articles.map((a) => (
          <li key={a.id}>
            <details className="card p-4">
              <summary className="cursor-pointer"><span className="eyebrow mr-2">{a.category}</span><strong>{a.title}</strong>{!a.published && " (draft)"}</summary>
              <div className="mt-3"><Form a={a} /></div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
