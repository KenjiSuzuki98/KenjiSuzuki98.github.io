// Itens 11 a 15: auditoria de acessibilidade, textos alternativos, contraste,
// navegação por teclado e botões claros.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { read, loadPage, fullData, settle, runAxe, key, ALL_PAGES } = require('./helpers');

for (const file of ALL_PAGES) {
  test(`Auditoria automática (axe-core) sem violações: ${file}`, async () => {
    const { window } = await loadPage(file, { data: fullData() });
    const { violations } = await runAxe(window);
    const report = violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`).join('\n');
    assert.equal(violations.length, 0, report);
  });
}

test('Auditoria: modal do Pix aberto também passa no axe-core', async () => {
  const { window, document } = await loadPage('index.html', { data: fullData() });
  document.querySelector('[data-pay]').click();
  await settle(window);
  const { violations } = await runAxe(window);
  assert.equal(violations.length, 0, violations.map((v) => v.id).join(', '));
});

test('Estrutura: uma única h1 e títulos sem pular níveis', async () => {
  for (const file of ['index.html', 'privacidade.html', 'termos.html', 'reembolso.html']) {
    const { document } = await loadPage(file, { data: fullData() });
    const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
    assert.equal(levels.filter((l) => l === 1).length, 1, `${file}: deve ter uma h1`);
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, `${file}: pulou de h${levels[i - 1]} para h${levels[i]}`);
  }
});

test('Textos alternativos: toda imagem tem alt; imagens de conteúdo usam o texto do admin', async () => {
  const { document } = await loadPage('index.html', { data: fullData({ profile: { ...fullData().profile, photo: 'assets/uploads/foto.webp', photoAlt: 'Kenji sorrindo, de terno azul' } }) });
  for (const img of document.querySelectorAll('img')) assert.ok(img.hasAttribute('alt'), `imagem sem alt: ${img.src}`);
  assert.equal(document.querySelector('.portrait img').alt, 'Kenji sorrindo, de terno azul');
  assert.equal(document.querySelector('img[src="assets/uploads/x.jpg"]').alt, 'Capa do curso X');
});

test('Textos alternativos: sem alt definido, usa um texto descritivo padrão (nunca vazio)', async () => {
  const d = fullData();
  d.profile.photo = 'assets/uploads/foto.webp';
  delete d.profile.photoAlt;
  d.products[0].imageAlt = '';
  const { document } = await loadPage('index.html', { data: d });
  assert.equal(document.querySelector('.portrait img').alt, `Foto de ${d.profile.name}`);
  assert.equal(document.querySelector('img[src="assets/uploads/x.jpg"]').alt, 'Curso X');
});

// ---------- Contraste (WCAG 2.1 AA: 4,5:1 para texto normal) ----------
function luminance(hex) {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
const cssVars = () => Object.fromEntries([...read('assets/css/style.css').match(/:root\s*{([^}]+)}/)[1].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));

const PAIRS = [
  ['--text', '--bg'], ['--text', '--card'], ['--text', '--card-2'],
  ['--muted', '--bg'], ['--muted', '--bg-2'], ['--muted', '--card'], ['--muted', '--card-2'],
  ['--accent', '--bg'], ['--accent', '--card'],
  ['--accent-2', '--bg'], ['--accent-2', '--card'],
  ['--accent-ink', '--accent'], ['--wa-ink', '--wa'], ['--gold-ink', '--accent-2'],
  ['--pix', '--card'], ['--danger', '--card'], ['--success', '--card'], ['--warning', '--card'],
  ['--bg', '--text'],
];

test('Contraste: todas as combinações de cor do tema atingem 4,5:1 (WCAG AA)', () => {
  const v = cssVars();
  for (const [fg, bg] of PAIRS) {
    assert.ok(v[fg] && v[bg], `variável ausente: ${fg} ou ${bg}`);
    const r = ratio(v[fg], v[bg]);
    assert.ok(r >= 4.5, `${fg} (${v[fg]}) sobre ${bg} (${v[bg]}) = ${r.toFixed(2)}:1`);
  }
});

test('Contraste: CSS não usa cores fixas de texto fora das variáveis do tema', () => {
  for (const file of ['assets/css/style.css', 'assets/css/admin.css']) {
    const css = read(file).replace(/:root\s*{[^}]+}/, '');
    const fixed = css.match(/(^|[;{\s])color:\s*#[0-9a-fA-F]{3,6}/g) || [];
    assert.deepEqual(fixed, [], `${file}: use variáveis de cor`);
  }
});

// ---------- Teclado ----------
test('Teclado: primeiro item focável é o link "Pular para o conteúdo"', async () => {
  for (const file of ['index.html', 'privacidade.html', 'termos.html', 'reembolso.html']) {
    const { document } = await loadPage(file, { data: fullData() });
    const first = document.querySelector('a[href], button, input, select, textarea');
    assert.match(first.textContent, /Pular para o conteúdo/, file);
    const target = document.querySelector(first.getAttribute('href'));
    assert.ok(target, `${file}: destino do pulo não existe`);
    assert.equal(target.getAttribute('tabindex'), '-1', `${file}: destino precisa receber foco`);
  }
});

test('Teclado: foco sempre visível (estilo :focus-visible)', () => {
  assert.match(read('assets/css/style.css'), /:focus-visible\s*{[^}]*outline/);
});

test('Teclado: botão de menu informa se está aberto (aria-expanded)', async () => {
  const { document } = await loadPage('index.html', { data: fullData() });
  const btn = document.getElementById('menuBtn');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(btn.getAttribute('aria-controls'), 'menu');
  btn.click();
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
});

test('Teclado: filtros do portfólio indicam qual está ativo (aria-pressed)', async () => {
  const { document } = await loadPage('index.html', { data: fullData() });
  const filters = [...document.querySelectorAll('.filter')];
  assert.ok(filters.length >= 2);
  assert.equal(filters[0].getAttribute('aria-pressed'), 'true');
  filters[1].click();
  assert.equal(filters[0].getAttribute('aria-pressed'), 'false');
  assert.equal(filters[1].getAttribute('aria-pressed'), 'true');
});

test('Teclado: modal do Pix recebe o foco, prende o Tab, fecha com Esc e devolve o foco', async () => {
  const { window, document } = await loadPage('index.html', { data: fullData() });
  const trigger = document.querySelector('[data-pay]');
  trigger.focus();
  trigger.click();
  await settle(window);
  const modal = document.getElementById('pixModal');
  assert.ok(modal.contains(document.activeElement), 'foco deveria ir para dentro do modal');
  assert.ok(document.querySelector('main').inert || document.querySelector('main').hasAttribute('inert'), 'conteúdo atrás do modal deve ficar inerte');

  const focusables = [...modal.querySelectorAll('a[href], button, input')].filter((e) => !e.disabled);
  const last = focusables[focusables.length - 1];
  last.focus();
  key(window, last, 'Tab');
  assert.equal(document.activeElement, focusables[0], 'Tab no último item deve voltar ao primeiro');
  key(window, focusables[0], 'Tab', { shiftKey: true });
  assert.equal(document.activeElement, last, 'Shift+Tab no primeiro deve ir ao último');

  key(window, document.activeElement, 'Escape');
  assert.ok(modal.hidden, 'Esc deve fechar');
  assert.equal(document.activeElement, trigger, 'foco deve voltar ao botão que abriu');
  assert.ok(!document.querySelector('main').hasAttribute('inert'));
});

test('Teclado: no admin, os itens recolhíveis são botões com aria-expanded', async () => {
  const { window, document } = await loadPage('admin.html', { data: fullData() });
  document.getElementById('offlineBtn').click();
  await settle(window);
  document.querySelector('[data-tab="services"]').click();
  const toggle = document.querySelector('.item-toggle');
  assert.equal(toggle.tagName, 'BUTTON');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
});

// ---------- Botões claros ----------
const GENERIC = /^(clique aqui|aqui|saiba mais|ver mais|mais|dúvidas|ok|enviar|link)$/i;
const visibleName = (el) => (el.getAttribute('aria-label') || el.textContent).replace(/\(abre em nova aba\)/i, '').replace(/\s+/g, ' ').trim();

test('Botões claros: nenhum botão ou link com texto genérico', async () => {
  for (const file of ['index.html', 'privacidade.html', 'termos.html', 'reembolso.html']) {
    const { document } = await loadPage(file, { data: fullData() });
    for (const el of document.querySelectorAll('a[href], button')) {
      const name = visibleName(el);
      assert.ok(name.length > 0, `${file}: elemento sem nome: ${el.outerHTML.slice(0, 80)}`);
      assert.doesNotMatch(name, GENERIC, `${file}: texto genérico "${name}"`);
    }
  }
});

test('Botões claros: botão de pagamento diz o valor e a forma de pagamento', async () => {
  const { document } = await loadPage('index.html', { data: fullData() });
  const pay = document.querySelector('[data-pay="services:0"]');
  assert.match(pay.textContent.replace(/\s+/g, ' '), /Pagar R\$\s?250,00 via Pix/);
});
