import { describe, expect, it } from "vitest";
import {
  getNormalCoverage,
  getNormalCoverageForRow,
} from "@/utils/exports/helpers";
import { exportRow, frame } from "../helpers/export-fixtures";

describe("normal map coverage helpers", () => {
  it("reports missing coverage for empty exports", () => {
    expect(getNormalCoverage([])).toEqual({
      totalFrames: 0,
      normalFrames: 0,
      missingFrames: 0,
      status: "missing",
    });
  });

  it("reports ready when every color frame has a normal frame", () => {
    const rows = [
      exportRow(
        "walk",
        [frame("walk-0"), frame("walk-1")],
        [frame("walk-n-0"), frame("walk-n-1")],
      ),
      exportRow("idle", [frame("idle-0")], [frame("idle-n-0")]),
    ];

    expect(getNormalCoverage(rows)).toMatchObject({
      totalFrames: 3,
      normalFrames: 3,
      missingFrames: 0,
      status: "ready",
    });
  });

  it("reports partial when some frames have normals", () => {
    const rows = [
      exportRow("walk", [frame("walk-0"), frame("walk-1")], [frame("walk-n-0")]),
      exportRow("idle", [frame("idle-0")]),
    ];

    expect(getNormalCoverage(rows)).toMatchObject({
      totalFrames: 3,
      normalFrames: 1,
      missingFrames: 2,
      status: "partial",
    });
  });

  it("ignores normals that do not line up with color frame indexes", () => {
    const row = exportRow("attack", [
      frame("attack-0"),
      frame("attack-1"),
      frame("attack-2"),
    ]);
    row.normalImages = new Array<string>(3);
    row.normalImages[2] = frame("attack-n-2");

    expect(getNormalCoverageForRow(row)).toMatchObject({
      totalFrames: 3,
      normalFrames: 1,
      missingFrames: 2,
      status: "partial",
    });
  });
});
