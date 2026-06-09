import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: ud, error: ue } = await supabase.auth.getUser(token);
    if (ue || !ud.user) throw new Error("Not authenticated");

    const { data: adminCheck } = await supabase.rpc("is_admin", {
      _user_id: ud.user.id,
    });
    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const since7d = new Date(now - 7 * 86400_000).toISOString();
    const since30d = new Date(now - 30 * 86400_000).toISOString();
    const since1d = new Date(now - 86400_000).toISOString();

    // ---- Totals ----
    const [
      { count: totalUsers },
      { count: newUsers7d },
      { count: newUsers30d },
      { count: totalMemories },
      { count: memories7d },
      { count: memories30d },
      { count: pushSubs },
      { count: activeSubs },
      { count: trialingSubs },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since7d),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since30d),
      supabase.from("memories").select("*", { count: "exact", head: true }),
      supabase
        .from("memories")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since7d),
      supabase
        .from("memories")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since30d),
      supabase
        .from("push_subscriptions")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("active", true),
      supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("is_trialing", true),
    ]);

    // ---- DAU / WAU / MAU (distinct memory authors in window) ----
    const { data: memWindow } = await supabase
      .from("memories")
      .select("user_id, created_at")
      .gte("created_at", since30d);
    const dau = new Set<string>();
    const wau = new Set<string>();
    const mau = new Set<string>();
    for (const m of memWindow ?? []) {
      mau.add(m.user_id);
      if (m.created_at >= since7d) wau.add(m.user_id);
      if (m.created_at >= since1d) dau.add(m.user_id);
    }

    // ---- Storage per user via storage.objects ----
    const { data: storageRows } = await supabase
      .rpc("admin_storage_usage" as never)
      .select?.() ?? { data: null };
    // Fallback: direct SQL if RPC not present
    let perUserStorage: { user_id: string; bytes: number; objects: number }[] =
      [];
    let totalBytes = 0;
    if (storageRows && Array.isArray(storageRows)) {
      perUserStorage = storageRows as typeof perUserStorage;
      totalBytes = perUserStorage.reduce((s, r) => s + Number(r.bytes ?? 0), 0);
    } else {
      // Use raw SQL via pg
      const { data: rawRows } = await supabase
        .from("storage_usage_view" as never)
        .select("*");
      if (rawRows) {
        perUserStorage = rawRows as typeof perUserStorage;
        totalBytes = perUserStorage.reduce(
          (s, r) => s + Number(r.bytes ?? 0),
          0,
        );
      }
    }

    // Last-resort: paginate storage.objects directly
    if (perUserStorage.length === 0) {
      const storageMap = new Map<string, { bytes: number; objects: number }>();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: objs, error } = await supabase
          .schema("storage" as never)
          .from("objects")
          .select("name, metadata")
          .eq("bucket_id", "memories")
          .range(from, from + pageSize - 1);
        if (error || !objs || objs.length === 0) break;
        for (const o of objs as { name: string; metadata: any }[]) {
          const uid = (o.name ?? "").split("/")[0];
          if (!uid) continue;
          const size = Number(o.metadata?.size ?? 0);
          const cur = storageMap.get(uid) ?? { bytes: 0, objects: 0 };
          cur.bytes += size;
          cur.objects += 1;
          storageMap.set(uid, cur);
        }
        if (objs.length < pageSize) break;
        from += pageSize;
        if (from > 50_000) break; // safety
      }
      perUserStorage = Array.from(storageMap.entries()).map(([uid, v]) => ({
        user_id: uid,
        bytes: v.bytes,
        objects: v.objects,
      }));
      totalBytes = perUserStorage.reduce((s, r) => s + r.bytes, 0);
    }

    // ---- Users table (recent 200) ----
    const { data: recentProfiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    // Subscription map
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("user_id, active, is_trialing");
    const subMap = new Map<string, { active: boolean; is_trialing: boolean }>();
    for (const s of subs ?? [])
      subMap.set(s.user_id, {
        active: !!s.active,
        is_trialing: !!s.is_trialing,
      });

    // Memory counts per user (for recent profiles only)
    const { data: allMemUsers } = await supabase
      .from("memories")
      .select("user_id");
    const memCounts = new Map<string, number>();
    for (const m of allMemUsers ?? [])
      memCounts.set(m.user_id, (memCounts.get(m.user_id) ?? 0) + 1);

    const storageByUser = new Map(
      perUserStorage.map((r) => [r.user_id, r.bytes]),
    );

    // Get emails via auth admin (batched)
    const emailMap = new Map<string, string>();
    try {
      let page = 1;
      while (page <= 5) {
        const { data } = await supabase.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (!data?.users?.length) break;
        for (const u of data.users) if (u.email) emailMap.set(u.id, u.email);
        if (data.users.length < 200) break;
        page++;
      }
    } catch {
      // ignore
    }

    const users = (recentProfiles ?? []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      email: emailMap.get(p.user_id) ?? null,
      created_at: p.created_at,
      memories: memCounts.get(p.user_id) ?? 0,
      storage_bytes: storageByUser.get(p.user_id) ?? 0,
      subscription: subMap.get(p.user_id) ?? { active: false, is_trialing: false },
    }));

    return new Response(
      JSON.stringify({
        generated_at: new Date().toISOString(),
        totals: {
          users: totalUsers ?? 0,
          new_users_7d: newUsers7d ?? 0,
          new_users_30d: newUsers30d ?? 0,
          memories: totalMemories ?? 0,
          memories_7d: memories7d ?? 0,
          memories_30d: memories30d ?? 0,
          push_subscribers: pushSubs ?? 0,
          active_subscriptions: activeSubs ?? 0,
          trialing_subscriptions: trialingSubs ?? 0,
          storage_bytes: totalBytes,
        },
        activity: {
          dau: dau.size,
          wau: wau.size,
          mau: mau.size,
        },
        users,
      }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
