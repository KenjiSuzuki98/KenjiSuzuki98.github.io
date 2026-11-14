// Aula gratuita: banner na página inicial, inscrição (aula.html), coleta mínima e grupo do WhatsApp.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, fullData, settle, runAxe, read, siteData, ENDPOINT } = require('./helpers');

const GROUP = 'https://chat.whatsapp.com/IT56JC7tO3NJTIhEoQNTlq';
const withEvent = (patch = {}) => { const d = fullData(); d.event = { ...d.event, whatsappGroup: GROUP, ...patch }; return d; };
const pastStart = () => new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 11) + '20:30';

function fill(window, document, { nome = 'Maria da Silva', cel = '17981596797', email = 'maria@example.com', consent = true, offers = false } = {}) {
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  set('fNome', nome); set('fCel', cel); set('fEmail', email);
  document.getElementById('fConsent').checked = consent;
  document.getElementById('fOffers').checked = offers;
}
const submit = (window, document) => document.getElementById('aulaForm').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

function mockEndpoint(window, response = { ok: true }) {
  const calls = [];
  const original = window.fetch;
  window.fetch = async (url, opts) => {
    if (String(url).startsWith('https://script.google.com')) { calls.push({ url, opts }); return { ok: true, json: async () => response }; }
    return original(url, opts);
  };
  return calls;
}
const report = (violations) => violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');

test('Banner: aparece na página inicial e leva para o cadastro da aula', async () => {
  const { document } = await loadPage('index.html', { data: withEvent() });
  const banner = document.getElementById('aula');
  assert.ok(banner, 'banner da aula deveria aparecer');
  assert.match(banner.textContent, /Inteligência Artificial aplicada ao Negócio/);
  assert.match(banner.textContent, /20h30/);
  assert.ok(banner.querySelector('a[href="aula.html"]'), 'banner sem link para aula.html');
  assert.ok(banner.querySelector('img[src="assets/uploads/aula-ia.svg"]'), 'banner sem imagem');
  assert.equal(document.querySelector('[data-event-link]').hidden, false, 'link "Aula grátis" no menu');
});

test('Banner: some quando a aula já passou ou está desligada', async () => {
  for (const patch of [{ start: pastStart() }, { enabled: false }]) {
    const { document } = await loadPage('index.html', { data: withEvent(patch) });
    assert.equal(document.getElementById('aula'), null);
    assert.equal(document.querySelector('[data-event-link]').hidden, true);
  }
});

test('Banner: imagem existe e a aula publicada é 17/11 às 20h30 (Brasília)', () => {
  const ev = siteData().event;
  assert.ok(read(ev.image).includes('<svg'));
  assert.equal(ev.start, '2026-11-17T20:30');
  assert.equal(ev.whatsappGroup, GROUP);
});

test('Inscrição: coleta só nome, celular e e-mail (coleta mínima)', async () => {
  const { document } = await loadPage('aula.html', { data: withEvent() });
  const form = document.getElementById('aulaForm');
  assert.ok(form);
  const names = [...form.querySelectorAll('input')].map((i) => i.name).sort();
  assert.deepEqual(names, ['celular', 'consentimento', 'email', 'nome', 'ofertas', 'website']);
  assert.doesNotMatch(form.textContent, /\bCPF\b|endereço|nascimento|sexo/i);
  for (const id of ['fNome', 'fCel', 'fEmail']) assert.equal(document.getElementById(id).required, true, id);
});

test('Inscrição: finalidade explicada, consentimento obrigatório e ofertas opcionais (nada pré-marcado)', async () => {
  const { document } = await loadPage('aula.html', { data: withEvent() });
  const use = document.getElementById('dataUse');
  assert.match(use.textContent, /ofertas e promoções/);
  assert.ok(use.querySelector('a[href^="privacidade.html"]'));
  const consent = document.getElementById('fConsent');
  const offers = document.getElementById('fOffers');
  assert.equal(consent.checked, false);
  assert.equal(consent.required, true);
  assert.equal(offers.checked, false);
  assert.equal(offers.required, false);
  assert.match(offers.closest('label').textContent, /opcional/i);
});

test('Inscrição: sem consentimento ou com dados inválidos, nada é enviado', async () => {
  const { window, document } = await loadPage('aula.html', { data: withEvent() });
  const calls = mockEndpoint(window);
  fill(window, document, { consent: false });
  submit(window, document);
  await settle(window);
  fill(window, document, { cel: '1234', email: 'sem-arroba' });
  submit(window, document);
  await settle(window);
  assert.equal(calls.length, 0);
  assert.equal(document.getElementById('fCel').getAttribute('aria-invalid'), 'true');
  assert.match(document.getElementById('eEmail').textContent, /e-mail válido/);
});

