import { auth } from "@clerk/nextjs/server";
import { DashboardShell } from "../dashboard/components/DashboardShell";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await auth.protect();
  return (
    <DashboardShell>
      <ChatClient />
    </DashboardShell>
  );
}

