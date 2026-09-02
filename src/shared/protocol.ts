import { z } from "zod";

export const PROTOCOL_VERSION = 1;

export const AgentRequestSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  requestId: z.string(),
  sessionId: z.string().optional(),
  workspacePath: z.string().optional(),
  command: z.enum(["message", "reset", "delete"]).optional().default("message"),
  message: z.string().optional().default(""),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string(), requestId: z.string() }),
  z.object({ type: z.literal("lifecycle"), event: z.string(), requestId: z.string() }),
  z.object({ type: z.literal("done"), finalResponse: z.string(), requestId: z.string() }),
  z.object({ type: z.literal("error"), error: z.string(), requestId: z.string() }),
  z.object({ type: z.literal("system"), event: z.string(), requestId: z.string().optional(), message: z.string().optional() }),
  z.object({ type: z.literal("propose_effect"), summary: z.string(), payload: z.unknown(), requestId: z.string() })
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;
