"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JobRadarRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/job-central");
  }, [router]);
  return null;
}
