/* ==========================================================
   Login por código no e-mail — serve qualquer guia/kit.
   O que muda por produto fica no wrangler.jsonc (NOME_GUIA, PRODUTO, KV).
   - POST /api/hotmart      webhook da Hotmart (libera / corta acesso)
   - GET  /login            tela de entrada
   - POST /api/codigo       envia código de 6 dígitos por e-mail
   - POST /api/entrar       confere o código e cria a sessão
   - GET  /sair             encerra a sessão
   - POST /api/admin/liberar | /api/admin/bloquear   (uso manual)
   - resto                  só com sessão válida; serve os arquivos de public/
   ========================================================== */

import { paginaLogin } from "./login.js";

const SESSAO_DIAS = 30;
const CODIGO_MINUTOS = 10;
const MAX_TENTATIVAS = 5;
const MAX_APARELHOS = 3;

const LIBERA = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE"];
const CORTA = ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const metodo = request.method;

    try {
      if (pathname === "/api/hotmart" && metodo === "POST") return webhookHotmart(request, env);
      if (pathname === "/login" && metodo === "GET") return html(paginaLogin(env.NOME_GUIA));
      if (pathname === "/api/codigo" && metodo === "POST") return pedirCodigo(request, env);
      if (pathname === "/api/entrar" && metodo === "POST") return entrar(request, env);
      if (pathname === "/sair") return sair(request, env);
      if (pathname === "/api/admin/liberar" && metodo === "POST") return admin(request, env, true);
      if (pathname === "/api/admin/bloquear" && metodo === "POST") return admin(request, env, false);
      if (pathname.startsWith("/api/")) return json({ erro: "não encontrado" }, 404);

      // Conteúdo protegido
      const sessao = await lerSessao(request, env);
      if (!sessao) {
        if (aceitaHtml(request)) return Response.redirect(url.origin + "/login", 302);
        return new Response("Não autorizado", { status: 401 });
      }
      const resposta = await env.ASSETS.fetch(request);
      const nova = new Response(resposta.body, resposta);
      nova.headers.set("Cache-Control", "private, no-store");
      return nova;
    } catch (e) {
      console.error(e);
      return json({ erro: "Erro interno. Tente de novo." }, 500);
    }
  },
};

/* ---------- Hotmart ---------- */

async function webhookHotmart(request, env) {
  const corpo = await request.json().catch(() => null);
  const hottok = request.headers.get("X-HOTMART-HOTTOK") || (corpo && corpo.hottok);
  if (!env.HOTMART_HOTTOK || hottok !== env.HOTMART_HOTTOK) {
    return json({ erro: "hottok inválido" }, 401);
  }
  if (!corpo || !corpo.data) return json({ ok: true, ignorado: "sem dados" });

  const evento = corpo.event;
  const dados = corpo.data;
  const produto = dados.product && String(dados.product.id);
  if (env.HOTMART_PRODUCT_ID && produto && produto !== String(env.HOTMART_PRODUCT_ID)) {
    return json({ ok: true, ignorado: "outro produto" });
  }

  const email = normalizar(dados.buyer && dados.buyer.email);
  if (!email) return json({ ok: true, ignorado: "sem e-mail" });

  if (LIBERA.includes(evento)) {
    await liberar(env, email, {
      nome: (dados.buyer && dados.buyer.name) || "",
      telefone: (dados.buyer && dados.buyer.checkout_phone) || "",
      transacao: (dados.purchase && dados.purchase.transaction) || "",
      origem: "hotmart",
    });
    return json({ ok: true, acao: "liberado" });
  }
  if (CORTA.includes(evento)) {
    await bloquear(env, email);
    return json({ ok: true, acao: "bloqueado" });
  }
  return json({ ok: true, ignorado: evento || "sem evento" });
}

async function liberar(env, email, extra) {
  const atual = (await env.DB.get("comprador:" + email, "json")) || { sessoes: [] };
  const comprador = {
    ...atual,
    ...extra,
    email,
    ativo: true,
    atualizado: new Date().toISOString(),
  };
  await env.DB.put("comprador:" + email, JSON.stringify(comprador));
}

async function bloquear(env, email) {
  const atual = await env.DB.get("comprador:" + email, "json");
  if (!atual) return;
  for (const id of atual.sessoes || []) await env.DB.delete("sessao:" + id);
  atual.ativo = false;
  atual.sessoes = [];
  atual.atualizado = new Date().toISOString();
  await env.DB.put("comprador:" + email, JSON.stringify(atual));
}

/* ---------- Código por e-mail ---------- */

