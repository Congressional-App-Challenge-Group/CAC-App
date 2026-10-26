import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Editor sign in",
  robots: { index: false, follow: false },
};

function LoginFallback() {
  return (
    <div className="card space-y-4 p-8">
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="shell max-w-md py-16 md:py-24">
      {/* useSearchParams() requires a Suspense boundary to allow static rendering. */}
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