test('Inscrição: envia para a planilha e mostra o grupo do WhatsApp com QR Code', async () => {
  const { window, document } = await loadPage('aula.html', { data: withEvent() });
  const calls = mockEndpoint(window);
  const before = window.localStorage.length;
  fill(window, document, { offers: true });
  submit(window, document);
  await settle(window);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENDPOINT);
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.nome, 'Maria da Silva');
  assert.equal(body.celular, '5517981596797');
  assert.equal(body.email, 'maria@example.com');
  assert.equal(body.consentimento, true);
  assert.equal(body.ofertas, true);
  assert.deepEqual(Object.keys(body).sort(), ['celular', 'consentimento', 'email', 'evento', 'nome', 'ofertas', 'website']);
  assert.equal(window.localStorage.length, before, 'dados não podem ficar no navegador');

  const card = document.getElementById('aulaCard');
  assert.match(card.textContent, /Inscrição confirmada/);
  assert.match(card.textContent, /por este grupo do WhatsApp/);
  assert.match(card.textContent, /20h30/);
  const link = document.getElementById('groupLink');
  assert.equal(link.getAttribute('href'), GROUP);
  assert.match(link.getAttribute('rel'), /noopener/);
  assert.ok(card.querySelector('.qr-group svg'), 'QR Code do grupo');
  assert.match(document.getElementById('icsLink').getAttribute('href'), /^data:text\/calendar/);
  assert.equal(document.activeElement.id, 'successTitle', 'foco vai para a confirmação');
});

test('Inscrição: se a planilha falhar, avisa e permite tentar de novo', async () => {
  const { window, document } = await loadPage('aula.html', { data: withEvent() });
  mockEndpoint(window, { ok: false });
  fill(window, document);
  submit(window, document);
  await settle(window);
  assert.ok(document.getElementById('aulaForm'), 'formulário continua na tela');
  assert.match(document.getElementById('formStatus').textContent, /tente de novo/);
  assert.equal(document.getElementById('submitBtn').disabled, false);
});

test('Inscrição: robô que preenche o campo escondido não é enviado', async () => {
  const { window, document } = await loadPage('aula.html', { data: withEvent() });
  const calls = mockEndpoint(window);
  fill(window, document);
  document.getElementById('fSite').value = 'http://spam.example';
  submit(window, document);
  await settle(window);
  assert.equal(calls.length, 0);
});

test('Inscrição: endereço da planilha inválido nunca recebe dados (mostra só o grupo)', async () => {
  for (const formEndpoint of ['', 'https://evil.example.com/exec', 'javascript:alert(1)']) {
    const { document } = await loadPage('aula.html', { data: withEvent({ formEndpoint }) });
    assert.equal(document.getElementById('aulaForm'), null, formEndpoint);
    assert.equal(document.getElementById('groupLink').getAttribute('href'), GROUP);
  }
});

test('Inscrição: link de grupo que não é do WhatsApp é ignorado', async () => {
  const { document } = await loadPage('aula.html', { data: withEvent({ formEndpoint: '', whatsappGroup: 'https://evil.example.com/chat' }) });
  assert.equal(document.getElementById('groupLink'), null);
});

test('Inscrição: aula encerrada mostra aviso e não coleta dados', async () => {
  const { document } = await loadPage('aula.html', { data: withEvent({ start: pastStart() }) });
  assert.equal(document.getElementById('aulaForm'), null);
  assert.match(document.querySelector('h1').textContent, /encerradas/);
});

test('Inscrição: a página só envia dados para o Google Apps Script (CSP)', () => {
  const csp = read('aula.html').match(/Content-Security-Policy" content="([^"]+)"/)[1];
  const connect = csp.match(/connect-src ([^;]+)/)[1];
  assert.match(connect, /https:\/\/script\.google\.com/);
  for (const src of connect.trim().split(/\s+/)) {
    assert.match(src, /^('self'|https:\/\/(script\.google\.com|script\.googleusercontent\.com|\*\.google-analytics\.com|\*\.analytics\.google\.com|www\.googletagmanager\.com))$/, src);
  }
});

test('Acessibilidade: página de inscrição com erros e com confirmação passa no axe-core', async () => {
  const { window, document } = await loadPage('aula.html', { data: withEvent() });
  submit(window, document);
  await settle(window);
  let { violations } = await runAxe(window);
  assert.equal(violations.length, 0, report(violations));
  mockEndpoint(window);
  fill(window, document);
  submit(window, document);
  await settle(window);
  ({ violations } = await runAxe(window));
  assert.equal(violations.length, 0, report(violations));
});

test('Política de Privacidade explica a inscrição, a planilha do Google e as ofertas', async () => {
  const { document } = await loadPage('privacidade.html', { data: fullData() });
  assert.ok(document.getElementById('inscricoes'));
  assert.match(document.getElementById('compartilhamento').textContent, /Planilhas Google/);
  assert.match(document.getElementById('finalidades').textContent, /ofertas e promoções/);
  assert.match(document.getElementById('retencao').textContent, /Inscrições em aulas/);
});
