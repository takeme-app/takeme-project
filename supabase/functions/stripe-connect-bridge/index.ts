import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * stripe-connect-bridge
 *
 * Páginas HTTPS de ponte entre a Stripe e o app do motorista.
 * A Stripe exige URLs HTTPS em return_url/refresh_url de Account Links,
 * mas o motorista está num celular e precisa voltar para o app via deep link
 * (take-me-motorista://...). Esta função devolve um HTML que dispara o deep link
 * automaticamente e mostra um botão de fallback.
 *
 * Rotas:
 *   /return  -> abre take-me-motorista://stripe-connect-return
 *   /refresh -> abre take-me-motorista://payments (gera novo link ao abrir a tela)
 */

const APP_SCHEME = "take-me-motorista";
const DEEP_LINK_RETURN = `${APP_SCHEME}://stripe-connect-return`;
const DEEP_LINK_REFRESH = `${APP_SCHEME}://payments`;

function page(title: string, deepLink: string, bodyMessage: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta name="color-scheme" content="light dark" />
    <meta http-equiv="refresh" content="0; url=${deepLink}" />
    <title>${title} • Take Me</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
        color: #f8fafc;
        padding: 24px;
        text-align: center;
      }
      .card {
        max-width: 420px;
        width: 100%;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
        padding: 32px 24px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      }
      h1 { font-size: 22px; margin: 0 0 12px; font-weight: 700; }
      p  { font-size: 15px; line-height: 1.5; margin: 0 0 20px; color: #cbd5e1; }
      a.btn {
        display: inline-block;
        padding: 14px 22px;
        border-radius: 10px;
        background: #22c55e;
        color: #0f172a;
        text-decoration: none;
        font-weight: 700;
        font-size: 15px;
      }
      a.btn:active { transform: translateY(1px); }
      .spinner {
        width: 28px; height: 28px;
        border: 3px solid rgba(255,255,255,0.2);
        border-top-color: #22c55e;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
        margin: 0 auto 18px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .hint { margin-top: 16px; font-size: 12px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <main class="card" role="main">
      <div class="spinner" aria-hidden="true"></div>
      <h1>${title}</h1>
      <p>${bodyMessage}</p>
      <a class="btn" id="openApp" href="${deepLink}">Abrir o app Take Me</a>
      <p class="hint">Se nada acontecer em alguns segundos, toque no botão acima.</p>
    </main>
    <script>
      (function () {
        var deepLink = ${JSON.stringify(deepLink)};
        try { window.location.replace(deepLink); } catch (e) { /* ignore */ }
        setTimeout(function () {
          try { window.location.href = deepLink; } catch (e) { /* ignore */ }
        }, 350);
      })();
    </script>
  </body>
</html>`;
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve((req) => {
  const url = new URL(req.url);
  // O caminho vem como /stripe-connect-bridge/<rota> no runtime do Supabase.
  const path = url.pathname.replace(/\/+$/, "");
  const last = path.split("/").pop() ?? "";

  if (last === "refresh") {
    return htmlResponse(page(
      "Gerando novo link",
      DEEP_LINK_REFRESH,
      "O link anterior expirou. Estamos te devolvendo ao app para iniciar um novo cadastro.",
    ));
  }

  // Default: /return ou qualquer outro caminho dentro da função.
  return htmlResponse(page(
    "Cadastro recebido",
    DEEP_LINK_RETURN,
    "Recebemos seus dados. Estamos te devolvendo ao app Take Me.",
  ));
});
