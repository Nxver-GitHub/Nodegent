import { auth } from "@clerk/nextjs/server";
import { DashboardClient } from "./dashboard-client";

// Auth-protected route — must be dynamic (not statically rendered)
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Server-side auth guard — defense-in-depth beyond middleware
  await auth.protect();

  return <DashboardClient />;
}
