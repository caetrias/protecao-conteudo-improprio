# Configuração do login

> Passo a passo completo e nomenclatura para todos os produtos: doc "Login dos guias — configuração" (https://claude.ai/code/artifact/37d5e935-5d0d-4d0c-8677-b048540dd534).

O guia só abre para quem comprou. O fluxo:

1. A pessoa compra na Hotmart.
2. A Hotmart avisa o site (webhook) e o e-mail do comprador fica liberado.
3. Ela abre o link do guia, digita o e-mail da compra e recebe um código de 6 dígitos.
4. Digita o código e entra. O acesso fica salvo no aparelho por 30 dias.

Regras: código vale 10 minutos, 5 tentativas, 1 pedido por minuto. Máximo de 3 aparelhos por compra (o 4º derruba o mais antigo). Reembolso, chargeback ou cancelamento cortam o acesso na hora.

## Estrutura

| Pasta/arquivo | O que é |
|---|---|
| `public/` | O guia (index.html, styles.css, app.js, ícones). Só é servido com login. |
| `src/worker.js` | Login, webhook da Hotmart, sessões |
| `src/login.js` | Tela de entrada |
| `wrangler.jsonc` | Configuração do Worker na Cloudflare |

## Passo a passo

### 1. Criar o banco (KV) na Cloudflare

1. Painel da Cloudflare › **Storage & databases** › **Workers KV** › **Create instance** (ou **Create namespace**).
2. Nome: `acessos-<slug>` (este produto: `acessos-conteudo-improprio`).
3. Copie o **ID** que aparece.
4. No `wrangler.jsonc`, troque `COLE_AQUI_O_ID_DO_KV` por esse ID.

### 2. Criar a conta de e-mail (Resend)

O código é enviado pelo Resend (grátis até 3.000 e-mails/mês, 100/dia).

1. Crie a conta em resend.com.
2. **Para testar já:** sem domínio, o Resend só envia para o e-mail da sua própria conta. Use `EMAIL_FROM` = `Guia <onboarding@resend.dev>` no `wrangler.jsonc`.
3. **Para vender:** precisa de um domínio (ex.: um .com.br). Em **Domains › Add domain**, adicione e crie os registros DNS que o Resend pedir. Se o domínio estiver na Cloudflare, o Resend oferece configurar sozinho. Depois troque `EMAIL_FROM` para algo como `Guia Proteção <acesso@seudominio.com.br>`.
4. Em **API Keys › Create API key** (permissão "Sending access"), copie a chave `re_...`.

### 3. Cadastrar os segredos no Worker

Painel › **Workers & Pages** › `protecao-conteudo-improprio` › **Settings** › **Variables and Secrets** › **Add**. Escolha o tipo **Secret** para os três:

| Nome | Valor |
|---|---|
| `RESEND_API_KEY` | a chave `re_...` do Resend |
| `HOTMART_HOTTOK` | o hottok da Hotmart (passo 5) |
| `ADMIN_TOKEN` | uma senha longa sua, ex.: gerada com `openssl rand -hex 24` |

Segredos não ficam no código nem no GitHub, e continuam salvos entre um deploy e outro.

### 4. Publicar e testar

1. `git add -A && git commit -m "Login por código" && git push`. A Cloudflare publica sozinha.
2. Libere seu e-mail na mão para testar:

```bash
curl -X POST https://SEU-ENDERECO/api/admin/liberar \
  -H "Authorization: Bearer SEU_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com"}'
```

3. Abra o endereço do guia. Ele deve mandar para a tela de login. Peça o código e entre.

Para cortar alguém na mão, troque `liberar` por `bloquear` no comando acima. Use o mesmo comando para liberar quem comprou antes do login existir.

### 5. Ligar o webhook na Hotmart

1. Hotmart › **Ferramentas** › **Webhook** (pode aparecer como "API e Notificações").
2. Cadastre um webhook:
   - **URL:** `https://SEU-ENDERECO/api/hotmart`
   - **Produto:** o guia
   - **Versão:** 2.0.0
   - **Eventos:** Compra aprovada, Compra completa, Compra reembolsada, Chargeback, Compra cancelada
3. Copie o **hottok** da tela de webhooks e salve como segredo `HOTMART_HOTTOK` (passo 3).
4. Use o botão de teste da Hotmart. O site deve responder 200.
5. Opcional: coloque o ID do produto em `HOTMART_PRODUCT_ID` no `wrangler.jsonc` para ignorar vendas de outros produtos da mesma conta.

### 6. Entregar o link ao comprador

Na configuração do produto na Hotmart, use o endereço do guia como link de acesso (entrega por link externo / página de obrigado / e-mail de compra). Avise na mensagem: "Entre com o mesmo e-mail da compra".

## Limites que continuam existindo

- Quem pegar o link direto de um vídeo do YouTube (não listado) assiste sem login.
- Alguém pode passar o próprio e-mail para outra pessoa entrar, mas só em até 3 aparelhos, e cada entrada exige um código que chega no e-mail do comprador.
