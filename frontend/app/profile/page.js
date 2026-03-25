"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, UserCircle2, Save, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import StatCard from "@/components/StatCard";
import TableComponent from "@/components/TableComponent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/authContext";
import { fetchPredictionHistory, isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const hydrateProfile = (activeUser) => {
    const nextName = activeUser?.user_metadata?.full_name || activeUser?.user_metadata?.name || "";
    const nextPhone = activeUser?.user_metadata?.mobile_number || activeUser?.phone || "";
    setName(nextName);
    setPhone(nextPhone);
  };

  const loadProfileData = async (activeUser = user) => {
    if (!activeUser) return;
    setBusy(true);
    try {
      const { data } = await fetchPredictionHistory(activeUser, 100);
      setHistory(Array.isArray(data) ? data : []);
      hydrateProfile(activeUser);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth?mode=signin");
      return;
    }

    loadProfileData(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  const saveProfile = async () => {
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: String(name || "").trim(),
          mobile_number: String(phone || "").trim()
        }
      });
      if (error) throw error;

      toast.success("Profile updated.");
      setEditMode(false);
    } catch (error) {
      toast.error(error?.message || "Profile update failed.");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const total = history.length;
    const fraud = history.filter((item) => Number(item.prediction) === 1).length;
    const safe = total - fraud;
    const avgConfidence = total
      ? history.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / total
      : 0;
    return { total, fraud, safe, avgConfidence };
  }, [history]);

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const email = user?.email || user?.user_metadata?.email || "-";

  return (
    <section className="space-y-6 py-2">
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10">
              <UserCircle2 className="h-7 w-7 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Profile</p>
              <h1 className="text-2xl font-semibold text-white">{name || "User"}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">{isSupabaseConfigured ? "Supabase Linked" : "Supabase Missing"}</Badge>
            <Button variant="outline" onClick={() => setEditMode((prev) => !prev)}>
              {editMode ? <><X className="mr-2 h-4 w-4" />Cancel</> : <><Pencil className="mr-2 h-4 w-4" />Edit Profile</>}
            </Button>
            <Button variant="outline" onClick={() => loadProfileData()} disabled={busy}>
              {busy ? <Spinner /> : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
            <p className="mb-1 inline-flex items-center gap-2"><Mail className="h-4 w-4 text-cyan-300" />Email</p>
            <p className="break-all">{email}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
            <p className="mb-1 inline-flex items-center gap-2"><Phone className="h-4 w-4 text-cyan-300" />Mobile</p>
            <p>{phone || "Not provided"}</p>
          </div>
        </div>

        {editMode ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-4 md:grid-cols-2">
            <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div className="md:col-span-2">
              <Button onClick={saveProfile} disabled={saving}>
                {saving ? <Spinner /> : <><Save className="mr-2 h-4 w-4" />Save Profile</>}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Predictions" value={stats.total} subtitle="Across your account" tone="default" />
        <StatCard title="Fraud Flagged" value={stats.fraud} subtitle="Predictions marked fraud" tone="danger" />
        <StatCard title="Safe" value={stats.safe} subtitle="Predictions marked safe" tone="success" />
        <StatCard title="Avg Confidence" value={`${stats.avgConfidence.toFixed(2)}%`} subtitle="Prediction confidence" tone="default" />
      </div>

      <div className="glass-panel rounded-xl p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Recent Activity</h2>
        <TableComponent
          rows={history.slice(0, 25)}
          emptyMessage="No prediction activity yet."
          columns={[
            { key: "created_at", label: "Time", render: (value) => new Date(value).toLocaleString() },
            { key: "input_type", label: "Input Type", render: (value) => String(value || "manual") },
            { key: "prediction", label: "Result", render: (value) => Number(value) === 1 ? "Fraud" : "Safe" },
            { key: "confidence", label: "Confidence", render: (value) => `${Number(value || 0).toFixed(2)}%` },
            { key: "model_used", label: "Model" }
          ]}
        />
      </div>
    </section>
  );
}
