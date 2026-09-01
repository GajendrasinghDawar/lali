import { z } from "zod";

export const AgentRequestSchema = z.object({
  requestId: z.string(),
  message: z.string(),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string(), requestId: z.string() }),
  z.object({ type: z.literal("lifecycle"), event: z.string(), requestId: z.string() }),
  z.object({ type: z.literal("done"), finalResponse: z.string(), requestId: z.string() }),
  z.object({ type: z.literal("error"), error: z.string(), requestId: z.string() }),
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;
