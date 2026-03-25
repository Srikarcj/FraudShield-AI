"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

export default function AuthPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const nextMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
    setMode(nextMode);
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  const title = useMemo(() => (mode === "signup" ? "Create your account" : "Sign in to your account"), [mode]);

  const validateEmail = () => {
    if (!email.trim()) {
      throw new Error("Email is required.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      throw new Error("Enter a valid email address.");
    }
  };

  const validatePhone = () => {
    if (!phone.trim()) {
      throw new Error("Mobile number is required.");
    }
    if (!/^\+?[1-9]\d{7,14}$/.test(phone.trim())) {
      throw new Error("Use phone format like +919999999999.");
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }

    try {
      validateEmail();
      if (!password) throw new Error("Password is required.");
      setBusy(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;

      toast.success("Signed in successfully.");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }

    try {
      validateEmail();
      validatePhone();
      if (!password) throw new Error("Password is required.");
      if (password !== confirmPassword) throw new Error("Passwords do not match.");
      setBusy(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            mobile_number: phone.trim()
          }
        }
      });
      if (error) throw error;

      if (data?.session) {
        toast.success("Account created and signed in.");
        router.push("/dashboard");
      } else {
        toast.success("Signup successful. Check email verification if your project requires it.");
        setMode("signin");
        setConfirmPassword("");
      }
    } catch (error) {
      toast.error(error?.message || "Signup failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!authLoading && user) {
    return null;
  }

  return (
    <section className="w-full py-8 md:py-10 lg:py-12">
      <div className="glass-panel mx-auto w-full max-w-2xl rounded-2xl p-4 md:p-6 lg:p-8">
        <div className="mb-5 flex rounded-lg border border-white/10 bg-slate-900/50 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
            }}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition",
              mode === "signin" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10"
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
            }}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition",
              mode === "signup" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10"
            )}
          >
            Create Account
          </button>
        </div>

        <h2 className="mb-4 text-2xl font-semibold text-white">{title}</h2>

        {mode === "signup" ? (
          <Input className="mb-3" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        ) : null}

        <Input className="mb-3" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        {mode === "signup" ? (
          <Input className="mb-3" placeholder="+919999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
        ) : null}

        <form className="space-y-3" onSubmit={mode === "signup" ? handleSignUp : handleSignIn}>
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signup" ? (
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          ) : null}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? <Spinner /> : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-slate-400">Phone number is stored as profile data only. No SMS OTP is sent from this page.</p>
      </div>
    </section>
  );
}
