// Turma 1: página pública (turma.html) ligada ao backend simulado.
// Montador de pedido, estados de preço, fail-safe, formulário, Pix e fila.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, fullData, settle, runAxe, read, clone } = require('./helpers');
const { createGas, inscricao, pessoa, responsavel } = require('./turma-gas');

const EP = 'https://script.google.com/macros/s/AKfycbTURMA_teste-1/exec';
const withTurma = (turma = {}) => { const d = fullData(); d.turma = { endpoint: EP, provaSocial: [], ...turma }; return d; };

// Liga a página ao backend simulado. gas.offline = true simula servidor fora do ar.
function router(gas, calls = []) {
  return (w, data) => async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('data/site.json')) return { ok: true, json: async () => clone(data) };
    if (u.startsWith(EP)) {
      calls.push({ url: u, opts });
      if (gas.offline) throw new Error('offline');
      const q = Object.fromEntries(new URL(u).searchParams);
      const out = opts.method === 'POST' ? gas.post(JSON.parse(opts.body)) : gas.get(q);
      return { ok: true, json: async () => clone(out) };
    }
    throw new Error('URL inesperada: ' + u);
  };
}

async function abrir(t, { gas = createGas(), data = withTurma(), query = '', calls = [] } = {}) {
  const page = await loadPage('turma.html', { data, fetch: router(gas, calls), query, before: (w) => { w.confirm = () => true; } });
  t.after(() => page.window.close());
  return { ...page, gas, calls };
}

