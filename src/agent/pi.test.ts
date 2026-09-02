import { describe, it, expect, vi } from "vitest";

vi.mock("@earendil-works/pi-ai", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    // We don't strictly need to mock the entire lib if we mock the models collection
  };
});

vi.mock("@earendil-works/pi-ai/providers/all", () => {
  return {
    builtinModels: () => ({
      getModel: () => ({ id: "mock-model", provider: "mock-provider" }),
      stream: (model: any, context: any, options: any) => {
        const events = [
          { type: "start", partial: { model: "mock-model" } },
          { type: "text_start" },
          { type: "text_delta", delta: "Hello" },
          { type: "text_delta", delta: " there" },
          { type: "text_end" },
          { type: "done", reason: "stop" }
        ];
        
        let i = 0;
        const stream = {
          [Symbol.asyncIterator]() {
            return {
              async next() {
                if (i < events.length) {
                  return { value: events[i++], done: false };
                }
                return { value: undefined, done: true };
              }
            };
          },
          async result() {
            return {
              role: "assistant",
              content: [{ type: "text", text: "Hello there" }],
              timestamp: Date.now()
            };
          }
        };
        return stream;
      }
    })
  };
});

import { PiSession } from "./pi.ts";

describe("PiSession", () => {
  it("emits lifecycle events and text when generating response", async () => {
    const session = new PiSession();
    const textEvents: string[] = [];
    const lifecycleEvents: string[] = [];
    session.on("text", (text: string) => textEvents.push(text));
    session.on("lifecycle", (event: string) => lifecycleEvents.push(event));

    const finalResponse = await session.sendMessage("hello");

    expect(lifecycleEvents).toContain("start_thinking");
    expect(lifecycleEvents).toContain("start_streaming");
    expect(lifecycleEvents).toContain("done_streaming");

    const completeText = textEvents.join("");
    expect(completeText).toBe("Hello there");
    expect((finalResponse as { text: string }).text).toBe("Hello there");
  });
});
