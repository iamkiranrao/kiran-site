"use client";

import { SessionProvider } from "next-auth/react";
import { ApiKeyProvider } from "@/context/ApiKeyContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ApiKeyProvider>{children}</ApiKeyProvider>
    </SessionProvider>
  );
}
