import { Suspense } from "react";
import AuthPageClient from "./AuthPageClient";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-slate-300">Loading auth page...</div>}>
      <AuthPageClient />
    </Suspense>
  );
}
