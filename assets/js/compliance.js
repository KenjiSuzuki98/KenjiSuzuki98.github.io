// Regras de conformidade usadas pelo site, pelo painel admin e pelos testes.
(function (root) {
  const digits = (s) => String(s || '').replace(/\D/g, '');

  function isValidCNPJ(value) {
    const d = digits(value);
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const calc = (len) => {
      const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }

  function formatCNPJ(value) {
    const d = digits(value);
    if (d.length !== 14) return String(value || '');
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  const isValidGaId = (id) => /^G-[A-Z0-9]{4,15}$/.test(String(id || ''));

  // Expressões que costumam configurar publicidade enganosa (CDC art. 37) quando não há prova.
  const RISKY = [
    /garantid[oa]s?/gi,
    /\b100\s?%/g,
    /\b[oa] melhor\b/gi,
    /\bfique rico\b|\benriquec\w*/gi,
    /\bsem (nenhum )?risco\b/gi,
    /\bn[úu]mero\s*1\b|\bn[º°o]\.?\s*1\b/gi,
    /\bresultados? (imediatos?|certos?)\b/gi,
    /\bdinheiro f[áa]cil\b/gi,
    /\baprova[çc][ãa]o certa\b/gi,
  ];

  function findRiskyClaims(text) {
    const found = [];
    for (const re of RISKY) for (const m of String(text || '').matchAll(re)) found.push(m[0]);
    return found;
  }

  const Compliance = { isValidCNPJ, formatCNPJ, isValidGaId, findRiskyClaims };
  if (typeof module === 'object' && module.exports) module.exports = Compliance;
  else root.Compliance = Compliance;
})(this);
