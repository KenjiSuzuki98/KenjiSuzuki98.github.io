// Itens 3, 4, 6, 8, 9 e 10: cookies, formulários, coleta mínima, Google Analytics,
// scripts de rastreamento e integrações de terceiros.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { read, loadPage, fullData, settle, ALL_PAGES, PUBLIC_PAGES } = require('./helpers');

const GA = 'G-TESTE12345';
const withGa = () => { const d = fullData(); d.analytics = { gaId: GA }; return d; };
const gaScript = (doc) => doc.querySelector('script[src*="googletagmanager.com"]');

test('Coleta mínima: nenhuma página carrega scripts, fontes ou estilos de terceiros', () => {
  for (const file of ALL_PAGES) {
    const html = read(file);
    assert.doesNotMatch(html, /<script[^>]+src=["'](https?:)?\/\//i, `${file}: script externo`);
    assert.doesNotMatch(html, /<link[^>]+href=["'](https?:)?\/\/[^"']+["'][^>]*>/i, `${file}: link externo no <head>`);
  }
  for (const css of ['assets/css/style.css', 'assets/css/admin.css']) {
    assert.doesNotMatch(read(css), /url\(\s*["']?(https?:)?\/\//i, `${css}: recurso externo`);
    assert.doesNotMatch(read(css), /@import/i, `${css}: @import`);
  }
});

test('Scripts de rastreamento: todas as páginas têm Content-Security-Policy restritiva', () => {
  for (const file of ALL_PAGES) {
    const m = read(file).match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]+content="([^"]+)"/i);
    assert.ok(m, `${file}: sem CSP`);
    const csp = m[1];
    assert.match(csp, /default-src 'self'/, file);
    assert.match(csp, /object-src 'none'/, file);
    const scriptSrc = (csp.match(/script-src ([^;]+)/) || [])[1] || '';
    assert.doesNotMatch(scriptSrc, /unsafe-inline|unsafe-eval|\*/, `${file}: script-src permissivo`);
    assert.doesNotMatch(scriptSrc, /facebook|hotjar|doubleclick|tiktok|clarity/i, `${file}: rastreador não declarado`);
  }
});

test('Scripts de rastreamento: nenhum script inline nas páginas', () => {
  for (const file of ALL_PAGES) {
    assert.doesNotMatch(read(file), /<script(?![^>]*\bsrc=)[^>]*>/i, `${file}: script inline`);
  }
});

test('Cookies: sem Google Analytics configurado, não há banner nem rastreamento', async () => {
  const { document } = await loadPage('index.html', { data: fullData() });
  const banner = document.getElementById('cookieBanner');
  assert.ok(!banner || banner.hidden, 'banner não deveria aparecer');
  assert.equal(gaScript(document), null);
  assert.equal(document.cookie, '');
});

test('Cookies: com Analytics configurado, banner aparece e nada é carregado antes do consentimento', async () => {
  const { document } = await loadPage('index.html', { data: withGa() });
  const banner = document.getElementById('cookieBanner');
  assert.ok(banner && !banner.hidden, 'banner deveria aparecer');
  assert.equal(gaScript(document), null, 'GA não pode carregar antes do consentimento');
  assert.ok(banner.querySelector('a[href="privacidade.html#cookies"]'), 'banner sem link para a política');
});

test('Cookies: "Recusar" é tão fácil quanto "Aceitar" (mesmo destaque, mesma tela)', async () => {
  const { document } = await loadPage('index.html', { data: withGa() });
  const accept = document.getElementById('cookieAccept');
  const reject = document.getElementById('cookieReject');
  assert.ok(accept && reject);
  assert.equal(accept.className, reject.className, 'botões devem ter o mesmo estilo');
});

test('Cookies: recusar não carrega o GA e grava a escolha', async () => {
  const { window, document } = await loadPage('index.html', { data: withGa() });
  document.getElementById('cookieReject').click();
  await settle(window);
  assert.equal(gaScript(document), null);
  assert.equal(JSON.parse(window.localStorage.getItem('cookie-consent')).analytics, false);
  assert.ok(document.getElementById('cookieBanner').hidden);
});

test('Google Analytics: aceitar carrega o GA com o ID configurado, sem sinais de publicidade', async () => {
  const { window, document } = await loadPage('index.html', { data: withGa() });
  document.getElementById('cookieAccept').click();
  await settle(window);
  const s = gaScript(document);
  assert.ok(s, 'GA deveria carregar');
  assert.match(s.src, new RegExp(`id=${GA}$`));
  assert.equal(JSON.parse(window.localStorage.getItem('cookie-consent')).analytics, true);
  const config = [...window.dataLayer].find((args) => args[0] === 'config');
  assert.equal(config[1], GA);
  assert.equal(config[2].allow_google_signals, false);
  assert.equal(config[2].allow_ad_personalization_signals, false);
});

test('Google Analytics: consentimento já salvo carrega o GA sem mostrar o banner', async () => {
  const { document } = await loadPage('index.html', { data: withGa(), storage: { 'cookie-consent': { analytics: true, date: '2026-10-31' } } });
  assert.ok(gaScript(document));
  assert.ok(document.getElementById('cookieBanner').hidden);
});

test('Google Analytics: ID inválido nunca é carregado', async () => {
  const d = fullData();
  d.analytics = { gaId: 'G-1"><script>alert(1)</script>' };
  const { document } = await loadPage('index.html', { data: d, storage: { 'cookie-consent': { analytics: true } } });
  assert.equal(gaScript(document), null);
});

test('Cookies: o rodapé permite rever a escolha a qualquer momento', async () => {
  const { window, document } = await loadPage('index.html', { data: withGa(), storage: { 'cookie-consent': { analytics: false } } });
  assert.ok(document.getElementById('cookieBanner').hidden);
  document.getElementById('cookiePrefs').click();
  await settle(window);
  assert.ok(!document.getElementById('cookieBanner').hidden);
});

test('Integrações de terceiros: links externos não vazam a origem e avisam que abrem em nova aba', async () => {
  for (const file of PUBLIC_PAGES) {
    const { document } = await loadPage(file, { data: fullData() });
    for (const a of document.querySelectorAll('a[target="_blank"]')) {
      const rel = (a.getAttribute('rel') || '').split(/\s+/);
      assert.ok(rel.includes('noopener') && rel.includes('noreferrer'), `${file}: ${a.href} sem rel noopener noreferrer`);
      const name = (a.getAttribute('aria-label') || '') + a.textContent;
      assert.match(name, /nova aba/i, `${file}: ${a.href} não avisa que abre em nova aba`);
    }
  }
});

test('Formulários e LGPD: campo de nome no Pix é opcional, explicado e não é salvo', async () => {
  const { window, document } = await loadPage('index.html', { data: fullData() });
  document.querySelector('[data-pay]').click();
  await settle(window);
  const input = document.getElementById('buyerName');
  assert.equal(input.required, false);
  assert.match(input.labels[0].textContent, /opcional/i);
  const help = document.getElementById(input.getAttribute('aria-describedby'));
  assert.ok(help, 'campo sem texto de ajuda associado');
  assert.match(help.textContent, /não (fica )?salv/i);
  assert.ok(help.querySelector('a[href="privacidade.html"]'), 'ajuda sem link para a política');
  const before = window.localStorage.length;
  input.value = 'Maria';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(window.localStorage.length, before, 'nome não pode ser gravado no navegador');
  assert.equal(document.cookie, '');
});

test('Formulários e LGPD: nenhum formulário envia dados para fora do site', () => {
  for (const file of ALL_PAGES) assert.doesNotMatch(read(file), /<form[^>]+action=["']https?:/i, file);
});

test('Pix: antes de pagar, o cliente vê links para Termos e Política de Reembolso', async () => {
  const { window, document } = await loadPage('index.html', { data: fullData() });
  document.querySelector('[data-pay]').click();
  await settle(window);
  const body = document.getElementById('pixBody');
  assert.ok(body.querySelector('a[href="termos.html"]'));
  assert.ok(body.querySelector('a[href="reembolso.html"]'));
});
