// Itens 16, 17, 18 e 19: depoimentos reais, promessas comprováveis,
// direitos das imagens e dados da empresa.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Compliance = require('../assets/js/compliance.js');
const { read, siteData, loadPage, fullData, settle } = require('./helpers');

function allStrings(obj, out = []) {
  if (typeof obj === 'string') out.push(obj);
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => allStrings(v, out));
  return out;
}

test('Depoimentos reais: só aparecem os autorizados pelo autor', async () => {
  const { document } = await loadPage('index.html', { data: fullData() });
  const sec = document.getElementById('depoimentos');
  assert.ok(sec, 'seção de depoimentos deveria existir');
  assert.match(sec.textContent, /Maria Autorizada/);
  assert.doesNotMatch(sec.textContent, /João Sem Autorização/);
});

test('Depoimentos reais: sem depoimentos autorizados, a seção não aparece', async () => {
  const d = fullData();
  d.testimonials = d.testimonials.map((t) => ({ ...t, authorized: false }));
  const { document } = await loadPage('index.html', { data: d });
  assert.equal(document.getElementById('depoimentos'), null);
});

test('Depoimentos reais: o site publicado não contém depoimentos sem autorização', () => {
  for (const t of siteData().testimonials || []) {
    assert.equal(t.authorized, true, `depoimento de "${t.name}" sem autorização registrada`);
    assert.ok(t.name && t.date, 'depoimento precisa de nome e data');
  }
});

test('Depoimentos reais: cada depoimento mostra nome e data', async () => {
  const { document } = await loadPage('index.html', { data: fullData() });
  const card = document.querySelector('#depoimentos blockquote').closest('figure');
  assert.match(card.textContent, /Maria Autorizada/);
  assert.match(card.textContent, /2025/);
});

test('Promessas comprováveis: o conteúdo publicado não tem promessas de resultado', () => {
  const risky = allStrings(siteData()).flatMap((s) => Compliance.findRiskyClaims(s).map((m) => `"${m}" em: ${s}`));
  assert.deepEqual(risky, []);
});

test('Promessas comprováveis: páginas e scripts não têm promessas fixas no código', () => {
  for (const f of ['index.html', 'privacidade.html', 'termos.html', 'reembolso.html', 'assets/js/app.js']) {
    const text = read(f).replace(/<[^>]+>/g, ' ');
    assert.deepEqual(Compliance.findRiskyClaims(text), [], f);
  }
});

test('Promessas comprováveis: números de destaque precisam de fonte para aparecer', async () => {
  const d = fullData();
  d.stats = [
    { value: '+300', label: 'alunos', source: 'Certificados emitidos 2019–2025' },
    { value: '+999', label: 'inventados', source: '' },
  ];
  const { document } = await loadPage('index.html', { data: d });
  const stats = document.querySelector('.stats');
  assert.match(stats.textContent, /\+300/);
  assert.doesNotMatch(stats.textContent, /\+999/);
  assert.match(stats.querySelector('[title], .stat-source').getAttribute('title') || stats.textContent, /Certificados/);
});

test('Direitos das imagens: crédito da imagem aparece junto da imagem', async () => {
  const { document } = await loadPage('index.html', { data: fullData() });
  const img = document.querySelector('img[src="assets/uploads/x.jpg"]');
  const figure = img.closest('figure');
  assert.ok(figure, 'imagem com crédito deve estar num <figure>');
  assert.match(figure.querySelector('figcaption').textContent, /Fulano \/ Unsplash/);
});

test('Dados da empresa: modal do Pix identifica o recebedor e o CNPJ', async () => {
  const { window, document } = await loadPage('index.html', { data: fullData() });
  document.querySelector('[data-pay]').click();
  await settle(window);
  assert.match(document.getElementById('pixBody').textContent, /11\.222\.333\/0001-81/);
});

test('Admin: avisa quando o CNPJ é inválido e quando há promessa arriscada', async () => {
  const { window, document } = await loadPage('admin.html', { data: fullData() });
  document.getElementById('offlineBtn').click();
  await settle(window);
  document.querySelector('[data-tab="empresa"]').click();
  const cnpj = document.querySelector('[data-field="company.cnpj"] input');
  cnpj.value = '11.222.333/0001-80';
  cnpj.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(document.querySelector('[data-field="company.cnpj"] .warn').textContent, /CNPJ inválido/);

  document.querySelector('[data-tab="perfil"]').click();
  const tagline = document.querySelector('[data-field="profile.tagline"] textarea');
  tagline.value = 'Resultado garantido!';
  tagline.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(document.querySelector('[data-field="profile.tagline"] .warn').textContent, /garantid/i);
});

test('Admin: depoimento só pode ser publicado com a confirmação de autorização', async () => {
  const { window, document } = await loadPage('admin.html', { data: fullData() });
  document.getElementById('offlineBtn').click();
  await settle(window);
  document.querySelector('[data-tab="testimonials"]').click();
  const panel = document.getElementById('panel');
  assert.match(panel.textContent, /autoriza/i);
  assert.ok(panel.querySelector('input[type="checkbox"]'), 'falta a caixa de autorização');
});
