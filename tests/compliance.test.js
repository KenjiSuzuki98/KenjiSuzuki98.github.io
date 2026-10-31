// Regras de validação usadas pelo site e pelo painel admin.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Compliance = require('../assets/js/compliance.js');

test('CNPJ: aceita CNPJ válido com ou sem máscara', () => {
  assert.equal(Compliance.isValidCNPJ('11.222.333/0001-81'), true);
  assert.equal(Compliance.isValidCNPJ('11222333000181'), true);
});

test('CNPJ: recusa dígito verificador errado, tamanho errado e dígitos repetidos', () => {
  assert.equal(Compliance.isValidCNPJ('11.222.333/0001-80'), false);
  assert.equal(Compliance.isValidCNPJ('1122233300018'), false);
  assert.equal(Compliance.isValidCNPJ('00000000000000'), false);
  assert.equal(Compliance.isValidCNPJ(''), false);
});

test('CNPJ: formata no padrão 00.000.000/0000-00', () => {
  assert.equal(Compliance.formatCNPJ('11222333000181'), '11.222.333/0001-81');
  assert.equal(Compliance.formatCNPJ(''), '');
});

test('Google Analytics: só aceita ID no formato G-XXXXXXX', () => {
  assert.equal(Compliance.isValidGaId('G-ABC123XYZ9'), true);
  assert.equal(Compliance.isValidGaId(''), false);
  assert.equal(Compliance.isValidGaId('UA-12345-1'), false);
  assert.equal(Compliance.isValidGaId('G-1"><script>'), false);
});

test('Promessas: aponta frases de resultado garantido ou superlativo', () => {
  const risky = [
    'Resultado garantido em 30 dias',
    'Aprovação 100% certa',
    'O melhor professor do Brasil',
    'Fique rico com IA',
    'Sem risco nenhum',
    'Número 1 em robótica',
  ];
  for (const t of risky) assert.ok(Compliance.findRiskyClaims(t).length > 0, `deveria apontar: ${t}`);
});

test('Promessas: não aponta textos descritivos normais', () => {
  const ok = [
    'Mentoria personalizada para sua carreira em tecnologia.',
    'Aulas de eletrônica do básico ao avançado.',
    'Treinamentos para empresas sob consulta.',
  ];
  for (const t of ok) assert.deepEqual(Compliance.findRiskyClaims(t), [], `não deveria apontar: ${t}`);
});
