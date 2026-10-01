export const REPORT_REASONS = {
  LISTING: [
    ["prohibited", "Prohibited or illegal item"],
    ["counterfeit", "Counterfeit or fake"],
    ["misleading", "Misleading description or photos"],
    ["stolen_photos", "Uses someone else's photos"],
    ["offensive", "Offensive content"],
    ["spam", "Spam or duplicate listing"],
    ["other", "Something else"],
  ],
  USER: [
    ["scam", "Scam or fraud"],
    ["off_platform", "Asked to pay outside Passalong"],
    ["harassment", "Harassment or abuse"],
    ["impersonation", "Pretending to be someone else"],
    ["spam", "Spam"],
    ["underage", "May be under 18"],
    ["other", "Something else"],
  ],
  MESSAGE: [
    ["off_platform", "Asking to pay or talk outside Passalong"],
    ["scam", "Suspicious link or scam"],
    ["harassment", "Harassment or abuse"],
    ["spam", "Spam"],
    ["other", "Something else"],
  ],
} as const;

export type ReportTargetType = keyof typeof REPORT_REASONS;
