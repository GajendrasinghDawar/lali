import { EventEmitter } from "events";

export class PiSession extends EventEmitter {
  workspacePath?: string;
  constructor(workspacePath?: string) {
    super();
    this.workspacePath = workspacePath;
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

    if (message.includes("send email to") && !isEffectResult) {
      this.emit("lifecycle", "proposing_effect");
      const matchTo = message.match(/to\s+([^\s,;]+)/i);
      const to = matchTo ? matchTo[1] : "test@example.com";
      return {
        type: "effect",
        summary: `Send email to ${to}`,
        payload: { action: "send_email", to, subject: "Hello", body: "This is a test email body." }
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
