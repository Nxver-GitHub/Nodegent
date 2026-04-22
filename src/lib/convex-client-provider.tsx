"use client";

import { ReactNode } from "react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";

let convex: ConvexReactClient | null = null;

function getConvexClient(url: string): ConvexReactClient {
  if (!convex) {
    convex = new ConvexReactClient(url);
  }
  return convex;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  // During `next build` without env vars, static pages (e.g. home, not-found)
  // can render without Convex. At runtime the env var is always set.
  // Any page that calls Convex hooks without this provider will error loudly.
  if (!url) {
    return <>{children}</>;
  }

  return (
    <ConvexProviderWithClerk client={getConvexClient(url)} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
