import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

let cachedUserIdField = null;
let resolveFieldPromise = null;

function normalizeSupabaseUser(user) {
  if (!user) return { authUserId: "", email: "" };
  return {
    authUserId: user.id || "",
    email: user.email || user.user_metadata?.email || ""
  };
}

function errorText(error) {
  return `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
}

function isMissingColumnError(error, columnName) {
  const text = errorText(error);
  return text.includes("does not exist") && text.includes(String(columnName || "").toLowerCase());
}

async function probeField(idField, authUserId) {
  return supabase
    .from("users")
    .select(`id, ${idField}, email`)
    .eq(idField, authUserId)
    .limit(1)
    .maybeSingle();
}

async function resolveUserIdField(authUserId) {
  if (cachedUserIdField) {
    return { field: cachedUserIdField, existing: null, error: null };
  }

  if (resolveFieldPromise) {
    return resolveFieldPromise;
  }

  resolveFieldPromise = (async () => {
    // Try current schema first
    const authProbe = await probeField("auth_user_id", authUserId);
    if (!authProbe.error) {
      cachedUserIdField = "auth_user_id";
      return { field: "auth_user_id", existing: authProbe.data, error: null };
    }

    // Only try legacy schema if current schema column is missing
    if (isMissingColumnError(authProbe.error, "auth_user_id")) {
      const legacyProbe = await probeField("clerk_user_id", authUserId);
      if (!legacyProbe.error) {
        cachedUserIdField = "clerk_user_id";
        return { field: "clerk_user_id", existing: legacyProbe.data, error: null };
      }
      return { field: null, existing: null, error: legacyProbe.error };
    }

    return { field: null, existing: null, error: authProbe.error };
  })();

  try {
    return await resolveFieldPromise;
  } finally {
    resolveFieldPromise = null;
  }
}

export async function ensureUserRecord(user) {
  if (!supabase || !user?.id) {
    return { data: null, error: null };
  }

  const normalized = normalizeSupabaseUser(user);
  const resolved = await resolveUserIdField(normalized.authUserId);

  if (resolved.error || !resolved.field) {
    return { data: null, error: resolved.error || new Error("Unable to resolve users table id field.") };
  }

  const idField = resolved.field;
  let existing = resolved.existing;

  if (!existing) {
    const lookup = await probeField(idField, normalized.authUserId);
    if (lookup.error) {
      return { data: null, error: lookup.error };
    }
    existing = lookup.data;
  }

  if (existing?.id) {
    return supabase
      .from("users")
      .update({ email: normalized.email })
      .eq("id", existing.id)
      .select(`id, ${idField}, email`)
      .single();
  }

  return supabase
    .from("users")
    .insert({
      [idField]: normalized.authUserId,
      email: normalized.email
    })
    .select(`id, ${idField}, email`)
    .single();
}

export async function insertPredictionHistory(user, predictionPayload) {
  if (!supabase || !user?.id) {
    return { data: null, error: null };
  }

  const { data: userRow, error: userError } = await ensureUserRecord(user);
  if (userError || !userRow?.id) {
    return { data: null, error: userError || new Error("Unable to resolve user id.") };
  }

  const insertPayload = {
    user_id: userRow.id,
    input_type: predictionPayload.input_type || "manual",
    prediction: Number(predictionPayload.prediction || 0),
    confidence: Number(predictionPayload.confidence || 0),
    model_used: predictionPayload.model_used || "Hybrid Stacking"
  };

  return supabase.from("predictions").insert(insertPayload).select("*").single();
}

export async function fetchPredictionHistory(user, limit = 20) {
  if (!supabase || !user?.id) {
    return { data: [], error: null };
  }

  const { data: userRow, error: userError } = await ensureUserRecord(user);
  if (userError || !userRow?.id) {
    return { data: [], error: userError || new Error("Unable to resolve user id.") };
  }

  return supabase
    .from("predictions")
    .select("id, input_type, prediction, confidence, model_used, created_at")
    .eq("user_id", userRow.id)
    .order("created_at", { ascending: false })
    .limit(limit);
}
