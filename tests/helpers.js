// Utilitários dos testes: carregam as páginas num navegador simulado (jsdom),
// executando apenas os scripts locais do site com o conteúdo de data/site.json.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const siteData = () => JSON.parse(read('data/site.json'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const PUBLIC_PAGES = ['index.html', 'privacidade.html', 'termos.html', 'reembolso.html'];
const ALL_PAGES = [...PUBLIC_PAGES, 'admin.html'];

// Site de exemplo com todos os campos preenchidos, para testar a renderização.
function fullData(overrides = {}) {
  const d = clone(siteData());
  d.company = {
    legalName: 'KENJI SUZUKI 12345678000195',
    tradeName: 'Prof. Kenji Suzuki',
    cnpj: '11222333000181',
    address: 'Rua Exemplo, 100 - Centro, São José do Rio Preto - SP, 15000-000',
  };
  d.contact.email = 'contato@example.com';
  d.pix = { keyType: 'aleatoria', key: '123e4567-e12b-12d1-a456-426655440000', receiverName: 'Kenji Suzuki', city: 'Sao Paulo' };
  d.services[0].price = 250;
  d.services[0].buyable = true;
  d.products = [{ title: 'Curso X', icon: 'book', description: 'Desc', image: 'assets/uploads/x.jpg', imageAlt: 'Capa do curso X', imageCredit: 'Foto: Fulano / Unsplash', price: 97, priceNote: '', buyable: true, pixKeyType: '', pixKey: '' }];
  d.portfolio = [
    { title: 'Projeto A', category: 'Robótica', description: 'A', image: '', link: 'https://example.com/a', date: '2025' },
    { title: 'Projeto B', category: 'Palestras', description: 'B', image: '', link: '', date: '2024' },
  ];
  d.testimonials = [
    { name: 'Maria Autorizada', role: 'Aluna', text: 'Aprendi muito.', date: '2025-05', authorized: true },
    { name: 'João Sem Autorização', role: 'Aluno', text: 'Não pode aparecer.', date: '2025-06', authorized: false },
  ];
  return Object.assign(d, overrides);
}

const tick = (w) => new Promise((r) => w.setTimeout(r, 0));
async function settle(w, n = 15) { for (let i = 0; i < n; i++) await tick(w); }

async function loadPage(file = 'index.html', { data = siteData(), storage = {} } = {}) {
  const dom = new JSDOM(read(file), {
    url: 'https://kenjisuzuki98.github.io/' + file,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  w.fetch = async () => ({ ok: true, json: async () => clone(data) });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  for (const s of w.document.querySelectorAll('script[src]')) {
    const src = s.getAttribute('src');
    if (/^(https?:)?\/\//.test(src)) throw new Error(`${file} carrega script externo: ${src}`);
    w.eval(read(src.split('?')[0]));
  }
  await settle(w);
  return { window: w, document: w.document };
}

async function runAxe(w) {
  w.eval(read('node_modules/axe-core/axe.min.js'));
  // jsdom não calcula cores/layout: o contraste é verificado em accessibility.test.js.
  return w.axe.run(w.document, { rules: { 'color-contrast': { enabled: false } } });
}

const key = (w, el, k, opts = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

module.exports = { ROOT, read, exists, siteData, fullData, clone, loadPage, settle, runAxe, key, PUBLIC_PAGES, ALL_PAGES };
