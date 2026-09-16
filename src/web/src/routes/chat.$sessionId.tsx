import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "../features/chat/ChatPage";

export const Route = createFileRoute("/chat/$sessionId")({
  component: ChatRouteComponent,
});

function ChatRouteComponent() {
  const { sessionId } = Route.useParams();
  return <ChatPage sessionId={sessionId} />;
}
