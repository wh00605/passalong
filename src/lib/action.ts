import "server-only";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { ActionError } from "@/lib/errors";

import type { ActionState } from "@/lib/action-types";

export type { ActionState };

/** Converts FormData into a plain object; repeated keys become arrays. */
export function formToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value : value;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, v] : [prev, v];
    } else out[key] = v;
  }
  return out;
}

function echo(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string" && !/password|token|secret/i.test(k)) values[k] = v;
  }
  return values;
}

/**
 * Wraps a server action with server-side Zod validation and safe error handling.
 * Unexpected errors are logged and a generic message is shown (no stack traces leak to users).
 */
export function validatedAction<S extends z.ZodType>(
  schema: S,
  handler: (data: z.infer<S>, form: FormData) => Promise<ActionState | void>,
) {
  return async (_prev: ActionState, form: FormData): Promise<ActionState> => {
    const parsed = schema.safeParse(formToObject(form));
    if (!parsed.success) {
      return {
        error: "Please check the highlighted fields.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        values: echo(form),
      };
    }
    try {
      return (await handler(parsed.data, form)) ?? { ok: true };
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof ActionError) return { error: err.message, values: echo(form) };
      console.error("[action]", err);
      return { error: "Something went wrong. Please try again.", values: echo(form) };
    }
  };
}

/** For actions invoked directly (not via forms). */
export async function safeAction<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ActionError) return { ok: false, error: err.message };
    console.error("[action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
