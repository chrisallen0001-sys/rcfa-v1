"use client";

import { Suspense, useState, useCallback, useRef, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AletheiaLogo from "@/components/AletheiaLogo";
import ChangePasswordModal from "@/components/ChangePasswordModal";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const pending = searchParams.get("pending");
  const expired = searchParams.get("expired");
  const reset = searchParams.get("reset");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The ?reset=1 query parameter is set by the middleware in proxy.ts when an
  // authenticated user with mustResetPassword attempts to navigate to a
  // non-allowed path. If an unauthenticated user bookmarks this URL, the modal
  // will appear but any password-change API call will fail with a 401, and the
  // "Sign out" button will return them to the clean login form.
  const [showForceReset, setShowForceReset] = useState(reset === "1");
  const [loggingOut, setLoggingOut] = useState(false);
  const loggingOutRef = useRef(false);

  const handleResetSuccess = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const handleLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the logout request fails, clear local state so the user
      // can attempt to sign in again.
    }
    setShowForceReset(false);
    loggingOutRef.current = false;
    setLoggingOut(false);
    router.replace("/login");
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed.");
        return;
      }

      const data = await res.json();

      if (data.mustResetPassword) {
        setShowForceReset(true);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <AletheiaLogo className="mx-auto h-12 w-auto text-zinc-900 dark:text-zinc-50" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in to Aletheia
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {expired && !error && (
            <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Your session has expired. Please sign in again.
            </div>
          )}
          {pending && !error && !expired && (
            <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Your account has been created and is pending admin approval. You&apos;ll
              be able to log in once an administrator approves your account.
            </div>
          )}
          {registered && !error && !expired && !pending && (
            <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Account created successfully. Please sign in.
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitting ? "Signing in\u2026" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Register
          </Link>
        </p>
      </div>

      <ChangePasswordModal
        open={showForceReset}
        // No-op: mandatory modal cannot be dismissed
        onClose={() => {}}
        mandatory
        onSuccess={handleResetSuccess}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
