"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResumeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/interview-prep");
  }, [router]);
  return (
    <div className="flex items-center justify-center py-32 text-[var(--text-muted)] text-sm">
      Redirecting to Interview Prep...
    </div>
  );
}
