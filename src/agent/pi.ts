import { EventEmitter } from "events";
import { type Context } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";

try { process.loadEnvFile(); } catch (_e) {}

const AZURE_BASE_URL = (process.env.AZURE_OPENAI_BASE_URL || "https://princ-msg6fgey-southeastasia.services.ai.azure.com").trim();
const AZURE_API_KEY = (process.env.AZURE_OPENAI_API_KEY || "").trim();
const AZURE_API_VERSION = (process.env.AZURE_OPENAI_API_VERSION || "2025-04-01-preview").trim();
const AZURE_DEPLOYMENT = (process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini").trim().replace(/^"|"$/g, '');

const SYSTEM_PROMPT = `You are Lali, a helpful personal AI assistant. You are direct, concise, and helpful.
When the user asks you to do something that requires an external action (sending email, publishing code, transferring funds), describe what you would do but do not pretend to execute it.
Keep responses focused and practical.`;

const models = builtinModels();

export class PiSession extends EventEmitter {
  context: Context;

  constructor(_workspacePath?: string) {
    super();
    this.context = {
      systemPrompt: SYSTEM_PROMPT,
      messages: []
    };
    console.log("Initialized Pi session with pi-ai Azure OpenAI");
  }

  async sendMessage(rawMessage: string) {
    this.emit("lifecycle", "start_thinking");

    // Handle effect results
    let messageText = rawMessage;
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.type === "effect_result") {
        messageText = "Effect " + parsed.id + " result: " + JSON.stringify(parsed.result);
      }
    } catch (_e) { /* not JSON, use raw */ }

    this.context.messages.push({
      role: "user",
      content: [{ type: "text", text: messageText }],
      timestamp: Date.now()
    });

    let fullText = "";
    try {
      // Get a base model definition for Azure OpenAI responses
      const model = models.getModel('azure-openai-responses', 'gpt-4o') || models.getModel('azure-openai-responses', 'gpt-4o-mini');
      if (!model) throw new Error("Azure OpenAI model not found in pi-ai catalog");

      const stream = models.stream(model, this.context, {
        apiKey: AZURE_API_KEY,
        azureBaseUrl: AZURE_BASE_URL,
        azureDeploymentName: AZURE_DEPLOYMENT,
        azureApiVersion: AZURE_API_VERSION
      });

      for await (const event of stream) {
        if (event.type === "text_start") {
          this.emit("lifecycle", "start_streaming");
        } else if (event.type === "text_delta") {
          fullText += event.delta;
          this.emit("text", event.delta);
        } else if (event.type === "error") {
          throw new Error(event.error.errorMessage);
        }
      }
      
      const finalMessage = await stream.result();
      this.context.messages.push(finalMessage);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.emit("lifecycle", "error");
      this.context.messages.pop(); // remove the failed user message
      throw new Error("pi-ai error: " + errMsg);
    }

    this.emit("lifecycle", "done_streaming");
    return { type: "text" as string, text: fullText };
  }
}
