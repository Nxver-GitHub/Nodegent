"use client";

import { useEffect, useRef } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export default function DashboardPage() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const currentUser = useQuery(api.users.getCurrentUser);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (isClerkLoaded && user && !hasSynced.current) {
      hasSynced.current = true;
      ensureUser();
    }
  }, [isClerkLoaded, user, ensureUser]);

  if (!isClerkLoaded || currentUser === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Nodegent</h1>
          <UserButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome, {currentUser?.name ?? user?.firstName ?? "Student"}
        </h2>
        <p className="mt-2 text-gray-600">
          Your campus dashboard is ready. More features coming soon.
        </p>
      </div>
    </main>
  );
}
