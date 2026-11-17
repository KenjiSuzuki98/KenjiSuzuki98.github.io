// Turma 1: painel admin (turma-admin.html) ligado ao backend simulado.
// Botões A e B, contadores por noite, listas, marcar pago, fila, reembolso, vale e CSV.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, fullData, settle, runAxe, read, clone } = require('./helpers');
const { createGas, inscricao } = require('./turma-gas');

const EP = 'https://script.google.com/macros/s/AKfycbTURMA_teste-1/exec';
const withTurma = () => { const d = fullData(); d.turma = { endpoint: EP }; return d; };

function router(gas, calls = []) {
  return (w, data) => async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('data/site.json')) return { ok: true, json: async () => clone(data) };
    if (u.startsWith(EP)) {
      calls.push({ url: u, opts });
      const out = opts.method === 'POST' ? gas.post(JSON.parse(opts.body)) : gas.get(Object.fromEntries(new URL(u).searchParams));
      return { ok: true, json: async () => clone(out) };
    }
    throw new Error('URL inesperada: ' + u);
  };
}

async function abrir(t, { gas = createGas(), confirmar = true, calls = [] } = {}) {
  const page = await loadPage('turma-admin.html', {
    data: withTurma(), fetch: router(gas, calls),
    before: (w) => { w.confirm = () => confirmar; w.URL.createObjectURL = () => 'blob:teste'; w.URL.revokeObjectURL = () => {}; },
  });
  t.after(() => page.window.close());
  return { ...page, gas, calls };
}
const $ = (d, id) => d.getElementById(id);
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

async function entrar(w, d, senha = 'senha-forte-de-teste-123') {
  $(d, 'senha').value = senha;
  $(d, 'loginForm').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await settle(w, 30);
}
const card = (d, codigo) => d.querySelector(`[data-codigo="${codigo}"]`);
async function acao(w, d, codigo, op) {
  card(d, codigo).querySelector(`[data-op="${op}"]`).click();
  await settle(w, 30);
}

test('Login: campo de senha, senha errada avisa e não abre o painel; não indexado', async (t) => {
  const { window, document } = await abrir(t);
  assert.equal($(document, 'senha').type, 'password');
  assert.equal($(document, 'senha').getAttribute('autocomplete'), 'current-password');
  assert.match(read('turma-admin.html'), /<meta name="robots" content="noindex, nofollow">/);
  await entrar(window, document, 'errada');
  assert.equal($(document, 'painel').hidden, true);
  assert.match(txt($(document, 'loginStatus')), /senha incorreta/i);
});

test('Login: token só na sessão (sessionStorage), nunca a senha', async (t) => {
  const { window, document } = await abrir(t);
  await entrar(window, document);
  assert.equal($(document, 'painel').hidden, false);
  assert.equal($(document, 'login').hidden, true);
  assert.equal(window.localStorage.length, 0);
  const salvo = JSON.stringify({ ...window.sessionStorage });
  assert.doesNotMatch(salvo, /senha-forte/);
  assert.ok(window.sessionStorage.getItem('turma-admin-token'));
});

test('Botão A: ativa a promoção por 15 min com contagem e "Encerrar agora"', async (t) => {
  const { window, document, gas } = await abrir(t);
  await entrar(window, document);
  assert.match(txt($(document, 'btnPromoA')), /Ativar promoção \(15 min\)/);
  $(document, 'btnPromoA').click();
  await settle(window, 30);
  assert.equal(gas.get().promoA.ativa, true);
  assert.match(txt($(document, 'timerPromoA')), /^1[45]:\d{2}$/);
  assert.equal($(document, 'fimPromoA').hidden, false);
  $(document, 'fimPromoA').click();
  await settle(window, 30);
  assert.equal(gas.get().promoA.ativa, false);
  assert.equal($(document, 'fimPromoA').hidden, true);
});

test('Botão B: ativa a cadeira extra por 15 min, independente do A', async (t) => {
  const { window, document, gas } = await abrir(t);
  await entrar(window, document);
  assert.match(txt($(document, 'btnPromoB')), /Ativar cadeira extra \(15 min\)/);
  $(document, 'btnPromoB').click();
  await settle(window, 30);
  assert.equal(gas.get().promoB.ativa, true);
  assert.equal(gas.get().promoA.ativa, false);
  assert.match(txt($(document, 'timerPromoB')), /^1[45]:\d{2}$/);
});

test('Contadores por noite (oficial e limite) e listas por status com CPF mascarado', async (t) => {
  const gas = createGas();
  const r = gas.post(inscricao({ titular: { cpf: '52998224725', nome: 'Ana Pendente Silva' } }));
  gas.post(inscricao({ combo: false, avulsos: [2] }));
  const { window, document } = await abrir(t, { gas });
  await entrar(window, document);
  assert.match(txt($(document, 'contNoite1')), /1\s*\/\s*10/);
  assert.match(txt($(document, 'contNoite1')), /máx\.? 14/);
  assert.match(txt($(document, 'contNoite2')), /2\s*\/\s*10/);
  const c = card(document, r.codigo);
  assert.ok(c, 'reserva aparece na lista');
  assert.match(txt(c), /Ana Pendente Silva/);
  assert.match(txt(c), /\*\*\*\.982\.247-\*\*/);
  assert.doesNotMatch(document.body.innerHTML, /52998224725|529\.982\.247-25/);
  assert.match(txt($(document, 'abaPendente')), /2/);
});

