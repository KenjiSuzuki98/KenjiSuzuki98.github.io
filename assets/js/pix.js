// Gerador de "Pix Copia e Cola" (BR Code / EMV) estático, conforme manual do Banco Central.
window.Pix = (() => {
  const field = (id, value) => id + String(value.length).padStart(2, '0') + value;

  const clean = (s, max) =>
    String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 .,\-]/g, '')
      .replace(/\s+/g, ' ').trim()
      .slice(0, max);

  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Ajusta a chave ao formato exigido pelo Pix para cada tipo.
  function normalizeKey(key, type) {
    key = String(key || '').trim();
    const digits = key.replace(/\D/g, '');
    switch (type) {
      case 'cpf':
      case 'cnpj':
        return digits;
      case 'telefone':
        if (key.startsWith('+')) return '+' + digits;
        return '+' + (digits.length <= 11 ? '55' + digits : digits);
      case 'email':
        return key.toLowerCase();
      default:
        return key;
    }
  }

  function payload({ key, keyType, name, city, amount, description, txid }) {
    const k = normalizeKey(key, keyType);
    let account = field('00', 'br.gov.bcb.pix') + field('01', k);
    const desc = clean(description, 40);
    if (desc && account.length + 4 + desc.length <= 99) account += field('02', desc);

    let out =
      field('00', '01') +
      field('26', account) +
      field('52', '0000') +
      field('53', '986');
    const value = Number(amount);
    if (value > 0) out += field('54', value.toFixed(2));
    out +=
      field('58', 'BR') +
      field('59', clean(name, 25) || 'RECEBEDOR') +
      field('60', clean(city, 15) || 'BRASIL') +
      field('62', field('05', clean(txid, 25).replace(/[^A-Za-z0-9]/g, '') || '***')) +
      '6304';
    return out + crc16(out);
  }

  return { payload, normalizeKey };
})();
