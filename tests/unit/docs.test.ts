import { describe, expect, it } from "vitest";
import { DOC_ORDER, DOC_TASK_GUIDES, docSlug } from "@/utils/docs";

describe("docs task guides", () => {
  it("extracts document slugs", () => {
    expect(docSlug("/src/docs/effects-recipes.md")).toBe("effects-recipes");
  });

  it("points task guides at ordered documentation pages", () => {
    const orderedSlugs = new Set(DOC_ORDER);

    expect(DOC_TASK_GUIDES).toHaveLength(8);
    expect(DOC_TASK_GUIDES.map((guide) => guide.id)).toEqual([
      "capture",
      "pose",
      "effects",
      "export",
      "workflows",
      "cli",
      "troubleshooting",
      "normal-maps",
    ]);
    expect(
      DOC_TASK_GUIDES.every((guide) => orderedSlugs.has(guide.docSlug)),
    ).toBe(true);
  });
});
