// Certificado pós-aula (certificado.html): dados → avaliação → indicações → certificado.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, settle, runAxe, read, siteData } = require('./helpers');

const URL_PLANILHA = siteData().event.formEndpoint;

// Responde data/site.json e registra os envios para a planilha.
function backend(resposta = { ok: true, codigo: 'FP01-ABC234' }) {
  const calls = [];
  const fetch = (w, data) => async (url, opts) => {
    if (String(url).startsWith('https://script.google.com')) { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => resposta }; }
    return { ok: true, json: async () => JSON.parse(JSON.stringify(data)) };
  };
  return { calls, fetch };
}
const set = (w, id, v) => { const el = w.document.getElementById(id); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const submit = (w, id) => w.document.getElementById(id).dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
const pick = (w, name, value) => { w.document.querySelector(`input[name="${name}"][value="${value}"]`).checked = true; };

async function ate(w, etapa) {
  if (etapa >= 2) {
    set(w, 'cNome', 'maria da silva'); set(w, 'cCel', '17981596797'); set(w, 'cEmail', 'Maria@Example.com');
    submit(w, 'fDados'); await settle(w);
  }
  if (etapa >= 3) {
    pick(w, 'nps', '9'); pick(w, 'geral', '5'); pick(w, 'ritmo', 'Na medida');
    set(w, 'q_gostou', 'A parte de vídeo');
    set(w, 'q_aplicacao', 'Um app que responde clientes no WhatsApp');
    submit(w, 'fPesquisa'); await settle(w);
  }
}
function indicar(w) {
  set(w, 'iNome0', 'João Souza'); set(w, 'iTel0', '17988887777'); set(w, 'iEmp0', 'Padaria Sol');
  set(w, 'iNome1', 'Ana Lima'); set(w, 'iTel1', '1733224455');
  w.document.getElementById('iOk').checked = true;
}

test('Certificado: fluxo completo envia tudo de uma vez para a planilha das inscrições', async () => {
  const b = backend();
  const { window: w, document } = await loadPage('certificado.html', { fetch: b.fetch });
  assert.ok(document.getElementById('fDados'));
  await ate(w, 3);
  assert.ok(document.getElementById('fInd'), 'deveria estar na etapa de indicações');
  indicar(w);
  submit(w, 'fInd'); await settle(w, 30);

  assert.equal(b.calls.length, 1);
  assert.equal(b.calls[0].url, URL_PLANILHA, 'usa a mesma planilha da aula');
  const body = b.calls[0].body;
  assert.equal(body.tipo, 'certificado');
  assert.deepEqual(body.dados, { nome: 'Maria da Silva', celular: '5517981596797', email: 'maria@example.com', empresa: '', novidades: false });
  assert.equal(body.pesquisa.nps, '9');
  assert.equal(body.pesquisa.geral, '5');
  assert.equal(body.pesquisa.gostou, 'A parte de vídeo');
  assert.equal(body.pesquisa.aplicacao, 'Um app que responde clientes no WhatsApp');
  assert.deepEqual(body.indicacoes, [
    { nome: 'João Souza', telefone: '5517988887777', empresa: 'Padaria Sol' },
    { nome: 'Ana Lima', telefone: '551733224455', empresa: '' },
  ]);
  assert.match(document.getElementById('etapa').textContent, /Parabéns, Maria!/);
  assert.match(document.getElementById('etapa').textContent, /FP01-ABC234/);
  assert.ok(document.getElementById('baixarPdf') && document.getElementById('baixarPng'));
  assert.doesNotMatch(document.getElementById('etapa').textContent, /Modo de teste/);
});

test('Certificado: nota de 0 a 10, nota geral e aplicação que gostaria de criar são obrigatórias', async () => {
  const b = backend();
  const { window: w, document } = await loadPage('certificado.html', { fetch: b.fetch });
  await ate(w, 2);
  submit(w, 'fPesquisa'); await settle(w);
  assert.ok(document.getElementById('fPesquisa'), 'não deveria avançar');
  assert.match(document.getElementById('e_nps').textContent, /Escolha/);
  assert.match(document.getElementById('e_geral').textContent, /Escolha/);
  assert.match(document.getElementById('e_aplicacao').textContent, /aplicação/);
  assert.equal(document.getElementById('q_aplicacao').getAttribute('aria-invalid'), 'true');
});

test('Certificado: indicações precisam de 2 pessoas diferentes e da confirmação', async () => {
  const b = backend();
  const { window: w, document } = await loadPage('certificado.html', { fetch: b.fetch });
  await ate(w, 3);
  set(w, 'iNome0', 'João'); set(w, 'iTel0', '17981596797'); // o próprio número
  set(w, 'iNome1', 'Ana'); set(w, 'iTel1', '123');
  submit(w, 'fInd'); await settle(w);
  assert.equal(b.calls.length, 0);
  assert.match(document.getElementById('eiTel0').textContent, /seu número/);
  assert.match(document.getElementById('eiTel1').textContent, /DDD/);
  assert.match(document.getElementById('eiOk').textContent, /Confirme/);
});

test('Certificado: falha no envio não libera o certificado e permite tentar de novo', async () => {
  const b = backend({ ok: false });
  const { window: w, document } = await loadPage('certificado.html', { fetch: b.fetch });
  await ate(w, 3); indicar(w);
  submit(w, 'fInd'); await settle(w, 30);
  assert.ok(document.getElementById('fInd'));
  assert.equal(document.getElementById('enviar').textContent, 'Tentar de novo');
  assert.match(document.getElementById('status').textContent, /Não conseguimos enviar/);
});

test('Certificado: quem volta ao link vê o certificado de novo', async () => {
  const { document } = await loadPage('certificado.html', { storage: { 'certificado:FP01': { nome: 'Maria da Silva', codigo: 'FP01-XYZ789' } } });
  assert.match(document.getElementById('etapa').textContent, /FP01-XYZ789/);
});

test('Certificado: PDF gerado é um PDF válido de uma página', async () => {
  const { window: w } = await loadPage('certificado.html', { before: (win) => { win.TextEncoder = TextEncoder; } });
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const blob = w.CertificadoPDF(jpg, 10, 7);
  const txt = await new Promise((ok) => { const r = new w.FileReader(); r.onload = () => ok(r.result); r.readAsBinaryString(blob); });
  assert.ok(txt.startsWith('%PDF-1.4'));
  assert.match(txt, /\/Count 1/);
  const xref = Number(txt.match(/startxref\n(\d+)/)[1]);
  assert.ok(txt.slice(xref).startsWith('xref'), 'tabela xref no lugar certo');
});

test('Certificado: páginas sem problemas de acessibilidade (etapas 1 e 2)', async () => {
  const b = backend();
  const { window: w } = await loadPage('certificado.html', { fetch: b.fetch });
  const check = async () => {
    const { violations } = await runAxe(w);
    assert.deepEqual([...violations].map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`), []);
  };
  await check();
  await ate(w, 2);
  assert.ok(w.document.getElementById('fPesquisa'));
  await check();
});

test('Certificado: Apps Script trata o envio do certificado', () => {
  const gs = read('planilha/inscricoes.gs');
  assert.match(gs, /d\.tipo === 'certificado'/);
  for (const aba of ['Certificados', 'Avaliações', 'Indicações']) assert.ok(gs.includes(`'${aba}'`));
  assert.ok(gs.includes("'Aplicação que gostaria de criar'"));
});
