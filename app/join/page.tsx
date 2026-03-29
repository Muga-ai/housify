"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import JoinPageClient from "./JoinPageClient";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <JoinPageClient />
    </Suspense>
  );
}