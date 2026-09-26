/* ==========================================================
   Proteção Digital da Família — comportamento da página
   - Vídeos: preencha data-video-id="ID_DO_YOUTUBE" em cada
     <div class="video"> no index.html. Vazio = placeholder.
   - Cenários: navegação por âncora (#iphone-crianca etc.).
   - Progresso: salvo no navegador do cliente (localStorage).
   ========================================================== */

(function () {
  "use strict";

  var PREFIXO = "pdf-conteudo:";

  /* ---------- Armazenamento seguro ---------- */

  function ler(chave) {
    try {
      return window.localStorage.getItem(PREFIXO + chave);
    } catch (e) {
      return null;
    }
  }
  function gravar(chave, valor) {
    try {
      if (valor === null) window.localStorage.removeItem(PREFIXO + chave);
      else window.localStorage.setItem(PREFIXO + chave, valor);
    } catch (e) {
      /* navegação privada ou armazenamento bloqueado: segue sem salvar */
    }
  }

  /* ---------- Vídeos ---------- */

  var ICONE_PLAY =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z"/></svg>';

  function montarVideos() {
    var videos = document.querySelectorAll(".video");
    Array.prototype.forEach.call(videos, function (el) {
      var id = (el.getAttribute("data-video-id") || "").trim();
      var titulo = el.getAttribute("data-titulo") || "Vídeo do passo a passo";

      if (id) {
        var iframe = document.createElement("iframe");
        iframe.src =
          "https://www.youtube-nocookie.com/embed/" +
          encodeURIComponent(id) +
          "?rel=0&modestbranding=1&playsinline=1";
        iframe.title = titulo;
        iframe.loading = "lazy";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        el.classList.remove("pendente");
        el.innerHTML = "";
        el.appendChild(iframe);
      } else {
        el.classList.add("pendente");
        el.innerHTML =
          '<div><div class="play">' +
          ICONE_PLAY +
          "</div><p>Vídeo em produção</p></div>";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", titulo + " (vídeo em produção)");
      }
    });
  }

  /* ---------- Cenários ---------- */

  var secoes = document.querySelectorAll(".cenario");
  var cards = document.querySelectorAll(".cenario-card");

  function secaoPorId(id) {
    if (!id) return null;
    var el = document.getElementById(id);
    return el && el.classList.contains("cenario") ? el : null;
  }

  function ativar(id, rolar) {
    var alvo = secaoPorId(id);
    if (!alvo) return;

    Array.prototype.forEach.call(secoes, function (s) {
      s.classList.toggle("ativo", s === alvo);
    });
    Array.prototype.forEach.call(cards, function (c) {
      c.setAttribute(
        "aria-current",
        c.getAttribute("href") === "#" + id ? "true" : "false",
      );
    });
    document.body.classList.add("tem-cenario");

    if (rolar) {
      window.requestAnimationFrame(function () {
        alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function aoMudarHash(rolar) {
    var id = decodeURIComponent(window.location.hash.replace("#", ""));
    if (secaoPorId(id)) ativar(id, rolar);
  }

  /* ---------- Tarefas e checklist ---------- */

  function atualizarProgresso(secao) {
    var tarefas = secao.querySelectorAll(".tarefa");
    var feitas = secao.querySelectorAll(".tarefa.feita").length;
    var total = tarefas.length;
    var completo = total > 0 && feitas === total;

    var prog = secao.querySelector(".progresso");
    if (prog) {
      prog.querySelector(".conta").textContent =
        feitas + " de " + total + (total === 1 ? " tarefa" : " tarefas");
      prog.querySelector(".barra span").style.width =
        (total ? (feitas / total) * 100 : 0) + "%";
      prog.classList.toggle("completo", completo);
      prog
        .querySelector(".barra")
        .setAttribute("aria-valuenow", String(Math.round((feitas / total) * 100)));
    }

    var parabens = secao.querySelector(".parabens");
    if (parabens) parabens.classList.toggle("visivel", completo);

    var card = document.querySelector('.cenario-card[href="#' + secao.id + '"]');
    if (card) card.classList.toggle("completo", completo);
  }

  function marcarTarefa(tarefa, feita) {
    var btn = tarefa.querySelector(".btn-feito");
    tarefa.classList.toggle("feita", feita);
    if (btn) {
      btn.setAttribute("aria-pressed", feita ? "true" : "false");
      btn.querySelector(".txt").textContent = feita
        ? "Feito!"
        : "Marcar como feito";
    }
  }

  function montarTarefas() {
    var tarefas = document.querySelectorAll(".tarefa[data-id]");
    Array.prototype.forEach.call(tarefas, function (tarefa) {
      var id = tarefa.getAttribute("data-id");
      marcarTarefa(tarefa, ler("t:" + id) === "1");

      var btn = tarefa.querySelector(".btn-feito");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var feita = !tarefa.classList.contains("feita");
        marcarTarefa(tarefa, feita);
        gravar("t:" + id, feita ? "1" : null);
        var secao = tarefa.closest(".cenario");
        if (secao) atualizarProgresso(secao);
      });
    });

    var testes = document.querySelectorAll(".teste input[data-id]");
    Array.prototype.forEach.call(testes, function (input) {
      var id = input.getAttribute("data-id");
      input.checked = ler("c:" + id) === "1";
      input.addEventListener("change", function () {
        gravar("c:" + id, input.checked ? "1" : null);
      });
    });

    Array.prototype.forEach.call(secoes, atualizarProgresso);
  }

  /* ---------- Início ---------- */

  montarVideos();
  montarTarefas();

  // Nenhum cenário abre sozinho: o pai sempre escolhe o dele primeiro.
  if (secaoPorId(window.location.hash.replace("#", ""))) {
    aoMudarHash(true);
  }

  window.addEventListener("hashchange", function () {
    aoMudarHash(true);
  });

  // Clicar no card do cenário já ativo também rola até ele
  Array.prototype.forEach.call(cards, function (card) {
    card.addEventListener("click", function () {
      var id = card.getAttribute("href").replace("#", "");
      if (window.location.hash === "#" + id) ativar(id, true);
    });
  });
})();
