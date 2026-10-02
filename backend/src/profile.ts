// Profile fields from a PATCH body. A sent value always replaces the stored
// one (so a corrected name overwrites the old name); a missing or blank value
// leaves the stored one alone (undefined = untouched in Prisma).
export function profileFields(b: Record<string, unknown>) {
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    userName: pick(b.userName),
    nativeLanguage: pick(b.nativeLanguage),
    level: pick(b.currentLevel) ?? pick(b.level),
  };
}
