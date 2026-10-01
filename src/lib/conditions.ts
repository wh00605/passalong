export const CONDITIONS = [
  { value: "NEW_WITH_TAGS", label: "New with tags", description: "Brand new and unused, with original tags attached." },
  { value: "NEW_WITHOUT_TAGS", label: "New without tags", description: "Brand new and unused, without tags." },
  { value: "VERY_GOOD", label: "Very good", description: "Lightly used with minimal signs of wear." },
  { value: "GOOD", label: "Good", description: "Used, with some signs of wear. Any flaws are shown in photos." },
  { value: "SATISFACTORY", label: "Satisfactory", description: "Well used, with visible wear or flaws shown in photos." },
] as const;

export function conditionLabel(value: string | null | undefined) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? "";
}
