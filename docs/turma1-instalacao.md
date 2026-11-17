# Turma 01 · Como colocar no ar (cerca de 15 minutos)

Peças:

| Peça | Onde fica | Para quê |
|---|---|---|
| Página pública | `turma.html` | Vitrine, montador do pedido, formulário e Pix |
| Painel | `turma-admin.html` | Botões A e B, vagas, marcar pago, fila, reembolso, CSV |
| Servidor | Google Apps Script + Planilha Google | Relógio, preços, vagas e dados pessoais (privados) |
| Regras e textos legais | `turma-termos.html` | Regras, reembolso, A1, A2 e A3 (**rascunho: revisar**) |
| Certificado | `certificado-turma1.html` | Digitar o nome e imprimir/salvar em PDF |

Por que Google Apps Script: é grátis, **não pede cartão**, você já usa na inscrição da live, os dados ficam
na **sua** conta Google (nunca no GitHub) e o servidor tem relógio e trava contra duas inscrições ao mesmo tempo.

## 1. Criar o servidor

As reservas ficam numa aba nova, **"Reservas"**, dentro da **mesma planilha da live** (a das inscrições
da aula gratuita). O sistema cria essa aba sozinho e **não toca** na aba "Inscrições".

> **Não mexa no Apps Script que já está na planilha da live** (menu Extensões → Apps Script dela).
> Ele recebe as inscrições da aula gratuita. O servidor da Turma é um **projeto separado** que só abre
> a mesma planilha.
>
> Atenção: a aba "Reservas" terá CPFs e dados de menores. Se a planilha da live estiver compartilhada
> com alguém, essa pessoa também verá a aba nova. Confira em **Compartilhar** antes.

1. Abra a planilha da live e copie o **ID** dela na barra de endereço: é o trecho entre `/d/` e `/edit`
   (`https://docs.google.com/spreadsheets/d/ESTE-TRECHO/edit`).
2. Abra **https://script.google.com** → **Novo projeto**. Dê o nome "Turma 01 · Servidor".
3. Renomeie o arquivo `Código.gs` para **`Nucleo`** e cole nele **todo** o conteúdo de `assets/js/turma-nucleo.js`.
4. Clique em **+ → Script**, chame de **`Api`** e cole **todo** o conteúdo de `planilha/turma/Api.gs`.
5. Clique em **Salvar** (ícone de disquete).
6. **Configurações do projeto** (engrenagem à esquerda) → **Propriedades do script** → **Adicionar propriedade**:
   - `PLANILHA_ID` = o ID copiado no passo 1.
   - `ADMIN_SENHA` = uma senha forte, com **16 caracteres ou mais** (não use a senha do Google).
   - `GRUPO_TURMA` = o link do convite do grupo fechado da Turma 01.
7. **Implantar → Nova implantação** → engrenagem → **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
8. **Implantar**, autorize com a sua conta e copie a **URL do app da Web** (termina em `/exec`).
9. Teste: abra a URL no navegador. Deve aparecer um texto começando com `{"ok":true,"agora":...`.

## 2. Ligar o site ao servidor

Em `data/site.json`, no bloco `"turma"`, cole a URL:

```json
"turma": {
  "endpoint": "https://script.google.com/macros/s/SEU-ID/exec",
  "provaSocial": []
}
```

Sem essa URL, a página mostra o preço de tabela e o botão do WhatsApp (é o **Plano B** do plano).

## 3. Publicar

Só depois do ensaio (`docs/turma1-ensaio.md`): `git add`, `git commit` e `git push` no `main`.
O GitHub Pages atualiza em cerca de 1 minuto:

- Página: `https://kenjisuzuki98.github.io/turma.html`
- Painel: `https://kenjisuzuki98.github.io/turma-admin.html` (não aparece em buscadores)

## Se mudar o código depois

Cole de novo no Apps Script e faça **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar**.
Assim a URL `/exec` continua a mesma. **Não** use "Nova implantação" de novo (ela gera outra URL).

## Durante a live

- **Faça login no painel antes da live.** A sessão dura 6 horas. Depois de 10 senhas erradas, o login fica
  bloqueado por 15 minutos (sessões já abertas continuam funcionando).
- Botão **A** liga a promoção (combo R$ 124,90, avulsa R$ 99,90) por 15 minutos para todo mundo.
  Botão **B** liga a cadeira extra (+R$ 30) por 15 minutos. São independentes e desligam sozinhos.
- Quem mandou o formulário durante a promoção tem **30 minutos com o preço travado** para pagar.
- Confirme cada Pix **no app do banco** antes de tocar em "Marcar pago". Depois, toque em
  **"Enviar confirmação + grupo"**: abre o WhatsApp com a mensagem pronta e o link do grupo.
- Os **2 primeiros pagamentos confirmados** aparecem com o selo "1º/2º inscrito · vale R$ 10".

## Onde ficam os dados

Na aba **Reservas** da planilha da live. A última coluna ("Dados (não editar)") é a que o sistema usa:
**não edite essa coluna à mão**. Para mudar status, use o painel. O CSV exportado tem CPFs completos:
guarde em local seguro e apague quando não precisar mais.
