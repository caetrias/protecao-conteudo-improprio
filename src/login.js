/* Tela de entrada: e-mail → código de 6 dígitos → página do guia */

export function paginaLogin(nomeGuia, modoTeste) {
  const nome = String(nomeGuia || "Guia").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#E34181" />
<title>Entrar | ${nome}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --rosa: #e34181; --rosa-escuro: #c2336d; --rosa-claro: #fce4ef; --rosa-suave: #fff6fa;
    --branco: #fff; --texto: #1f2937; --texto-suave: #4b5563; --borda: #f3d3e1; --erro: #b42318;
  }
  * { box-sizing: border-box; }
  html { font-size: 16px; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px;
    background: linear-gradient(180deg, var(--rosa-suave) 0%, var(--branco) 60%);
    color: var(--texto); font-family: "Poppins", system-ui, sans-serif; line-height: 1.6;
  }
  main { width: 100%; max-width: 400px; }
  h1 {
    font-family: "Quicksand", system-ui, sans-serif; font-weight: 700; font-size: 1.5rem;
    line-height: 1.25; text-align: center; margin: 0 0 24px; text-wrap: balance;
  }
  h1 em { font-style: normal; color: var(--rosa); }
  .cartao {
    background: var(--branco); border: 1px solid var(--borda); border-radius: 18px;
    padding: 24px 20px; box-shadow: 0 6px 24px rgba(227, 65, 129, 0.1);
  }
  h2 { font-family: "Quicksand", system-ui, sans-serif; font-size: 1.25rem; margin: 0 0 6px; }
  p { margin: 0 0 18px; color: var(--texto-suave); font-size: 0.9375rem; }
  label { display: block; font-weight: 600; font-size: 0.9375rem; margin-bottom: 6px; }
  input {
    width: 100%; font: inherit; font-size: 1.0625rem; padding: 13px 14px;
    border: 2px solid var(--borda); border-radius: 12px; background: var(--branco); color: var(--texto);
  }
  input:focus { outline: none; border-color: var(--rosa); }
  #codigo { letter-spacing: 0.5em; text-align: center; font-size: 1.5rem; font-weight: 600; }
  button {
    width: 100%; margin-top: 14px; padding: 14px; border: 0; border-radius: 999px;
    background: var(--rosa); color: var(--branco); font: inherit; font-weight: 600; font-size: 1rem; cursor: pointer;
  }
  button:hover { background: var(--rosa-escuro); }
  button:disabled { opacity: 0.6; cursor: wait; }
  .link {
    background: none; color: var(--rosa-escuro); padding: 6px; margin-top: 8px; font-size: 0.875rem;
  }
  .link:hover { background: none; text-decoration: underline; }
  .msg { min-height: 1.4em; margin: 10px 0 0; font-size: 0.875rem; color: var(--erro); }
  .msg.ok { color: var(--texto-suave); }
  [hidden] { display: none !important; }
  .teste { background: #fff7ed; color: #92400e; border-radius: 12px; padding: 10px 14px; margin: 0 0 16px; font-size: 0.875rem; text-align: center; }
  .ajuda { text-align: center; margin-top: 18px; font-size: 0.8125rem; }
</style>
</head>
<body>
<main>
  <h1>${nome}</h1>

  ${modoTeste ? '<p class="teste">Modo de teste: use qualquer e-mail e o código <strong>123456</strong>.</p>' : ""}
  <div class="cartao">
    <form id="passo-email">
      <h2>Entrar</h2>
      <p>Use o mesmo e-mail da sua compra. Vamos enviar um código para ele.</p>
      <label for="email">Seu e-mail</label>
      <input id="email" type="email" autocomplete="email" inputmode="email" required placeholder="voce@email.com" />
      <button type="submit">Receber código</button>
      <p class="msg" id="msg-email" role="alert"></p>
    </form>

    <form id="passo-codigo" hidden>
      <h2>Digite o código</h2>
      <p>${modoTeste ? 'Modo de teste: digite <strong>123456</strong>.<span hidden id="email-mostrado"></span>' : 'Enviamos um código de 6 dígitos para <strong id="email-mostrado"></strong>. Confira também a caixa de spam.'}</p>
      <label for="codigo">Código</label>
      <input id="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required />
      <button type="submit">Entrar</button>
      <button type="button" class="link" id="trocar">Usar outro e-mail</button>
      <p class="msg" id="msg-codigo" role="alert"></p>
    </form>
  </div>

  <p class="ajuda">Não recebeu? Espere 1 minuto e peça de novo.</p>
</main>

<script>
  var passoEmail = document.getElementById("passo-email");
  var passoCodigo = document.getElementById("passo-codigo");
  var email = "";

  function enviar(url, dados) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j._ok = r.ok; return j; });
    });
  }

  function travar(form, sim) {
    form.querySelector("button[type=submit]").disabled = sim;
  }

  passoEmail.addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = document.getElementById("msg-email");
    email = document.getElementById("email").value.trim();
    msg.textContent = "";
    travar(passoEmail, true);
    enviar("/api/codigo", { email: email }).then(function (r) {
      travar(passoEmail, false);
      if (!r._ok) { msg.textContent = r.erro || "Não foi possível enviar. Tente de novo."; return; }
      document.getElementById("email-mostrado").textContent = email;
      passoEmail.hidden = true;
      passoCodigo.hidden = false;
      document.getElementById("codigo").focus();
    }).catch(function () {
      travar(passoEmail, false);
      msg.textContent = "Sem conexão. Tente de novo.";
    });
  });

  passoCodigo.addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = document.getElementById("msg-codigo");
    msg.textContent = "";
    travar(passoCodigo, true);
    enviar("/api/entrar", { email: email, codigo: document.getElementById("codigo").value }).then(function (r) {
      if (!r._ok) {
        travar(passoCodigo, false);
        msg.textContent = r.erro || "Não foi possível entrar. Tente de novo.";
        return;
      }
      window.location.href = "/";
    }).catch(function () {
      travar(passoCodigo, false);
      msg.textContent = "Sem conexão. Tente de novo.";
    });
  });

  document.getElementById("trocar").addEventListener("click", function () {
    passoCodigo.hidden = true;
    passoEmail.hidden = false;
    document.getElementById("codigo").value = "";
    document.getElementById("email").focus();
  });
</script>
</body>
</html>`;
}
