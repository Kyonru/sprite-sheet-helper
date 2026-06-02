import { describe, expect, it } from "vitest";
import type { Page } from "puppeteer";
import { triggerExport } from "../../cli/export";
import type { CliAtlasOptions } from "../../cli/types";

type TestWindow = Window & {
  __SSH_BRIDGE__?: {
    PubSub: {
      emit: (event: string, payload?: unknown) => void;
    };
  };
  __sshCapture__?: (href: string, filename: string) => void;
};

class FakeExportPage {
  event?: string;
  payload?: unknown;

  async exposeFunction(
    name: "__sshCapture__",
    fn: (href: string, filename: string) => void,
  ) {
    (window as TestWindow)[name] = fn;
  }

  async evaluate<Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    ...args: Args
  ) {
    (window as TestWindow).__SSH_BRIDGE__ = {
      PubSub: {
        emit: (event, payload) => {
          this.event = event;
          this.payload = payload;
          (window as TestWindow).__sshCapture__?.(
            "data:application/zip;base64,e30=",
            "spritesheet.zip",
          );
        },
      },
    };
    return fn(...args);
  }
}

describe("triggerExport CLI bridge", () => {
  it("passes atlas options through the browser export event", async () => {
    const page = new FakeExportPage();
    const atlasOptions: CliAtlasOptions = {
      layout: "packed",
      padding: 2,
      extrude: 1,
      scale: 0.5,
      maxAtlasSize: 512,
      allowMultiPage: true,
    };

    const result = await triggerExport(
      page as unknown as Page,
      "spritesheet",
      atlasOptions,
    );

    expect(result.filename).toBe("spritesheet.zip");
    expect(page.event).toBe("start_export");
    expect(page.payload).toEqual({
      format: "spritesheet",
      atlasOptions,
    });
  });

  it("keeps the previous third-argument timeout call shape", async () => {
    const page = new FakeExportPage();

    const result = await triggerExport(page as unknown as Page, "spritesheet", 1234);

    expect(result.filename).toBe("spritesheet.zip");
    expect(page.payload).toBe("spritesheet");
  });
});
