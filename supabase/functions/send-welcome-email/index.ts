import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, fullName } = (await req.json()) as { email?: string; fullName?: string };
    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = email.trim().toLowerCase();
    const name = typeof fullName === "string" && fullName.trim() ? fullName.trim() : "você";

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
      const html = `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #111827;">Bem-vindo(a) ao Take Me!</h2>
          <p style="color: #374151; line-height: 1.6;">Olá, ${name}!</p>
          <p style="color: #374151; line-height: 1.6;">Sua conta foi criada com sucesso. Agora você pode agendar viagens, envios e muito mais.</p>
          <p style="color: #374151; line-height: 1.6;">Qualquer dúvida, estamos à disposição.</p>
          <p style="color: #6B7280; margin-top: 32px;">Equipe Take Me</p>
        </div>
      `;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: "Bem-vindo(a) ao Take Me!",
          html,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Resend error:", err);
      }
    } else {
      console.warn("[send-welcome-email] RESEND_API_KEY não definida — e-mail de boas-vindas NÃO enviado. Destinatário:", to);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar e-mail" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
