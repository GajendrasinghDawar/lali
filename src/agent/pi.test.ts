import { describe, it, expect, vi } from "vitest";
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
    expect(completeText).toBe(finalResponse);
    expect(finalResponse).toContain("hello");
  });
});
