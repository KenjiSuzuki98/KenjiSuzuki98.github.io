// Turma 1: backend (Google Apps Script) de ponta a ponta, com planilha simulada.
// Cobre o ensaio T9: promo A/B on/off, expiração, combo com noite lotada, cadeira extra,
// menor de 18, fila, trava de preço, CPF duplicado, reembolso e limpeza dos testes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGas, inscricao, pessoa, responsavel } = require('./turma-gas');

const ligar = (gas, op) => gas.admin(gas.login(), op, { ligar: true });

test('Estado público: preço de tabela por padrão, relógio do servidor e sem revelar vagas', () => {
  const gas = createGas();
  const e = gas.get();
  assert.equal(e.ok, true);
  assert.equal(e.agora, gas.clock.ms);
  assert.equal(e.vendasAbertas, true);
  assert.equal(e.promoA.ativa, false);
  assert.equal(e.promoB.ativa, false);
  assert.deepEqual(e.precos, { avulso: { tabela: 19990, atual: 19990 }, combo: { tabela: 24990, atual: 24990 }, extra: null });
  assert.equal(e.noites.length, 3);
  const txt = JSON.stringify(e);
  assert.doesNotMatch(txt, /\b14\b|ocupad|lotad|vagas"/i, 'estado público não pode revelar capacidade');
  assert.doesNotMatch(txt, /chat\.whatsapp/, 'link do grupo só depois do Pix confirmado');
});

test('Botão A: ativa 15 min para todos, expira sozinho e "Encerrar agora" derruba', () => {
  const gas = createGas();
  const tok = gas.login();
  const r = gas.admin(tok, 'promoA', { ligar: true });
  assert.equal(r.ok, true);
  let e = gas.get();
  assert.equal(e.promoA.ativa, true);
  assert.equal(e.promoA.ate, gas.clock.ms + 15 * 60000);
  assert.equal(e.precos.combo.atual, 12490);
  assert.equal(e.precos.avulso.atual, 9990);
  assert.equal(e.precos.extra, null, 'A não liga a cadeira extra');
  gas.advance(15);
  e = gas.get();
  assert.equal(e.promoA.ativa, false);
  assert.equal(e.precos.combo.atual, 24990);
  gas.admin(tok, 'promoA', { ligar: true });
  gas.admin(tok, 'promoA', { ligar: false });
  assert.equal(gas.get().promoA.ativa, false);
});

test('Botão B: cadeira extra +R$ 30 por 15 min, independente do A', () => {
  const gas = createGas();
  ligar(gas, 'promoB');
  const e = gas.get();
  assert.equal(e.promoB.ativa, true);
  assert.equal(e.promoA.ativa, false);
  assert.equal(e.precos.extra, 3000);
  assert.equal(e.precos.combo.atual, 24990);
  gas.advance(16);
  assert.equal(gas.get().precos.extra, null);
});

test('Inscrição: combo na promo gera reserva pendente com Pix do valor exato e código', () => {
  const gas = createGas();
  ligar(gas, 'promoA');
  const r = gas.post(inscricao());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.status, 'pendente');
  assert.match(r.codigo, /^FP[2-9A-HJ-NP-Z]{6}$/);
  assert.equal(r.total, 12490);
  assert.equal(r.expiraEm, gas.clock.ms + 5 * 60000);
  assert.ok(r.pix.includes('5406124.90'));
  assert.ok(r.pix.includes('0508' + r.codigo));
  assert.equal(gas.rows().length, 2, 'cabeçalho + 1 reserva');
});

test('Inscrição: o valor vem do servidor; o navegador não consegue mudar o preço', () => {
  const gas = createGas();
  const body = inscricao();
  body.total = 100; body.precos = { combo: 1 }; body.pedido.preco = 1;
  const r = gas.post(body);
  assert.equal(r.total, 24990);
});

test('Trava de preço: quem reservou na promo mantém o valor depois que ela acaba', () => {
  const gas = createGas();
  ligar(gas, 'promoA');
  gas.advance(12);
  const r = gas.post(inscricao());
  gas.advance(4); // a promoção (15 min) acabou; a reserva (5 min) ainda vale
  assert.equal(gas.get().promoA.ativa, false);
  const c = gas.get({ action: 'reserva', codigo: r.codigo });
  assert.equal(c.ok, true);
  assert.equal(c.status, 'pendente');
  assert.equal(c.total, 12490);
  assert.ok(c.pix.includes('5406124.90'));
  assert.doesNotMatch(JSON.stringify(c), /cpf|Maria|celular|email/i, 'consulta pública sem dados pessoais');
});

