// Turma 1: mensagens (T7), textos legais (T8), certificado (T10) e regras de comunicação (seção 6).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { read, exists, loadPage, fullData, ROOT } = require('./helpers');
const { createGas } = require('./turma-gas');
const Compliance = require('../assets/js/compliance.js');

const N = createGas().ctx;
const MENSAGENS = ['lembrete-live', 'pos-live', 'follow-up', 'confirmacao-pagamento', 'fila-espera', 'reserva-expirada',
  'reembolso', 'ultima-chamada', 'vespera', 'pos-treinamento'];
const FERRAMENTAS = /\b(Gemini|Claude|Copilot|Perplexity|Canva|CapCut|Gamma|Manus|Midjourney|Leonardo|ElevenLabs|HeyGen|Suno|Runway|Kling|DeepSeek|Grok|NotebookLM|Lovable|Zapier|n8n|Sora|Veo)\b/i;
const GRUPO_REAL = /chat\.whatsapp\.com\/DaYgeD2/;

test('Mensagens: todos os modelos existem, com campos para preencher e sem regras quebradas', () => {
  for (const m of MENSAGENS) {
    const f = `mensagens/${m}.md`;
    assert.ok(exists(f), `falta ${f}`);
    const s = read(f);
    assert.match(s, /\[[A-ZÇÃÉÍÓÚÂÊ0-9 /()]+\]/, `${f}: sem campos [PARA PREENCHER]`);
    assert.doesNotMatch(s, /\b14\b/, `${f}: cita 14`);
    assert.doesNotMatch(s, FERRAMENTAS, `${f}: cita ferramenta do Módulo 2`);
    assert.doesNotMatch(s, GRUPO_REAL, `${f}: link real do grupo no repositório público`);
    assert.doesNotMatch(s, /Mercado Fran[çc]a/i, f);
    assert.deepEqual(Compliance.findRiskyClaims(s), [], `${f}: promessa de resultado`);
  }
});

test('Mensagens: confirmação do Pix tem convite do grupo, endereço, horário, celular, power bank, conta Google e recibo', () => {
  const s = read('mensagens/confirmacao-pagamento.md');
  for (const t of ['[LINK DO GRUPO TURMA 01]', 'Avenida 19, nº 2306', '19h50', '20h30', 'power bank', 'conta Google', 'recibo']) assert.ok(s.includes(t), t);
});

test('Mensagens: reembolso de 7 dias, integral via Pix, mesmo depois de participar de uma noite', () => {
  const s = read('mensagens/reembolso.md');
  assert.match(s, /7 dias/);
  assert.match(s, /integral/);
  assert.match(s, /Pix/);
  assert.match(s, /mesmo depois de participar/);
});

test('Mensagens: pós-live avisa que a promoção acabou e mantém "vagas limitadas"', () => {
  const s = read('mensagens/pos-live.md') + read('mensagens/follow-up.md');
  assert.match(s, /preço de tabela/i);
  assert.match(s, /vagas limitadas/i);
});

test('Retenção da vaga: todos os textos dizem 5 minutos (nenhum fala em 30)', () => {
  const arquivos = ['turma.html', 'turma-termos.html', 'assets/js/turma-admin.js', 'assets/js/turma.js', 'mensagens/fila-espera.md', 'mensagens/reserva-expirada.md', 'docs/turma1-instalacao.md', 'docs/turma1-ensaio.md'];
  const todos = arquivos.map((f) => [f, read(f)]);
  for (const [f, s] of todos) assert.doesNotMatch(s, /30 ?min/i, `${f} ainda fala em 30 minutos`);
  for (const f of ['turma.html', 'turma-termos.html', 'mensagens/fila-espera.md']) assert.match(read(f), /5 minutos/, `${f} deveria dizer 5 minutos`);
});

test('Termos da Turma 1: regras, reembolso, A1, A2 e A3 com prazos ainda a definir bem visíveis', async () => {
  const { document } = await loadPage('turma-termos.html', { data: fullData() });
  for (const id of ['regras', 'pagamento', 'reembolso', 'responsavel', 'imagem', 'privacidade']) assert.ok(document.getElementById(id), `falta #${id}`);
  const t = document.body.textContent.replace(/\s+/g, ' ');
  assert.match(t, /Ao efetuar o pagamento, confirmo que o responsável legal/);
  assert.match(t, /Autorizo, de forma gratuita, o uso da minha imagem e voz/);
  assert.match(t, /\[PRAZO A DEFINIR\]/);
  assert.match(t, /13\.709/);
  assert.match(t, /Última atualização/);
  assert.match(read('turma-termos.html'), /REVISAR COM ADVOGADO/);
  assert.equal(document.querySelectorAll('h1').length, 1);
});

test('Formulário liga as declarações aos textos completos', async () => {
  assert.match(read('turma.html') + read('assets/js/turma.js'), /turma-termos\.html#imagem/);
  assert.match(read('assets/js/turma.js'), /turma-termos\.html#privacidade/);
  assert.match(read('assets/js/turma.js'), /turma-termos\.html#responsavel/);
});

test('Certificado: Kenji Marcos Suzuki, 6h, 3 módulos, sem logos de terceiros', async () => {
  const { document } = await loadPage('certificado-turma1.html', { data: fullData() });
  const t = document.body.textContent.replace(/\s+/g, ' ');
  assert.match(t, /Kenji Marcos Suzuki/);
  assert.match(t, /carga horária de 6 horas/i);
  for (const n of N.TURMA.noites) assert.ok(t.includes(n.modulo), n.modulo);
  assert.match(t, /Do Zero ao Faixa Preta com Inteligência Artificial/);
  assert.doesNotMatch(read('certificado-turma1.html'), /Sebrae|Mercado Fran[çc]a|logo-/i);
  assert.ok(document.getElementById('nomeAluno'));
  assert.match(read('certificado-turma1.html'), /noindex/);
});

test('Nenhum dado pessoal no repositório (nenhum CPF válido fora dos testes) e senha/grupo fora do código', () => {
  const pular = new Set(['node_modules', '.git', 'tests', '.claude']);
  const achados = [];
  (function andar(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (pular.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { andar(p); continue; }
      if (!/\.(html|js|json|md|gs|csv|txt)$/.test(e.name)) continue;
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/(?<![\d-])(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?![\d-])/g)) {
        if (N.validarCPF_(m[1]) && m[1].replace(/\D/g, '') !== '00000000191') achados.push(`${path.relative(ROOT, p)}: ${m[1]}`);
      }
      if (GRUPO_REAL.test(s)) achados.push(`${path.relative(ROOT, p)}: link do grupo Turma 01`);
    }
  })(ROOT);
  assert.deepEqual(achados, []);
  assert.doesNotMatch(read('planilha/turma/Api.gs'), /ADMIN_SENHA\s*[:=]\s*['"]/);
});
