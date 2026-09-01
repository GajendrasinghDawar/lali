import { EventEmitter } from "events";

export class PiSession extends EventEmitter {
  constructor() {
    super();
  }

  async sendMessage(message: string) {
    this.emit("lifecycle", "start_thinking");
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.emit("lifecycle", "start_streaming");
    const fakeResponse = `You said: "${message}". This is a fake deterministic response from the Pi SDK.`;
    
    for (let i = 0; i < fakeResponse.length; i += 5) {
      const chunk = fakeResponse.slice(i, i + 5);
      this.emit("text", chunk);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    this.emit("lifecycle", "done_streaming");
    return fakeResponse;
  }
}