test('Reserva expira em 5 min sem pagamento e libera a vaga', () => {
  const gas = createGas();
  const r = gas.post(inscricao());
  gas.advance(4);
  assert.equal(gas.get({ action: 'reserva', codigo: r.codigo }).status, 'pendente');
  gas.advance(1);
  assert.equal(gas.get({ action: 'reserva', codigo: r.codigo }).status, 'expirada');
  const tok = gas.login();
  const lista = gas.admin(tok, 'listar');
  assert.equal(lista.ocupacao[1], 0);
});

test('Cadeira extra: só com o botão B; com ele soma R$ 30 uma vez e ocupa 2 lugares', () => {
  const gas = createGas();
  const sem = gas.post(inscricao({ extra: true }));
  assert.equal(sem.ok, false);
  assert.equal(sem.erro, 'cadeira_indisponivel');
  ligar(gas, 'promoA'); ligar(gas, 'promoB');
  const com = gas.post(inscricao({ extra: true }));
  assert.equal(com.ok, true, JSON.stringify(com));
  assert.equal(com.total, 15490);
  const av = gas.post(inscricao({ combo: false, avulsos: [2], extra: true }));
  assert.equal(av.total, 9990 + 3000);
  const lista = gas.admin(gas.login(), 'listar');
  assert.deepEqual([lista.ocupacao[1], lista.ocupacao[2], lista.ocupacao[3]], [2, 4, 2]);
});

test('Menor de 18: exige responsável e A1; menor de 15 é recusado', () => {
  const gas = createGas();
  const crianca = gas.post(inscricao({ titular: { nascimento: '2013-01-01' } }));
  assert.equal(crianca.ok, false);
  assert.match(crianca.erros.nascimento, /15 anos/);
  const semResp = gas.post(inscricao({ titular: { nascimento: '2010-06-01' } }));
  assert.equal(semResp.ok, false);
  assert.ok(semResp.erros.responsavel);
  const ok = gas.post(inscricao({ titular: { nascimento: '2010-06-01', responsavel: responsavel() } }));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const semA1 = gas.post(inscricao({ titular: { nascimento: '2010-06-01', responsavel: responsavel() }, consent: { responsavel: false } }));
  assert.ok(semA1.erros.declaracaoResponsavel);
});

test('CPF duplicado: recusa nova inscrição com CPF que já tem reserva ativa', () => {
  const gas = createGas();
  const p = pessoa();
  const r1 = gas.post(inscricao({ titular: p }));
  assert.equal(r1.ok, true);
  const r2 = gas.post(inscricao({ titular: { ...p, nome: 'Outra Pessoa Teste' } }));
  assert.equal(r2.ok, false);
  assert.equal(r2.erro, 'cpf_duplicado');
  gas.advance(6); // a primeira expirou: pode tentar de novo
  assert.equal(gas.post(inscricao({ titular: p })).ok, true);
});

test('Lotação: 14 por noite; combo vai para a fila se 1 noite lotou; avulso de outra noite passa', () => {
  const gas = createGas();
  for (let i = 0; i < 14; i++) assert.equal(gas.post(inscricao({ combo: false, avulsos: [1] })).status, 'pendente');
  const combo = gas.post(inscricao());
  assert.equal(combo.ok, true);
  assert.equal(combo.status, 'fila');
  assert.equal(combo.pix, undefined, 'fila não recebe Pix');
  assert.deepEqual([...combo.lotadas], [1]);
  assert.equal(gas.post(inscricao({ combo: false, avulsos: [2] })).status, 'pendente');
  const resp = JSON.stringify(combo);
  assert.doesNotMatch(resp, /\b14\b/);
});

test('Formulário inválido é recusado antes de checar vagas ("lotada" só após o formulário)', () => {
  const gas = createGas();
  for (let i = 0; i < 14; i++) gas.post(inscricao({ combo: false, avulsos: [1] }));
  const r = gas.post(inscricao({ titular: { cpf: '123' } }));
  assert.equal(r.ok, false);
  assert.ok(r.erros.cpf);
  assert.equal(r.status, undefined);
});

test('Vendas: noite que já começou não vende; combo fecha na 1ª noite; parada total 25/11 23h', () => {
  const gas = createGas().at('2026-11-23T20:31:00-03:00');
  assert.equal(gas.post(inscricao()).erro, 'noite_encerrada');
  assert.equal(gas.post(inscricao({ combo: false, avulsos: [1] })).erro, 'noite_encerrada');
  assert.equal(gas.post(inscricao({ combo: false, avulsos: [2, 3] })).status, 'pendente');
  const e = gas.get();
  assert.deepEqual(e.noites.map((n) => n.aberta), [false, true, true]);
  assert.equal(e.comboAberto, false);
  gas.at('2026-11-25T23:00:00-03:00');
  assert.equal(gas.get().vendasAbertas, false);
  assert.equal(gas.post(inscricao({ combo: false, avulsos: [3] })).erro, 'vendas_encerradas');
});

