import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, password } = (await req.json()) as { phone?: string; password?: string };
    const phoneDigits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
    const json = (body: object) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (!phoneDigits || phoneDigits.length < 10) {
      return json({ error: "Telefone inválido" });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return json({ error: "Senha inválida" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    let phoneToUse = phoneDigits;
    if (phoneDigits.startsWith("55") && phoneDigits.length > 12) {
      phoneToUse = phoneDigits.slice(2);
    }

    let { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", phoneToUse)
      .limit(1)
      .maybeSingle();

    if ((profileError || !profile?.id) && phoneToUse !== phoneDigits) {
      const res2 = await admin
        .from("profiles")
        .select("id")
        .eq("phone", phoneDigits)
        .limit(1)
        .maybeSingle();
      profile = res2.data;
      profileError = res2.error;
    }

    if (profileError || !profile?.id) {
      return json({ error: "Telefone ou senha incorretos" });
    }

    const { data: user, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !user?.user?.email) {
      return json({ error: "Telefone ou senha incorretos" });
    }

    const client = createClient(supabaseUrl, anonKey);
    const { data: sessionData, error: signInError } = await client.auth.signInWithPassword({
      email: user.user.email,
      password,
    });

    if (signInError || !sessionData.session) {
      return json({ error: "Telefone ou senha incorretos" });
    }

    return json({
      session: sessionData.session,
      user: sessionData.user,
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Erro ao entrar. Tente novamente." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
