# Proteção contra conteúdo impróprio — página do produto

Página entregue ao cliente após a compra. HTML/CSS/JS puros, sem build: é só subir a pasta `produto/` na Hostgator.

## Arquivos

- `index.html` — conteúdo (cenários, tarefas, checklists)
- `styles.css` — visual (cores da marca em `:root`)
- `app.js` — vídeos, troca de cenário e progresso salvo no navegador

## Como trocar os placeholders pelos vídeos

Em cada tarefa há um bloco assim:

```html
<div class="video" data-video-id="" data-titulo="Ativar o Tempo de Uso"></div>
```

Cole o ID do vídeo do YouTube (não listado) em `data-video-id`. Ex.: para `https://youtu.be/AbC123xYz`, use `data-video-id="AbC123xYz"`. Vazio = aparece "Vídeo em produção".

## Pendências (verificar antes de gravar)

Ficam só aqui, fora do HTML, para não aparecerem para o cliente:

- Data de vigência do ECA Digital (nota do topo)
- Bloqueio de in-app browser no iOS 26 (Cenário 1, tarefa 2 — hoje citado só em "O que será protegido")
- Caminho "Configurações > Google > Controles da família" (Cenário 3)
- Caminho exato do Kids Space (Cenário 4, tarefa 2)
- "Meta AI não pode ser desligado" (Extras, tarefa 5)
- Kids Space: se não aparecer no tablet emulado, a tarefa vira só texto (remova o `<div class="video">`)
- Plano B do prazo: proteções extras só em texto (mesma troca acima)
- Revisão dos vídeos a cada 3–4 meses (menus mudam com atualizações)

## Cores da marca

| Token | Cor | Uso |
|---|---|---|
| `--rosa` | `#E34181` | cor principal, botões, destaques |
| `--rosa-escuro` | `#C2336D` | texto pequeno em rosa (contraste) |
| `--rosa-claro` | `#FCE4EF` | fundos de chips e caixas |
| `--rosa-suave` | `#FFF6FA` | fundos amplos |
| `--branco` | `#FFFFFF` | fundo da página |