test('Marcar pago: confirma, vira "pago", 2 primeiros com vale e WhatsApp com convite do grupo', async (t) => {
  const gas = createGas();
  const r = gas.post(inscricao());
  const { window, document } = await abrir(t, { gas });
  await entrar(window, document);
  await acao(window, document, r.codigo, 'pagar');
  assert.equal(gas.admin(gas.login(), 'listar').reservas[0].status, 'pago');
  const c = card(document, r.codigo);
  assert.match(txt(c), /1º inscrito/);
  const wa = c.querySelector('[data-msg="confirmacao"]').getAttribute('href');
  assert.match(wa, /^https:\/\/wa\.me\/5517981596797\?text=/);
  const msg = decodeURIComponent(wa.split('text=')[1]);
  assert.ok(msg.includes('https://chat.whatsapp.com/GrupoTesteTurma01'));
  assert.match(msg, /Avenida 19, nº 2306/);
  assert.match(msg, /power bank/);
  assert.match(msg, /conta Google/);
  assert.match(msg, /recibo/i);
  await acao(window, document, r.codigo, 'vale');
  assert.equal(gas.admin(gas.login(), 'listar').reservas[0].vale, 'entregue');
});

test('Liberar e reembolsar pedem confirmação; sem confirmar, nada muda', async (t) => {
  const gas = createGas();
  const r = gas.post(inscricao());
  gas.admin(gas.login(), 'pagar', { codigo: r.codigo });
  const { window, document } = await abrir(t, { gas, confirmar: false });
  await entrar(window, document);
  await acao(window, document, r.codigo, 'reembolsar');
  assert.equal(gas.admin(gas.login(), 'listar').reservas[0].status, 'pago');
});

test('Reembolso libera a vaga e oferece promover a fila; promover dá nova reserva de 5 min', async (t) => {
  const gas = createGas();
  const cods = [];
  for (let i = 0; i < 14; i++) cods.push(gas.post(inscricao({ combo: false, avulsos: [1] })).codigo);
  gas.admin(gas.login(), 'pagar', { codigo: cods[0] });
  const fila = gas.post(inscricao());
  const { window, document } = await abrir(t, { gas });
  await entrar(window, document);
  await acao(window, document, cods[0], 'reembolsar');
  assert.match(txt($(document, 'painelStatus')), new RegExp(`promover.*${fila.codigo}`, 'i'));
  await acao(window, document, fila.codigo, 'promover');
  assert.equal(gas.get({ action: 'reserva', codigo: fila.codigo }).status, 'pendente');
});

test('Abrir/fechar vendas e consentimento de imagem obrigatório/opcional', async (t) => {
  const { window, document, gas } = await abrir(t);
  await entrar(window, document);
  assert.equal($(document, 'chkVendas').checked, true);
  $(document, 'chkVendas').click();
  await settle(window, 30);
  assert.equal(gas.get().vendasAbertas, false);
  assert.equal($(document, 'chkImagem').checked, true);
  $(document, 'chkImagem').click();
  await settle(window, 30);
  assert.equal(gas.get().imagemObrigatoria, false);
});

test('Exportar CSV: dados completos, separador ";" e proteção contra fórmulas', async (t) => {
  const { window } = await abrir(t);
  const csv = window.TurmaAdmin.csv([{
    codigo: 'FPABCDEF', status: 'pago', tipo: 'combo', noites: [1, 2, 3], pessoas: 1, total: 12490, criadoEm: 0, pagoEm: 0, vale: '',
    titular: { nome: '=HYPERLINK("x")', cpf: '52998224725', celular: '5517981596797', email: 'a@b.com', sexo: 'F', endereco: 'Rua; A', cep: '14780000', nascimento: '1990-01-01', menor: false },
    extraPessoa: null, consentimentos: { privacidade: true, imagem: true, responsavel: false },
  }]);
  const [cab, linha] = csv.replace(/^﻿/, '').split('\r\n');
  assert.match(cab, /^"Código";"Status"/);
  assert.match(linha, /"52998224725"/);
  assert.match(linha, /"'=HYPERLINK\(""x""\)"/);
  assert.match(linha, /"Rua; A"/);
  assert.match(linha, /"124,90"/);
});

test('Limpar dados de teste pede confirmação e chama o servidor', async (t) => {
  const gas = createGas();
  gas.post(inscricao({ titular: { nome: 'TESTE Ensaio Um' } }));
  const { window, document } = await abrir(t, { gas });
  await entrar(window, document);
  $(document, 'btnLimparTestes').click();
  await settle(window, 30);
  assert.equal(gas.admin(gas.login(), 'listar').reservas.length, 0);
});

test('Acessibilidade: painel logado com reservas passa no axe-core', async (t) => {
  const gas = createGas();
  const r = gas.post(inscricao());
  gas.admin(gas.login(), 'pagar', { codigo: r.codigo });
  gas.post(inscricao({ combo: false, avulsos: [3] }));
  const { window, document } = await abrir(t, { gas });
  await entrar(window, document);
  const { violations } = await runAxe(window);
  assert.equal(violations.length, 0, violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`).join('\n'));
});
