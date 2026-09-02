import { EventEmitter } from "events";

export class PiSession extends EventEmitter {
  constructor(public workspacePath?: string) {
    super();
    // Simulate Pi SDK configuration
    // disableLocalExtensions: true ensures only global reviewed extensions load
    console.log(`Initialized Pi session for workspace ${workspacePath || "default"} with local extensions disabled`);
  }

  async sendMessage(rawMessage: string) {
    this.emit("lifecycle", "start_thinking");
    await new Promise((resolve) => setTimeout(resolve, 100));

    let isEffectResult = false;
    let message = rawMessage;
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.type === "effect_result") {
        isEffectResult = true;
        message = `Effect ${parsed.id} result: ${JSON.stringify(parsed.result)}`;
      }
    } catch (e) {}

    if (message.includes("fake effect transfer") && !isEffectResult) {
      this.emit("lifecycle", "proposing_effect");
      return { 
        type: "effect", 
        summary: "Transfer 100 fake coins", 
        payload: { action: "fake_transfer", amount: 100 } 
      };
    }

    this.emit("lifecycle", "start_streaming");
    const fakeResponse = `You said: "${message}". This is a fake deterministic response from the Pi SDK.`;
    
    for (let i = 0; i < fakeResponse.length; i += 5) {
      const chunk = fakeResponse.slice(i, i + 5);
      this.emit("text", chunk);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    this.emit("lifecycle", "done_streaming");
    return { type: "text", text: fakeResponse };
  }
}