const $ = (d, id) => d.getElementById(id);
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
function setv(w, d, id, v) {
  const el = $(d, id);
  if (el.type === 'checkbox' || el.type === 'radio') el.checked = v;
  else el.value = v;
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
function preencher(w, d, prefixo, p) {
  setv(w, d, prefixo + 'Nome', p.nome); setv(w, d, prefixo + 'Sexo', p.sexo); setv(w, d, prefixo + 'Cel', p.celular);
  setv(w, d, prefixo + 'Email', p.email); setv(w, d, prefixo + 'End', p.endereco); setv(w, d, prefixo + 'Cep', p.cep);
  setv(w, d, prefixo + 'Cpf', p.cpf); setv(w, d, prefixo + 'Nasc', p.nascimento);
}
function preencherResp(w, d, prefixo, r) {
  setv(w, d, prefixo + 'RNome', r.nome); setv(w, d, prefixo + 'RCpf', r.cpf); setv(w, d, prefixo + 'RCel', r.celular);
  setv(w, d, prefixo + 'REmail', r.email); setv(w, d, prefixo + 'RPar', r.parentesco);
}
function aceitar(w, d) { setv(w, d, 'cA2', true); setv(w, d, 'cA3', true); if (!$(d, 'wrapA1').hidden) setv(w, d, 'cA1', true); }
async function enviar(w, d) {
  $(d, 'turmaForm').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await settle(w, 30);
}
const posts = (calls) => calls.filter((c) => c.opts.method === 'POST');

test('Sem servidor configurado: preço de tabela, aviso e WhatsApp; nada é coletado (plano B)', async (t) => {
  const { document } = await abrir(t, { data: withTurma({ endpoint: '' }) });
  assert.match(txt($(document, 'precoCombo')), /R\$\s?249,90/);
  assert.match(txt($(document, 'precoAvulso')), /R\$\s?199,90/);
  assert.equal($(document, 'promoBanner').hidden, true);
  assert.equal($(document, 'avisoServidor').hidden, false);
  assert.ok($(document, 'avisoServidor').querySelector('a[href*="wa.me/5517981596797"]'));
  assert.ok(!$(document, 'turmaForm') || $(document, 'turmaForm').hidden);
});

test('Preço de tabela por padrão; cadeira extra indisponível sem o botão B', async (t) => {
  const { document } = await abrir(t);
  assert.match(txt($(document, 'precoCombo')), /249,90/);
  assert.match(txt($(document, 'precoAvulso')), /199,90/);
  assert.equal($(document, 'promoBanner').hidden, true);
  assert.equal($(document, 'optExtra').disabled, true);
  assert.match(txt($(document, 'extraInfo')), /indisponível/i);
  assert.equal($(document, 'turmaForm').hidden, false);
  assert.equal($(document, 'avisoServidor').hidden, true);
});

test('Botão A ligado: promoção para todos, sempre com o preço de tabela ao lado e contagem regressiva', async (t) => {
  const gas = createGas();
  gas.admin(gas.login(), 'promoA', { ligar: true });
  const { document } = await abrir(t, { gas });
  assert.match(txt($(document, 'precoCombo')), /124,90/);
  assert.match(txt($(document, 'tabelaCombo')), /249,90/);
  assert.match(txt($(document, 'precoAvulso')), /99,90/);
  assert.match(txt($(document, 'tabelaAvulso')), /199,90/);
  assert.equal($(document, 'promoBanner').hidden, false);
  assert.match(txt($(document, 'promoTimer')), /^1[45]:\d{2}$/);
  assert.match(txt($(document, 'totalPedido')), /124,90/);
});

test('Fail-safe: se o servidor parar de responder, volta ao preço de tabela (nunca promoção em cache)', async (t) => {
  const gas = createGas();
  gas.admin(gas.login(), 'promoA', { ligar: true });
  const { window, document } = await abrir(t, { gas });
  assert.match(txt($(document, 'precoCombo')), /124,90/);
  gas.offline = true;
  await window.TurmaPagina.atualizar();
  await settle(window);
  assert.match(txt($(document, 'precoCombo')), /249,90/);
  assert.equal($(document, 'promoBanner').hidden, true);
  assert.equal($(document, 'avisoServidor').hidden, false);
  assert.match(txt($(document, 'avisoServidor')), /preço de tabela/i);
});

test('Promoção encerrada no painel: a página volta sozinha ao preço de tabela', async (t) => {
  const gas = createGas();
  const tok = gas.login();
  gas.admin(tok, 'promoA', { ligar: true });
  const { window, document } = await abrir(t, { gas });
  gas.admin(tok, 'promoA', { ligar: false });
  await window.TurmaPagina.atualizar();
  assert.match(txt($(document, 'precoCombo')), /249,90/);
  assert.equal($(document, 'promoBanner').hidden, true);
});

test('Montador: Combo + Cadeira extra é o recomendado em destaque; combo e avulsos são exclusivos', async (t) => {
  const { window, document } = await abrir(t);
  assert.match(txt($(document, 'recomendado')), /Combo 3 noites \+ Cadeira extra/);
  assert.equal($(document, 'modoCombo').checked, true);
  assert.equal($(document, 'noite1').disabled, true);
  setv(window, document, 'modoAvulso', true);
  assert.equal($(document, 'noite1').disabled, false);
  setv(window, document, 'noite2', true);
  assert.match(txt($(document, 'totalPedido')), /199,90/);
  setv(window, document, 'modoCombo', true);
  assert.equal($(document, 'noite2').checked, false);
  assert.match(txt($(document, 'totalPedido')), /249,90/);
});

test('Montador: marcou as 3 avulsas → sugere o combo e troca com um clique', async (t) => {
  const gas = createGas();
  gas.admin(gas.login(), 'promoA', { ligar: true });
  const { window, document } = await abrir(t, { gas });
  setv(window, document, 'modoAvulso', true);
  for (const n of [1, 2, 3]) setv(window, document, 'noite' + n, true);
  const s = $(document, 'sugestaoCombo');
  assert.equal(s.hidden, false);
  assert.match(txt(s), /as 3 noites saem por R\$\s?124,90/i);
  $(document, 'trocarCombo').click();
  assert.equal($(document, 'modoCombo').checked, true);
  assert.equal(s.hidden, true);
});

test('Montador: noite que já começou fica indisponível; combo fecha na 1ª noite', async (t) => {
  const gas = createGas().at('2026-11-24T10:00:00-03:00');
  const { document } = await abrir(t, { gas });
  assert.equal($(document, 'modoCombo').disabled, true);
  assert.equal($(document, 'modoAvulso').checked, true);
  assert.equal($(document, 'noite1').disabled, true);
  assert.equal($(document, 'noite2').disabled, false);
});

test('Inscrição completa (combo na promo): Pix com valor exato, QR, copia e cola, código e comprovante no WhatsApp', async (t) => {
  const gas = createGas();
  gas.admin(gas.login(), 'promoA', { ligar: true });
  const calls = [];
  const { window, document } = await abrir(t, { gas, calls });
  preencher(window, document, 't', pessoa());
  aceitar(window, document);
  await enviar(window, document);
  const res = $(document, 'resultado');
  assert.equal(res.hidden, false, txt($(document, 'formStatus')));
  assert.equal($(document, 'turmaForm').hidden, true);
  const pix = $(document, 'pixCopia').value;
  assert.ok(pix.includes('5406124.90'));
  assert.ok(pix.includes('8126c242-f4fe-49f4-909a-17b790215cc6'));
  assert.ok(res.querySelector('.qr svg'), 'QR Code do Pix');
  const codigo = txt($(document, 'codigoReserva'));
  assert.match(codigo, /^FP[2-9A-HJ-NP-Z]{6}$/);
  assert.match(txt(res), /R\$\s?124,90/);
  assert.match(txt(res), /KENJI MARCOS SUZUKI/);
  assert.match(txt($(document, 'reservaTimer')), /^0[45]:\d{2}$/);
  const wa = $(document, 'btnComprovante').getAttribute('href');
  assert.match(wa, /^https:\/\/wa\.me\/5517981596797\?text=/);
  assert.ok(decodeURIComponent(wa).includes(codigo));
  const body = JSON.parse(posts(calls)[0].opts.body);
  assert.equal(body.acao, 'inscrever');
  assert.deepEqual(body.pedido, { combo: true, avulsos: [], extra: false });
  assert.equal(body.total, undefined, 'o navegador não manda preço');
  assert.equal(window.localStorage.length, 0, 'nada de dados pessoais no navegador');
});

test('Formulário: valida antes de enviar (CPF, CEP, celular, declarações)', async (t) => {
  const calls = [];
  const { window, document } = await abrir(t, { calls });
  preencher(window, document, 't', pessoa({ cpf: '12345678900', cep: '123' }));
  await enviar(window, document);
  assert.equal(posts(calls).length, 0);
  assert.match(txt($(document, 'etCpf')), /CPF inválido/);
  assert.match(txt($(document, 'etCep')), /CEP/);
  assert.match(txt($(document, 'ecA3')), /privacidade/i);
  assert.equal($(document, 'tCpf').getAttribute('aria-invalid'), 'true');
});

test('Formulário: máscaras de CPF, CEP e celular', async (t) => {
  const { window, document } = await abrir(t);
  setv(window, document, 'tCpf', '52998224725');
  setv(window, document, 'tCep', '14780000');
  setv(window, document, 'tCel', '17981596797');
  assert.equal($(document, 'tCpf').value, '529.982.247-25');
  assert.equal($(document, 'tCep').value, '14780-000');
  assert.equal($(document, 'tCel').value, '(17) 98159-6797');
});

test('Menor de 15: bloqueia. Menor de 18: pede responsável e mostra a declaração A1', async (t) => {
  const { window, document } = await abrir(t);
  assert.equal($(document, 'tResp').hidden, true);
  assert.equal($(document, 'wrapA1').hidden, true);
  setv(window, document, 'tNasc', '2013-02-02');
  assert.match(txt($(document, 'etNasc')), /15 anos/);
  setv(window, document, 'tNasc', '2010-02-02');
  assert.equal($(document, 'tResp').hidden, false);
  assert.equal($(document, 'wrapA1').hidden, false);
  for (const id of ['tRNome', 'tRCpf', 'tRCel', 'tREmail', 'tRPar']) assert.ok($(document, id), id);
  assert.match(txt($(document, 'wrapA1')), /responsável legal/);
});

test('Menor com responsável: inscrição chega ao servidor com os dados do responsável', async (t) => {
  const calls = [];
  const { window, document } = await abrir(t, { calls });
  preencher(window, document, 't', pessoa({ nascimento: '2010-02-02' }));
  preencherResp(window, document, 't', responsavel());
  aceitar(window, document);
  await enviar(window, document);
  assert.equal($(document, 'resultado').hidden, false, txt($(document, 'formStatus')));
  const body = JSON.parse(posts(calls)[0].opts.body);
  assert.equal(body.titular.responsavel.cpf, '00000000191');
  assert.equal(body.consentimentos.responsavel, true);
});

test('Cadeira extra (botão B): parentesco cônjuge/filho(a), "mesmo endereço", filho menor com o titular como responsável', async (t) => {
  const gas = createGas();
  const tok = gas.login();
  gas.admin(tok, 'promoA', { ligar: true });
  gas.admin(tok, 'promoB', { ligar: true });
  const calls = [];
  const { window, document } = await abrir(t, { gas, calls });
  assert.equal($(document, 'optExtra').disabled, false);
  assert.equal($(document, 'blocoExtra').hidden, true);
  setv(window, document, 'optExtra', true);
  assert.equal($(document, 'blocoExtra').hidden, false);
  assert.match(txt($(document, 'totalPedido')), /154,90/);
  const opts = [...$(document, 'xPar').options].map((o) => o.value).filter(Boolean);
  assert.deepEqual(opts, ['conjuge', 'filho']);
  const tit = pessoa();
  preencher(window, document, 't', tit);
  const filho = pessoa({ nome: 'Pedro Filho Teste', nascimento: '2011-01-01', endereco: '', cep: '' });
  preencher(window, document, 'x', filho);
  setv(window, document, 'xPar', 'filho');
  setv(window, document, 'xMesmoEnd', true);
  assert.equal($(document, 'xEnd').value, tit.endereco);
  assert.equal($(document, 'xResp').hidden, false);
  setv(window, document, 'xRTitular', true);
  assert.equal($(document, 'xRNome').value, tit.nome);
  setv(window, document, 'xRPar', 'Pai');
  aceitar(window, document);
  assert.equal($(document, 'wrapA1').hidden, false, 'declaração A1 aparece para o filho menor');
  await enviar(window, document);
  assert.equal($(document, 'resultado').hidden, false, txt($(document, 'formStatus')));
  assert.ok($(document, 'pixCopia').value.includes('5406154.90'));
  const body = JSON.parse(posts(calls)[0].opts.body);
  assert.equal(body.extra.parentesco, 'filho');
  assert.equal(body.extra.responsavel.cpf, tit.cpf);
});

test('Lotou: "turma lotada" só depois do formulário, com fila de espera e sem citar números', async (t) => {
  const gas = createGas();
  for (let i = 0; i < 14; i++) gas.post(inscricao({ combo: false, avulsos: [1] }));
  const { window, document } = await abrir(t, { gas });
  assert.doesNotMatch(document.body.textContent, /lotad/i, 'antes do formulário não fala em lotação');
  preencher(window, document, 't', pessoa());
  aceitar(window, document);
  await enviar(window, document);
  const res = $(document, 'resultado');
  assert.equal(res.hidden, false);
  assert.match(txt(res), /turma lotada/i);
  assert.match(txt(res), /fila de espera/i);
  assert.ok(!res.querySelector('#pixCopia'), 'fila não recebe Pix');
  assert.doesNotMatch(txt(res), /\b14\b|\b10 (vagas|lugares)\b|vagas? restantes?/i);
});

test('Erros do servidor aparecem para a pessoa (CPF já inscrito, promoção da cadeira extra encerrada)', async (t) => {
  const gas = createGas();
  const p = pessoa();
  gas.post(inscricao({ titular: p }));
  const { window, document } = await abrir(t, { gas });
  preencher(window, document, 't', p);
  aceitar(window, document);
  await enviar(window, document);
  assert.equal($(document, 'resultado').hidden, true);
  assert.match(txt($(document, 'formStatus')), /Já existe uma inscrição ativa com este CPF/);
  assert.equal($(document, 'btnInscrever').disabled, false);
});

test('Preço mudou no servidor entre a tela e o envio: vale o do servidor e a pessoa é avisada', async (t) => {
  const gas = createGas();
  const tok = gas.login();
  gas.admin(tok, 'promoA', { ligar: true });
  const { window, document } = await abrir(t, { gas });
  gas.admin(tok, 'promoA', { ligar: false });
  preencher(window, document, 't', pessoa());
  aceitar(window, document);
  await enviar(window, document);
  assert.ok($(document, 'pixCopia').value.includes('5406249.90'));
  assert.match(txt($(document, 'resultado')), /condição especial terminou/i);
});

test('Link com ?reserva=CÓDIGO mostra de novo o Pix da reserva (sem dados pessoais)', async (t) => {
  const gas = createGas();
  const r = gas.post(inscricao());
  const { document } = await abrir(t, { gas, query: '?reserva=' + r.codigo });
  assert.equal($(document, 'resultado').hidden, false);
  assert.equal(txt($(document, 'codigoReserva')), r.codigo);
  assert.equal($(document, 'pixCopia').value, r.pix);
});

test('Vendas encerradas: avisa e não mostra o formulário', async (t) => {
  const gas = createGas().at('2026-11-25T23:30:00-03:00');
  const { document } = await abrir(t, { gas });
  assert.equal($(document, 'encerrado').hidden, false);
  assert.equal($(document, 'turmaForm').hidden, true);
});

test('Prova social: só aparece material marcado como autorizado', async (t) => {
  const data = withTurma({ provaSocial: [
    { imagem: 'assets/uploads/foto-perfil.webp', alt: 'Turma em aula', legenda: 'Aula de IA', autorizado: true },
    { imagem: 'assets/uploads/x.webp', alt: 'Não autorizada', legenda: 'Não pode', autorizado: false },
  ] });
  const { document } = await abrir(t, { data });
  const sec = $(document, 'provaSocial');
  assert.equal(sec.hidden, false);
  assert.equal(sec.querySelectorAll('img').length, 1);
  assert.doesNotMatch(sec.textContent, /Não pode/);
  const { document: d2 } = await abrir(t);
  assert.equal($(d2, 'provaSocial').hidden, true, 'sem material, a seção some');
});

test('Textos públicos: regras da seção 6 do plano', async (t) => {
  const gas = createGas();
  const tok = gas.login();
  gas.admin(tok, 'promoA', { ligar: true }); gas.admin(tok, 'promoB', { ligar: true });
  const { window, document } = await abrir(t, { gas });
  setv(window, document, 'optExtra', true);
  setv(window, document, 'tNasc', '2010-01-01');
  const all = document.body.textContent.replace(/\s+/g, ' ') + read('turma.html') + read('turma-termos.html');
  assert.doesNotMatch(all.replace(/\d{2}\/\d{2}|\d{4}|R\$\s?[\d.,]+|\d+h\d*|\(\d{2}\) [\d-]+|nº \d+/g, ''), /\b14\b/, 'o número 14 nunca aparece');
  const ferramentas = /\b(Gemini|Claude|Copilot|Perplexity|Canva|CapCut|Gamma|Manus|Midjourney|Leonardo|ElevenLabs|HeyGen|Suno|Runway|Kling|DeepSeek|Grok|NotebookLM|Lovable|Zapier|n8n|Sora|Veo)\b/i;
  assert.doesNotMatch(all, ferramentas, 'sem nomes de ferramentas do Módulo 2');
  assert.doesNotMatch(all, /Mercado Fran[çc]a/i);
  const sebrae = all.match(/[^.]*Sebrae[^.]*/gi) || [];
  assert.ok(sebrae.length >= 1);
  for (const frase of sebrae) assert.match(frase, /instrutor de IA pelo Sebrae/i, `Sebrae só na biografia: "${frase}"`);
  for (const s of ['Do Zero ao Faixa Preta com Inteligência Artificial', 'Faixas Pretas em IA', 'O Primeiro Golpe: Dominando o ChatGPT', 'Dominando o Arsenal de IA',
    'A Arte do Impacto: Criação Audiovisual com IA', 'Missão Black Friday: IA em Campo!', 'Vagas limitadas', '15 anos', 'celular carregado', 'tomada', 'power bank',
    'conta Google', '6h', 'Kenji Marcos Suzuki', '19h50', '20h30', 'Avenida 19, nº 2306', '7 dias', 'Pix', 'Engenharia Elétrica', 'Liceutec', 'mais de 200 alunos']) {
    assert.ok(all.includes(s), `falta: ${s}`);
  }
  const { Compliance } = window;
  const _r = Compliance.findRiskyClaims(document.body.textContent); assert.equal(_r.length, 0, 'sem promessas de resultado: ' + [..._r].join('|'));
});

test('CSP: a página só conversa com o Google Apps Script', () => {
  const m = read('turma.html').match(/connect-src ([^;]+)/);
  assert.ok(m);
  assert.deepEqual(m[1].trim().split(/\s+/).sort(), ["'self'", 'https://script.google.com', 'https://script.googleusercontent.com'].sort());
});

test('Acessibilidade: página com promoção, cadeira extra, menor de idade e tela do Pix passa no axe-core', async (t) => {
  const gas = createGas();
  const tok = gas.login();
  gas.admin(tok, 'promoA', { ligar: true }); gas.admin(tok, 'promoB', { ligar: true });
  const { window, document } = await abrir(t, { gas });
  setv(window, document, 'optExtra', true);
  setv(window, document, 'tNasc', '2010-01-01');
  await enviar(window, document); // mostra os erros
  let { violations } = await runAxe(window);
  assert.equal(violations.length, 0, violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`).join('\n'));
  const r = gas.post(inscricao());
  const p2 = await abrir(t, { gas, query: '?reserva=' + r.codigo });
  ({ violations } = await runAxe(p2.window));
  assert.equal(violations.length, 0, violations.map((v) => v.id).join(', '));
});