test('Painel: "fechar vendas" bloqueia inscrições; "abrir" volta', () => {
  const gas = createGas();
  const tok = gas.login();
  gas.admin(tok, 'vendas', { abertas: false });
  assert.equal(gas.get().vendasAbertas, false);
  assert.equal(gas.post(inscricao()).erro, 'vendas_encerradas');
  gas.admin(tok, 'vendas', { abertas: true });
  assert.equal(gas.post(inscricao()).ok, true);
});

test('Painel: senha errada não entra; muitas tentativas bloqueiam; sem token nada funciona', () => {
  const gas = createGas();
  assert.equal(gas.post({ acao: 'login', senha: 'errada' }).ok, false);
  assert.equal(gas.admin('token-falso', 'listar').erro, 'nao_autorizado');
  assert.equal(gas.admin('', 'promoA', { ligar: true }).ok, false);
  for (let i = 0; i < 10; i++) gas.post({ acao: 'login', senha: 'errada' + i });
  assert.equal(gas.post({ acao: 'login', senha: gas.store.ADMIN_SENHA }).erro, 'bloqueado');
});

test('Painel: sem senha forte configurada no Apps Script, o login fica desligado', () => {
  const gas = createGas({ props: { ADMIN_SENHA: '123' } });
  assert.equal(gas.post({ acao: 'login', senha: '123' }).erro, 'senha_nao_configurada');
});

test('Painel: lista com CPF mascarado, contadores por noite e link do grupo só no painel', () => {
  const gas = createGas();
  const r = gas.post(inscricao({ titular: { cpf: '52998224725' } }));
  const l = gas.admin(gas.login(), 'listar');
  assert.equal(l.ok, true);
  assert.equal(l.capacidade.oficial, 10);
  assert.equal(l.capacidade.maxima, 14);
  const item = l.reservas.find((x) => x.codigo === r.codigo);
  assert.equal(item.titular.cpf, '***.982.247-**');
  assert.equal(item.status, 'pendente');
  assert.doesNotMatch(JSON.stringify(l.reservas), /52998224725/);
  assert.equal(l.grupo, 'https://chat.whatsapp.com/GrupoTesteTurma01');
});

test('Painel: marcar pago, 2 primeiros com vale R$ 10, exportar com dados completos', () => {
  const gas = createGas();
  const tok = gas.login();
  const cods = [0, 1, 2].map(() => gas.post(inscricao()).codigo);
  gas.admin(tok, 'pagar', { codigo: cods[2] }); gas.advance(1);
  gas.admin(tok, 'pagar', { codigo: cods[0] }); gas.advance(1);
  gas.admin(tok, 'pagar', { codigo: cods[1] });
  const l = gas.admin(tok, 'listar');
  const by = (c) => l.reservas.find((x) => x.codigo === c);
  assert.equal(by(cods[0]).status, 'pago');
  assert.equal(by(cods[2]).primeiro, 1);
  assert.equal(by(cods[0]).primeiro, 2);
  assert.equal(by(cods[1]).primeiro, 0);
  gas.admin(tok, 'vale', { codigo: cods[2], entregue: true });
  assert.equal(gas.admin(tok, 'listar').reservas.find((x) => x.codigo === cods[2]).vale, 'entregue');
  const ex = gas.admin(tok, 'exportar');
  assert.equal(ex.ok, true);
  assert.equal(ex.reservas.length, 3);
  assert.match(ex.reservas[0].titular.cpf, /^\d{11}$/);
  assert.ok(ex.reservas[0].consentimentos.privacidadeEm);
});

test('Painel: pagamento de reserva já expirada só entra se ainda houver vaga (ou forçando)', () => {
  const gas = createGas();
  const tok = gas.login();
  const atrasado = gas.post(inscricao({ combo: false, avulsos: [1] })).codigo;
  gas.advance(6);
  for (let i = 0; i < 14; i++) gas.post(inscricao({ combo: false, avulsos: [1] }));
  const r = gas.admin(tok, 'pagar', { codigo: atrasado });
  assert.equal(r.ok, false); assert.equal(r.erro, 'sem_vaga');
  assert.equal(gas.admin(tok, 'pagar', { codigo: atrasado, forcar: true }).ok, true);
});

test('Painel: estender +5 min e liberar vaga', () => {
  const gas = createGas();
  const tok = gas.login();
  const c = gas.post(inscricao()).codigo;
  gas.advance(4);
  gas.admin(tok, 'estender', { codigo: c });
  gas.advance(4);
  assert.equal(gas.get({ action: 'reserva', codigo: c }).status, 'pendente');
  gas.admin(tok, 'liberar', { codigo: c });
  assert.equal(gas.get({ action: 'reserva', codigo: c }).status, 'cancelada');
  assert.equal(gas.admin(tok, 'listar').ocupacao[1], 0);
});

