export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echo of submitted values so forms can repopulate after an error. */
  values?: Record<string, string>;
  /** Optional payload for client follow-up (e.g. redirect target). */
  data?: Record<string, unknown>;
};

export const initialActionState: ActionState = {};
