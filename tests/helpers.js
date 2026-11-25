// Utilitários dos testes: carregam as páginas num navegador simulado (jsdom),
// executando apenas os scripts locais do site com o conteúdo de data/site.json.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { after } = require('node:test');

// Páginas com relógio (setInterval) manteriam o processo vivo: fecha todas no fim do arquivo.
const abertas = [];
after(() => { for (const w of abertas) { try { w.close(); } catch (e) { /* já fechada */ } } });

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const siteData = () => JSON.parse(read('data/site.json'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const PUBLIC_PAGES = ['index.html', 'aula.html', 'privacidade.html', 'termos.html', 'reembolso.html', 'turma.html', 'turma-termos.html'];

// Aula sempre no futuro, para os testes não dependerem da data em que rodam (horário de Brasília).
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbTESTE_123-abc/exec';
function futureStart(days = 3) {
  const d = new Date(Date.now() + days * 86400000 - 3 * 3600000);
  return d.toISOString().slice(0, 11) + '20:30';
}
const ALL_PAGES = [...PUBLIC_PAGES, 'admin.html', 'turma-admin.html', 'certificado-turma1.html', 'certificado.html'];

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
  d.event = { ...d.event, enabled: true, start: futureStart(), formEndpoint: ENDPOINT };
  return Object.assign(d, overrides);
}

const tick = (w) => new Promise((r) => w.setTimeout(r, 0));
async function settle(w, n = 15) { for (let i = 0; i < n; i++) await tick(w); }

async function loadPage(file = 'index.html', { data = siteData(), storage = {}, fetch = null, query = '', before = null } = {}) {
  const dom = new JSDOM(read(file), {
    url: 'https://kenjisuzuki98.github.io/' + file + query,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  abertas.push(w);
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  w.fetch = fetch ? fetch(w, data) : async () => ({ ok: true, json: async () => clone(data) });
  if (before) before(w);
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

module.exports = { ENDPOINT, futureStart, ROOT, read, exists, siteData, fullData, clone, loadPage, settle, runAxe, key, PUBLIC_PAGES, ALL_PAGES };
