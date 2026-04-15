import { auth } from "@clerk/nextjs/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  // Server-side auth guard — defense-in-depth beyond middleware
  await auth.protect();

  return <DashboardClient />;
}
