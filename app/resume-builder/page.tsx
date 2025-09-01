"use client";

import ResumeBuilder from "@/components/ResumeBuilder";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ResumeBuilderPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
    }
  }, [router]);

  return <ResumeBuilder onClose={() => router.push("/jobs")} />;
}