async function pedirCodigo(request, env) {
  const { email: bruto } = await request.json().catch(() => ({}));
  const email = normalizar(bruto);
  if (!email || !email.includes("@")) return json({ erro: "Digite um e-mail válido." }, 400);

  const comprador = await env.DB.get("comprador:" + email, "json");
  if (!comprador || !comprador.ativo) {
    return json(
      { erro: "Não encontramos uma compra com esse e-mail. Use o mesmo e-mail da compra na Hotmart." },
      404,
    );
  }

  if (await env.DB.get("espera:" + email)) {
    return json({ erro: "Já enviamos um código. Aguarde 1 minuto para pedir outro." }, 429);
  }

  const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  await env.DB.put(
    "codigo:" + email,
    JSON.stringify({ hash: await sha256(email + ":" + codigo), tentativas: 0 }),
    { expirationTtl: CODIGO_MINUTOS * 60 },
  );
  await env.DB.put("espera:" + email, "1", { expirationTtl: 60 });

  await enviarEmail(env, email, codigo);
  return json({ ok: true });
}

async function enviarEmail(env, email, codigo) {
  if (!env.RESEND_API_KEY) {
    // Sem chave configurada (teste local): o código aparece no log do Worker.
    console.log(`[teste] código para ${email}: ${codigo}`);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: `Seu código de acesso: ${codigo}`,
      text: `Seu código de acesso ao ${env.NOME_GUIA || "guia"} é ${codigo}.\n\nEle vale por ${CODIGO_MINUTOS} minutos.\n\nSe você não pediu este código, ignore este e-mail.`,
      html: emailHtml(codigo, env.NOME_GUIA),
    }),
  });
  if (!r.ok) {
    console.error("Resend:", r.status, await r.text());
    throw new Error("falha ao enviar e-mail");
  }
}

function emailHtml(codigo, nomeGuia) {
  const nome = String(nomeGuia || "guia").replace(/[&<>"]/g, "");
  return `<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1f2937">
  <p style="font-size:16px;margin:0 0 16px">Seu código de acesso ao ${nome}:</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#e34181;margin:0 0 16px">${codigo}</p>
  <p style="font-size:14px;color:#4b5563;margin:0">Ele vale por ${CODIGO_MINUTOS} minutos. Se você não pediu este código, ignore este e-mail.</p>
</div>`;
}

async function entrar(request, env) {
  const { email: bruto, codigo } = await request.json().catch(() => ({}));
  const email = normalizar(bruto);
  const chave = "codigo:" + email;
  const salvo = await env.DB.get(chave, "json");
  if (!salvo) return json({ erro: "Código expirado. Peça um novo." }, 400);

  if (salvo.hash !== (await sha256(email + ":" + String(codigo || "").trim()))) {
    salvo.tentativas += 1;
    if (salvo.tentativas >= MAX_TENTATIVAS) {
      await env.DB.delete(chave);
      return json({ erro: "Muitas tentativas. Peça um novo código." }, 400);
    }
    await env.DB.put(chave, JSON.stringify(salvo), { expirationTtl: CODIGO_MINUTOS * 60 });
    return json({ erro: "Código incorreto. Confira e tente de novo." }, 400);
  }
  await env.DB.delete(chave);

  const comprador = await env.DB.get("comprador:" + email, "json");
  if (!comprador || !comprador.ativo) return json({ erro: "Acesso não liberado para esse e-mail." }, 403);

  // Nova sessão + limite de aparelhos (derruba a mais antiga)
  const id = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.put("sessao:" + id, JSON.stringify({ email }), {
    expirationTtl: SESSAO_DIAS * 86400,
  });
  comprador.sessoes = [...(comprador.sessoes || []), id];
  while (comprador.sessoes.length > MAX_APARELHOS) {
    await env.DB.delete("sessao:" + comprador.sessoes.shift());
  }
  await env.DB.put("comprador:" + email, JSON.stringify(comprador));

  return json({ ok: true }, 200, { "Set-Cookie": cookie(id, SESSAO_DIAS * 86400) });
}

async function sair(request, env) {
  const id = lerCookie(request);
  if (id) await env.DB.delete("sessao:" + id);
  return new Response(null, {
    status: 302,
    headers: { Location: "/login", "Set-Cookie": cookie("", 0) },
  });
}

async function lerSessao(request, env) {
  const id = lerCookie(request);
  if (!id) return null;
  return env.DB.get("sessao:" + id, "json");
}

/* ---------- Admin (liberar/bloquear na mão) ---------- */

async function admin(request, env, liberarAcesso) {
  const token = (request.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ erro: "não autorizado" }, 401);
  const { email: bruto, nome } = await request.json().catch(() => ({}));
  const email = normalizar(bruto);
  if (!email) return json({ erro: "informe o e-mail" }, 400);
  if (liberarAcesso) await liberar(env, email, { nome: nome || "", origem: "manual" });
  else await bloquear(env, email);
  return json({ ok: true, email, acao: liberarAcesso ? "liberado" : "bloqueado" });
}

/* ---------- Utilitários ---------- */

function normalizar(email) {
  return String(email || "").trim().toLowerCase();
}

function aceitaHtml(request) {
  return (request.headers.get("Accept") || "").includes("text/html");
}

function cookie(valor, maxAge) {
  return `sessao=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function lerCookie(request) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(/(?:^|;\s*)sessao=([a-f0-9]{64})/);
  return m ? m[1] : null;
}

async function sha256(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return hex(new Uint8Array(buf));
}

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(dados, status = 200, extra = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function html(corpo) {
  return new Response(corpo, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
