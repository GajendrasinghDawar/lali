export type UserMessageData = { message: string; attachmentIds?: string[] };
export type LifecycleData = { event: string };
export type TextDeltaData = { text: string };
export type DoneData = { finalResponse: string };
export type ErrorData = { error: string };
export type EffectData = { effect: any };
export type EffectStatusData = { id: string; status: "pending" | "approved" | "rejected" | "running" | "executed" | "failed" | "expired" | "unknown" };
export type InterruptedData = { message: string };

export type TimelineEvent =
  | { sequence: number; type: "user_message"; requestId: string; data: UserMessageData }
  | { sequence: number; type: "lifecycle"; requestId: string; data: LifecycleData }
  | { sequence: number; type: "text"; requestId: string; data: TextDeltaData }
  | { sequence: number; type: "done"; requestId: string; data: DoneData }
  | { sequence: number; type: "error"; requestId: string; data: ErrorData }
  | { sequence: number; type: "propose_effect"; requestId: string; data: EffectData }
  | { sequence: number; type: "effect_status"; requestId: string; data: EffectStatusData }
  | { sequence: number; type: "interrupted"; requestId: string; data: InterruptedData }
  | { sequence: number; type: "system"; requestId: string; data: any };
