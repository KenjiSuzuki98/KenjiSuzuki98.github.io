// Simula o Google Apps Script (planilha, propriedades, cache, trava) para testar
// o backend da Turma 1 sem precisar do Google. Carrega o mesmo código que vai para o Apps Script.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const NUCLEO = 'assets/js/turma-nucleo.js';
const API = 'planilha/turma/Api.gs';

function fakeSheet(name) {
  const rows = [];
  const sheet = {
    name, rows,
    getName: () => name,
    getLastRow: () => rows.length,
    getLastColumn: () => (rows[0] ? rows[0].length : 0),
    getMaxRows: () => 1000,
    setFrozenRows() {},
    appendRow(r) { rows.push(r.map((v) => String(v))); },
    deleteRow(i) { rows.splice(i - 1, 1); },
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = rows[r - 1 + i] || [];
            out.push(Array.from({ length: nc }, (_, j) => (row[c - 1 + j] ?? '')));
          }
          return out;
        },
        setValues(v) {
          v.forEach((vals, i) => {
            const row = rows[r - 1 + i] || (rows[r - 1 + i] = []);
            vals.forEach((val, j) => { row[c - 1 + j] = String(val); });
          });
          return this;
        },
        setNumberFormat() { return this; },
        setFontWeight() { return this; },
      };
    },
    getDataRange() { return sheet.getRange(1, 1, rows.length, sheet.getLastColumn()); },
  };
  return sheet;
}

// standalone: script separado (não ligado à planilha), que abre a planilha pelo ID.
function createGas({ props = {}, now = Date.parse('2026-11-17T21:00:00-03:00'), standalone = false } = {}) {
  const sheets = {};
  const store = { ADMIN_SENHA: 'senha-forte-de-teste-123', GRUPO_TURMA: 'https://chat.whatsapp.com/GrupoTesteTurma01', ...props };
  const cache = {};
  const clock = { ms: now };
  const abertasPorId = [];
  const planilha = { getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = fakeSheet(n)) };
  const ctx = vm.createContext({
    console,
    JSON,
    Math,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (standalone ? null : planilha),
      openById: (id) => { abertasPorId.push(id); return planilha; },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in store ? store[k] : null),
        setProperty: (k, v) => { store[k] = String(v); },
        deleteProperty: (k) => { delete store[k]; },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = String(v); },
        remove: (k) => { delete cache[k]; },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }),
    },
    Utilities: { getUuid: () => crypto.randomUUID() },
    __clock: clock,
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, NUCLEO), 'utf8'), ctx, { filename: NUCLEO });
  vm.runInContext(fs.readFileSync(path.join(ROOT, API), 'utf8'), ctx, { filename: API });
  vm.runInContext('Date.now = function () { return __clock.ms; };', ctx);

  const parse = (out) => JSON.parse(out.getContent());
  const gas = {
    ctx, sheets, store, cache, clock, abertasPorId,
    get: (params = {}) => parse(ctx.doGet({ parameter: params })),
    post: (body) => parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } })),
    at(iso) { clock.ms = Date.parse(iso); return gas; },
    advance(min) { clock.ms += min * 60000; return gas; },
    login(senha = store.ADMIN_SENHA) { return gas.post({ acao: 'login', senha }).token; },
    admin(token, op, extra = {}) { return gas.post({ acao: 'admin', token, op, ...extra }); },
    rows: () => (sheets.Reservas ? sheets.Reservas.rows : []),
  };
  return gas;
}

// CPFs válidos (gerados só para teste).
const CPFS = ['52998224725', '11144477735', '39053344705', '15350946056', '86288366757', '71428793860', '87748248800', '28528386210', '64465419961', '57672025678', '27449165791', '38333623409', '36490074605', '07569457803', '21501735810', '90624526470', '69695933122', '64880779024', '14436205800', '05518724543', '62565064489', '60969526237', '23410149414', '59236169805', '67634280739', '71478010169', '51585403733'];

let cpfIdx = 0;
function pessoa(over = {}) {
  return {
    nome: 'Maria Teste da Silva',
    sexo: 'F',
    celular: '17981596797',
    email: 'maria@example.com',
    endereco: 'Rua Vinte, 100, Centro, Barretos/SP',
    cep: '14780000',
    cpf: CPFS[cpfIdx++ % CPFS.length],
    nascimento: '1990-05-10',
    ...over,
  };
}
const responsavel = (over = {}) => ({ nome: 'Joana Responsável', cpf: '00000000191', celular: '17999990000', email: 'joana@example.com', parentesco: 'Mãe', ...over });

function inscricao({ combo = true, avulsos = [], extra = false, titular = {}, pessoaExtra = null, consent = {} } = {}) {
  const body = {
    acao: 'inscrever',
    pedido: { combo, avulsos, extra },
    titular: pessoa(titular),
    consentimentos: { privacidade: true, imagem: true, responsavel: true, ...consent },
    website: '',
  };
  if (extra) body.extra = pessoa({ nome: 'José Extra Teste', parentesco: 'conjuge', ...(pessoaExtra || {}) });
  return body;
}

module.exports = { createGas, pessoa, responsavel, inscricao, CPFS };