test('Fila: reembolso libera a vaga e indica quem promover; promover dá 5 min com o preço travado', () => {
  const gas = createGas();
  const tok = gas.login();
  ligar(gas, 'promoA');
  const pagos = [];
  for (let i = 0; i < 14; i++) pagos.push(gas.post(inscricao({ combo: false, avulsos: [1] })).codigo);
  gas.admin(tok, 'pagar', { codigo: pagos[0] });
  const fila = gas.post(inscricao());
  assert.equal(fila.status, 'fila');
  assert.equal(gas.admin(tok, 'promover', { codigo: fila.codigo }).erro, 'sem_vaga');
  const re = gas.admin(tok, 'reembolsar', { codigo: pagos[0] });
  assert.equal(re.ok, true);
  assert.equal(re.proximaFila, fila.codigo);
  gas.advance(20); // a promoção acabou, mas o preço da fila está travado
  const pr = gas.admin(tok, 'promover', { codigo: fila.codigo });
  assert.equal(pr.ok, true, JSON.stringify(pr));
  const c = gas.get({ action: 'reserva', codigo: fila.codigo });
  assert.equal(c.status, 'pendente');
  assert.equal(c.total, 12490);
  assert.equal(c.expiraEm, gas.clock.ms + 5 * 60000);
  assert.equal(gas.admin(tok, 'listar').reservas.find((x) => x.codigo === pagos[0]).status, 'reembolsado');
});

test('Consentimento de imagem: obrigatório por padrão e configurável no painel (N-6)', () => {
  const gas = createGas();
  const tok = gas.login();
  assert.equal(gas.get().imagemObrigatoria, true);
  assert.ok(gas.post(inscricao({ consent: { imagem: false } })).erros.imagem);
  gas.admin(tok, 'imagem', { obrigatoria: false });
  assert.equal(gas.get().imagemObrigatoria, false);
  const r = gas.post(inscricao({ consent: { imagem: false } }));
  assert.equal(r.ok, true);
  const ex = gas.admin(tok, 'exportar').reservas[0];
  assert.equal(ex.consentimentos.imagem, false);
});

test('Robô: campo escondido preenchido não grava nada', () => {
  const gas = createGas();
  const b = inscricao(); b.website = 'http://spam';
  assert.equal(gas.post(b).ok, false);
  assert.equal(gas.rows().length, 0);
});

test('Ensaio: "limpar testes" apaga só as inscrições cujo titular começa com TESTE', () => {
  const gas = createGas();
  const tok = gas.login();
  gas.post(inscricao({ titular: { nome: 'TESTE Fulano Um' } }));
  gas.post(inscricao({ titular: { nome: 'Teste Fulano Dois' } }));
  const real = gas.post(inscricao({ titular: { nome: 'Cliente Real Silva' } }));
  const r = gas.admin(tok, 'limparTestes');
  assert.equal(r.removidas, 2);
  const l = gas.admin(tok, 'listar');
  assert.deepEqual(l.reservas.map((x) => x.codigo), [real.codigo]);
});

test('Planilha: grava tudo como texto (CPF e celular não perdem zeros) e nunca fora do Google', () => {
  const gas = createGas();
  gas.post(inscricao({ titular: { cpf: '07569457803' } }));
  const [cab, linha] = gas.rows();
  assert.equal(linha[cab.indexOf('Titular CPF')], '07569457803');
});

test('Planilha da live: script separado grava na aba "Reservas" da planilha indicada em PLANILHA_ID', () => {
  const gas = createGas({ standalone: true, props: { PLANILHA_ID: 'id-da-planilha-da-live' } });
  const r = gas.post(inscricao());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(gas.abertasPorId.length > 0);
  assert.ok(gas.abertasPorId.every((id) => id === 'id-da-planilha-da-live'));
  assert.equal(gas.rows().length, 2);
});

test('Planilha da live: a aba "Inscrições" da aula gratuita não é alterada', () => {
  const gas = createGas({ standalone: true, props: { PLANILHA_ID: 'id-da-planilha-da-live' } });
  const live = gas.ctx.SpreadsheetApp.openById('x').insertSheet('Inscrições');
  live.appendRow(['Data/hora', 'Evento', 'Nome']);
  live.appendRow(['17/11/2026', 'Aula gratuita', 'Pessoa da Live']);
  const antes = JSON.stringify(live.rows);
  const tok = gas.login();
  const c = gas.post(inscricao({ titular: { nome: 'TESTE Ensaio' } })).codigo;
  gas.admin(tok, 'pagar', { codigo: c });
  gas.admin(tok, 'limparTestes');
  assert.equal(JSON.stringify(live.rows), antes);
});

test('Script separado sem PLANILHA_ID: responde erro claro em vez de quebrar', () => {
  const gas = createGas({ standalone: true });
  const r = gas.post(inscricao());
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'planilha_nao_configurada');
});
