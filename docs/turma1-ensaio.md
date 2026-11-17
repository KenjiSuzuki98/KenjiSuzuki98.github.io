# Turma 01 · Ensaio ponta a ponta (T9)

## Parte 1: testes automáticos (já rodam sozinhos)

```bash
npm test
```

Os testes `tests/turma-*.test.js` simulam a planilha e o Apps Script e cobrem: promoção A/B ligada e
desligada, expiração dos 15 minutos, preço calculado só no servidor, trava de preço por 5 minutos,
reserva expirada, combo com uma noite lotada, cadeira extra, menor de 15 e de 18, fila de espera,
CPF duplicado, reembolso promovendo a fila, vale dos 2 primeiros, CSV, limpeza dos testes, fail-safe
da página (servidor fora do ar → preço de tabela) e acessibilidade.

## Parte 2: ensaio real (com o servidor no ar, antes das 19h)

Use nomes que **comecem com "TESTE"** (ex.: "TESTE Maria Silva"). No fim, o botão
**"Apagar inscrições de teste"** do painel remove só essas. Use CPFs de teste válidos (gerador de CPF
para testes) e o seu próprio celular.

Abra o painel no computador e a página no celular **com dados móveis** (Wi-Fi desligado).

| # | Passo | Esperado | OK? |
|---|---|---|---|
| 1 | Abrir a página sem promoção | Combo R$ 249,90, avulsa R$ 199,90, cadeira extra "indisponível" | |
| 2 | Painel: botão **A** | Em até 15 s a página mostra R$ 124,90 / R$ 99,90 com o preço de tabela riscado e a contagem | |
| 3 | Inscrição TESTE de combo | Tela do Pix com R$ 124,90, código FP..., contagem de 5 minutos | |
| 4 | Escanear o QR **sem pagar** (outra pessoa) | O app do banco mostra **R$ 124,90** e **KENJI MARCOS SUZUKI** | |
| 5 | "Copiar código Pix" e colar no app do banco | Mesmo valor e nome | |
| 6 | Painel: **Encerrar agora** no A | A página volta a R$ 249,90 | |
| 7 | Atualizar a página do item 3 | Reserva continua com **R$ 124,90** (preço travado) | |
| 8 | Painel: botão **B** + inscrição TESTE com cadeira extra (filho menor) | Pede parentesco, dados do filho, responsável e a declaração A1; total + R$ 30 | |
| 9 | Inscrição TESTE de titular com 16 anos | Pede o responsável e a declaração A1 | |
| 10 | Inscrição TESTE com nascimento de 14 anos | Bloqueia: idade mínima 15 anos | |
| 11 | Repetir o CPF do item 3 | "Já existe uma inscrição ativa com este CPF" | |
| 12 | 3 noites avulsas marcadas | Aparece a sugestão de trocar pelo combo | |
| 13 | Painel: "Marcar pago" no item 3 | Status "Pago", selo "1º inscrito · vale R$ 10" | |
| 14 | "Enviar confirmação + grupo" | WhatsApp abre com endereço, horário, power bank, conta Google, recibo e o **link do grupo** | |
| 15 | Painel: "Marcar reembolsado" | Vaga liberada (contador da noite diminui) | |
| 16 | Painel: desmarcar "Vendas abertas" | A página mostra "inscrições encerradas". **Marque de novo!** | |
| 17 | Exportar CSV | Abre no Excel/Planilhas com todos os campos | |
| 18 | **Apagar inscrições de teste** | Lista vazia e contadores zerados | |

Lotação e fila: não dá para testar sem lotar a noite de verdade; os testes automáticos já cobrem esse caso.

## Antes de publicar

- [ ] Ensaio completo, dados de teste apagados (item 18).
- [ ] `PLANILHA_ID`, `ADMIN_SENHA` forte e `GRUPO_TURMA` configurados.
- [ ] Inscrição da live (aba "Inscrições") continua funcionando depois de tudo.
- [ ] URL `/exec` em `data/site.json`.
- [ ] Textos de `turma-termos.html` revisados e `[PRAZO A DEFINIR]` preenchidos.
- [ ] Botões A e B **desligados** antes de abrir a página para o público.
