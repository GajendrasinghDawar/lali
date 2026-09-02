import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the openai module before importing PiSession
vi.mock("openai", () => {
  class MockAzureOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          // Return an async iterable that yields chunks
          const chunks = [
            { choices: [{ delta: { content: "Hello" } }] },
            { choices: [{ delta: { content: " there" } }] },
          ];
          return (async function* () {
            for (const chunk of chunks) yield chunk;
          })();
        }),
      },
    };
  }
  return { AzureOpenAI: MockAzureOpenAI };
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
