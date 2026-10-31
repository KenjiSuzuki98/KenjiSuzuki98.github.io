// Itens 1, 2, 5, 7, 19 e 20: páginas legais, dados da empresa e leis aplicáveis.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exists, loadPage, fullData, PUBLIC_PAGES } = require('./helpers');

const LEGAL = {
  'privacidade.html': ['controlador', 'dados-coletados', 'finalidades', 'bases-legais', 'compartilhamento', 'cookies', 'retencao', 'direitos', 'exclusao', 'seguranca', 'alteracoes'],
  'termos.html': ['aceitacao', 'servicos', 'precos-pagamento', 'propriedade-intelectual', 'imagens', 'depoimentos', 'responsabilidades', 'leis-aplicaveis', 'foro'],
  'reembolso.html': ['arrependimento', 'cancelamento', 'produtos-digitais', 'como-solicitar', 'prazo-devolucao'],
};

for (const [file, sections] of Object.entries(LEGAL)) {
  test(`${file} existe e tem todas as seções obrigatórias`, async () => {
    assert.ok(exists(file), `${file} não existe`);
    const { document } = await loadPage(file, { data: fullData() });
    assert.equal(document.documentElement.lang, 'pt-BR');
    assert.equal(document.querySelectorAll('h1').length, 1);
    for (const id of sections) assert.ok(document.getElementById(id), `${file}: falta a seção #${id}`);
    assert.match(document.body.textContent, /Última atualização/);
  });
}

test('Política de Privacidade cita a LGPD e o canal para o titular exercer direitos', async () => {
  const { document } = await loadPage('privacidade.html', { data: fullData() });
  const text = document.body.textContent;
  assert.match(text, /13\.709/);
  assert.match(text, /Art\. 18|art\. 18/);
  assert.match(text, /contato@example\.com/);
  assert.match(text, /ANPD/);
});

test('Política de Privacidade lista todos os terceiros que podem receber dados', async () => {
  const { document } = await loadPage('privacidade.html', { data: fullData() });
  const text = document.getElementById('compartilhamento').textContent;
  for (const name of ['GitHub', 'WhatsApp', 'Pix', 'Google Analytics']) assert.match(text, new RegExp(name), `falta ${name}`);
});

test('Termos citam as leis aplicáveis e o foro do consumidor', async () => {
  const { document } = await loadPage('termos.html', { data: fullData() });
  const text = document.getElementById('leis-aplicaveis').textContent + document.getElementById('foro').textContent;
  for (const lei of ['13.709', '8.078', '7.962', '12.965', '13.146', '9.610']) assert.match(text, new RegExp(lei.replace('.', '\\.')), `falta a Lei ${lei}`);
  assert.match(text, /domicílio do consumidor/i);
});

test('Reembolso garante 7 dias de arrependimento (CDC art. 49) e usa os prazos configurados', async () => {
  const data = fullData();
  data.policies = { cancelHours: 48, refundDays: 5, updatedAt: '2026-10-31' };
  const { document } = await loadPage('reembolso.html', { data });
  const text = document.body.textContent;
  assert.match(text, /7 \(sete\) dias/);
  assert.match(text, /art\. 49/i);
  assert.match(document.getElementById('cancelamento').textContent, /48 horas/);
  assert.match(document.getElementById('prazo-devolucao').textContent, /5 dias/);
});

test('Páginas legais mostram nome empresarial, CNPJ formatado e endereço', async () => {
  for (const file of Object.keys(LEGAL)) {
    const { document } = await loadPage(file, { data: fullData() });
    const text = document.body.textContent;
    assert.match(text, /KENJI SUZUKI 12345678000195/, file);
    assert.match(text, /11\.222\.333\/0001-81/, file);
    assert.match(text, /São José do Rio Preto/, file);
  }
});

test('Todas as páginas públicas têm rodapé com links para as três políticas e dados da empresa', async () => {
  for (const file of PUBLIC_PAGES) {
    const { document } = await loadPage(file, { data: fullData() });
    const footer = document.querySelector('footer');
    assert.ok(footer, `${file} sem rodapé`);
    for (const href of ['privacidade.html', 'termos.html', 'reembolso.html']) {
      assert.ok(footer.querySelector(`a[href="${href}"]`), `${file}: rodapé sem link para ${href}`);
    }
    assert.match(footer.textContent, /CNPJ 11\.222\.333\/0001-81/, file);
    assert.match(footer.textContent, /KENJI SUZUKI 12345678000195/, file);
    assert.match(footer.textContent, /contato@example\.com/, file);
  }
});

test('Rodapé não mostra CNPJ vazio quando a empresa ainda não foi preenchida', async () => {
  const data = fullData();
  data.company = {};
  const { document } = await loadPage('index.html', { data });
  assert.doesNotMatch(document.querySelector('footer').textContent, /CNPJ\s*(·|$)/);
});

test('Exclusão de dados: privacidade oferece pedido pelo WhatsApp e por e-mail', async () => {
  const { document } = await loadPage('privacidade.html', { data: fullData() });
  const sec = document.getElementById('exclusao');
  const wa = sec.querySelector('a[href^="https://wa.me/"]');
  const mail = sec.querySelector('a[href^="mailto:contato@example.com"]');
  assert.ok(wa, 'falta link de pedido pelo WhatsApp');
  assert.match(decodeURIComponent(wa.href), /exclusão/i);
  assert.ok(mail, 'falta link de pedido por e-mail');
});

test('Exclusão de dados: botão apaga as preferências salvas neste navegador', async () => {
  const { window, document } = await loadPage('privacidade.html', {
    data: fullData(),
    storage: { 'cookie-consent': { analytics: true, date: '2026-10-31' } },
  });
  document.getElementById('clearLocalData').click();
  assert.equal(window.localStorage.getItem('cookie-consent'), null);
});
