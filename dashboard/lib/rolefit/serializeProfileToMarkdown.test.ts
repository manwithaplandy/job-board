import { describe, expect, test } from "vitest";
import { serializeProfileToMarkdown } from "@/lib/rolefit/serializeProfileToMarkdown";
import { parseProfileText, type ParsedProfile } from "@/lib/rolefit/parseProfile";

const profile: ParsedProfile = {
  name: "Jordan Casey",
  contact: "jordan@example.com | 555-0134 | Phoenix, AZ | linkedin.com/in/jordan",
  educationEntries: ["M.S., Computer Science — State University · 2020"],
  certifications: ["AWS Certified: Solutions Architect"],
  experience: [
    { role: "Staff Engineer", company: "Acme Corp", dates: "January 2020 – Present", sourceBullets: ["Shipped the platform", "Led the team"] },
    { role: "Engineer", company: "Globex", dates: "June 2017 – January 2020", sourceBullets: ["Built the API"] },
  ],
};

describe("serializeProfileToMarkdown", () => {
  test("round-trips structured fields through parseProfileText", () => {
    const md = serializeProfileToMarkdown(profile, [{ heading: "Summary", lines: ["Seasoned engineer."] }]);
    const reparsed = parseProfileText(md);
    expect(reparsed.name).toBe("Jordan Casey");
    expect(reparsed.contact).toContain("Phoenix, AZ");
    expect(reparsed.experience.map((r) => ({ role: r.role, company: r.company }))).toEqual([
      { role: "Staff Engineer", company: "Acme Corp" },
      { role: "Engineer", company: "Globex" },
    ]);
    expect(reparsed.experience[0].sourceBullets).toEqual(["Shipped the platform", "Led the team"]);
    expect(reparsed.educationEntries).toEqual(["M.S., Computer Science — State University · 2020"]);
    expect(reparsed.certifications).toEqual(["AWS Certified: Solutions Architect"]);
  });

  test("preserves prose sections as markdown headings", () => {
    const md = serializeProfileToMarkdown(profile, [{ heading: "Summary", lines: ["Seasoned engineer."] }]);
    expect(md).toContain("## Summary");
    expect(md).toContain("Seasoned engineer.");
  });
});
