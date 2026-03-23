"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Content Audit has been absorbed into the Standards & Compliance dashboard.
 * This page now redirects to /dashboard/standards.
 */
export default function ContentAuditRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/standards");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-[var(--text-muted)]">
      <p className="text-sm">Redirecting to Standards & Compliance…</p>
    </div>
  );
}
