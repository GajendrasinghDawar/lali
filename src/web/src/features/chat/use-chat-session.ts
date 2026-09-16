import { useEffect, useReducer, useRef } from "react";
import type { TimelineEvent } from "../../../../shared/timeline";
import { fetchWithCsrf } from "../../lib/api";

export type Message = {
  role: "user" | "assistant";
  content: string;
  requestId: string;
  idempotencyKey?: string;
  status?: "sending" | "delivered" | "failed";
  activities?: string[];
  effects?: any[];
  isComplete?: boolean;
};

type ChatState = {
  messages: Message[];
  isStreaming: boolean;
};

type ChatAction = 
  | { type: "eventReceived"; event: TimelineEvent }
  | { type: "submissionStarted"; idempotencyKey: string; text: string }
  | { type: "submissionAccepted"; idempotencyKey: string; requestId: string }
  | { type: "reset" };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "reset":
      return { messages: [], isStreaming: false };
      
    case "submissionStarted":
      return {
        ...state,
        messages: [...state.messages, {
          role: "user",
          content: action.text,
          requestId: action.idempotencyKey,
          idempotencyKey: action.idempotencyKey,
          status: "sending"
        }]
      };

    case "submissionAccepted":
      return {
        ...state,
        messages: state.messages.map(m => 
          m.idempotencyKey === action.idempotencyKey 
            ? { ...m, requestId: action.requestId, status: "delivered" } 
            : m
        )
      };

    case "eventReceived": {
      const { event } = action;
      
      // We rely on the fact that if a user_message arrives, we might already have it bound from submissionAccepted
      if (event.type === "user_message") {
        const exists = state.messages.some(m => m.requestId === event.requestId);
        if (!exists) {
          return {
            ...state,
            messages: [...state.messages, {
              role: "user",
              content: event.data.message,
              requestId: event.requestId,
              status: "delivered"
            }]
          };
        }
        return state;
      }

      if (event.type === "text") {
        const id = event.requestId;
        const msgs = [...state.messages];
        const existingIdx = msgs.findIndex(m => m.requestId === id && m.role === "assistant");
        
        if (existingIdx >= 0) {
          msgs[existingIdx] = {
            ...msgs[existingIdx],
            content: msgs[existingIdx].content + event.data.text
          };
        } else {
          msgs.push({
            role: "assistant",
            content: event.data.text,
            requestId: id,
            activities: []
          });
        }
        return { ...state, messages: msgs, isStreaming: true };
      }

      if (event.type === "lifecycle") {
        const id = event.requestId;
        const msgs = [...state.messages];
        let existingIdx = msgs.findIndex(m => m.requestId === id && m.role === "assistant");
        
        if (existingIdx === -1) {
          existingIdx = msgs.length;
          msgs.push({
            role: "assistant",
            content: "",
            requestId: id,
            activities: []
          });
        }
        
        msgs[existingIdx] = {
          ...msgs[existingIdx],
          activities: [...(msgs[existingIdx].activities || []), event.data.event]
        };
        return { ...state, messages: msgs, isStreaming: true };
      }

      if (event.type === "done" || event.type === "error" || event.type === "interrupted") {
        const id = event.requestId;
        const msgs = [...state.messages];
        const existingIdx = msgs.findIndex(m => m.requestId === id && m.role === "assistant");
        if (existingIdx >= 0) {
          msgs[existingIdx] = { ...msgs[existingIdx], isComplete: true };
          if (event.type === "error") {
             msgs[existingIdx].activities = [...(msgs[existingIdx].activities || []), `Error: ${(event.data as any).error}`];
          }
        }
        return { ...state, messages: msgs, isStreaming: false };
      }

      if (event.type === "propose_effect") {
        const id = event.requestId;
        const msgs = [...state.messages];
        let existingIdx = msgs.findIndex(m => m.requestId === id && m.role === "assistant");
        
        if (existingIdx === -1) {
          existingIdx = msgs.length;
          msgs.push({
            role: "assistant",
            content: "",
            requestId: id,
            activities: [],
            effects: []
          });
        }
        
        const effect = event.data.effect;
        msgs[existingIdx] = {
          ...msgs[existingIdx],
          effects: [...(msgs[existingIdx].effects || []), effect]
        };
        return { ...state, messages: msgs, isStreaming: true };
      }

      if (event.type === "effect_status") {
        const msgs = [...state.messages];
        let updated = false;
        
        for (let i = 0; i < msgs.length; i++) {
          const msg = msgs[i];
          if (msg.role === "assistant" && msg.effects) {
            const effectIdx = msg.effects.findIndex(e => e.id === event.data.id);
            if (effectIdx >= 0) {
              const newEffects = [...msg.effects];
              newEffects[effectIdx] = { ...newEffects[effectIdx], status: event.data.status };
              msgs[i] = { ...msg, effects: newEffects };
              updated = true;
              break;
            }
          }
        }
        
        if (updated) {
          return { ...state, messages: msgs };
        }
        return state;
      }

      return state;
    }

    default:
      return state;
  }
}

export function useChatSession(sessionId: string) {
  const [state, dispatch] = useReducer(chatReducer, { messages: [], isStreaming: false });
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    dispatch({ type: "reset" });

    const es = new EventSource(`/api/chat/events?sessionId=${encodeURIComponent(sessionId)}`);
    streamRef.current = es;

    es.onmessage = (e) => {
      const event: TimelineEvent = JSON.parse(e.data);
      
      // Batch updates with requestAnimationFrame could go here
      // For now, simple dispatch
      dispatch({ type: "eventReceived", event });
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  const submitMessage = async (text: string, attachmentIds: string[] = []) => {
    if (state.isStreaming || !text.trim()) return;

    const idempotencyKey = crypto.randomUUID();
    dispatch({ type: "submissionStarted", idempotencyKey, text });

    try {
      const res = await fetchWithCsrf("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text, idempotencyKey, attachmentIds })
      });
      
      if (!res.ok) {
        console.error("Failed to send message, server returned:", res.status);
        dispatch({ type: "reset" }); // or handle error state
        return;
      }
      
      const data = await res.json();
      if (data.request && data.request.id) {
        dispatch({ type: "submissionAccepted", idempotencyKey, requestId: data.request.id });
      }
    } catch (e) {
      console.error("Failed to send message", e);
    }
  };

  return { messages: state.messages, isStreaming: state.isStreaming, submitMessage };
}
