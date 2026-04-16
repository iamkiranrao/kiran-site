"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddSkillsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/career-vault");
  }, [router]);
  return (
    <div className="flex items-center justify-center py-32 text-[var(--text-muted)] text-sm">
      Redirecting to Career Vault...
    </div>
  );
}
