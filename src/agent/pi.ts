import { EventEmitter } from "events";
import { AzureOpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";

try { process.loadEnvFile(); } catch (_e) {}

const AZURE_BASE_URL = process.env.AZURE_OPENAI_BASE_URL || "https://princ-msg6fgey-southeastasia.services.ai.azure.com";
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || "";
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2025-04-01-preview";
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are Lali, a helpful personal AI assistant. You are direct, concise, and helpful.
When the user asks you to do something that requires an external action (sending email, publishing code, transferring funds), describe what you would do but do not pretend to execute it.
Keep responses focused and practical.`;

export class PiSession extends EventEmitter {
  history: ChatCompletionMessageParam[];
  client: AzureOpenAI;

  constructor(_workspacePath?: string) {
    super();
    this.history = [{ role: "system", content: SYSTEM_PROMPT }];
    this.client = new AzureOpenAI({
      apiKey: AZURE_API_KEY,
      endpoint: AZURE_BASE_URL,
      apiVersion: AZURE_API_VERSION,
    });
    console.log("Initialized Pi session with Azure OpenAI");
  }

  async sendMessage(rawMessage: string) {
    this.emit("lifecycle", "start_thinking");

    // Handle effect results
    let message = rawMessage;
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.type === "effect_result") {
        message = "Effect " + parsed.id + " result: " + JSON.stringify(parsed.result);
      }
    } catch (_e) { /* not JSON, use raw */ }

    this.history.push({ role: "user", content: message });

    this.emit("lifecycle", "start_streaming");

    let fullText = "";
    try {
      const stream = await this.client.chat.completions.create({
        model: AZURE_DEPLOYMENT,
        messages: this.history,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          this.emit("text", delta);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.emit("lifecycle", "error");
      this.history.pop(); // remove the failed user message
      throw new Error("Azure OpenAI error: " + errMsg);
    }

    this.history.push({ role: "assistant", content: fullText });

    this.emit("lifecycle", "done_streaming");
    return { type: "text" as string, text: fullText };
  }
}
