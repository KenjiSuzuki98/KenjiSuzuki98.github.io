/**
 * Turma 1 · Servidor das inscrições (Google Apps Script + Planilha Google).
 *
 * O projeto do Apps Script tem DOIS arquivos:
 *   - "Nucleo": cole o conteúdo de assets/js/turma-nucleo.js (regras e preços);
 *   - "Api":    cole este arquivo.
 * O passo a passo completo está em docs/turma1-instalacao.md.
 *
 * Propriedades do script (Configurações do projeto → Propriedades do script):
 *   ADMIN_SENHA  senha do painel (mínimo 10 caracteres; use 16 ou mais)
 *   GRUPO_TURMA  link do grupo fechado "Turma 01" (só aparece no painel)
 *   PLANILHA_ID  (opcional) ID da planilha a usar quando o script é separado da planilha
 * Nada disso fica no código, porque o repositório do site é público.
 *
 * Depois de mudar o código: Implantar → Gerenciar implantações → lápis
 * → Versão: "Nova versão" → Implantar. Assim a URL /exec continua a mesma.
 */

var ABA_RESERVAS = 'Reservas';
var COLUNAS = ['Código', 'Status', 'Criado em', 'Expira em', 'Pago em', 'Vale R$ 10', 'Tipo', 'Noites', 'Pessoas', 'Total',
  'Titular nome', 'Titular celular', 'Titular e-mail', 'Titular CPF', 'Titular menor',
  'Extra nome', 'Extra CPF', 'Extra parentesco', 'Promo A', 'Promo B', 'Dados (não editar)'];
var COL_DADOS = COLUNAS.length - 1;
var ATIVOS = ['pendente', 'pago', 'fila'];
var MAX_FALHAS_LOGIN = 10;

// ---------- Entrada ----------
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var agora = Date.now();
    if (p.action === 'reserva') return resposta_(consultaPublica_(String(p.codigo || ''), agora));
    return resposta_(estadoPublico_(agora));
  } catch (err) {
    return resposta_({ ok: false, erro: 'erro_interno' });
  }
}

function doPost(e) {
  var d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return resposta_({ ok: false, erro: 'json_invalido' }); }
  if (d.acao === 'inscrever' && d.website) return resposta_({ ok: false, erro: 'invalido' }); // robô
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (d.acao === 'inscrever') return resposta_(inscrever_(d, Date.now()));
    if (d.acao === 'login') return resposta_(login_(d));
    if (d.acao === 'admin') return resposta_(admin_(d, Date.now()));
    return resposta_({ ok: false, erro: 'acao_invalida' });
  } catch (err) {
    var conhecido = err && err.message === 'planilha_nao_configurada';
    return resposta_({ ok: false, erro: conhecido ? 'planilha_nao_configurada' : 'erro_interno' });
  } finally {
    lock.releaseLock();
  }
}

function resposta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Configuração (propriedades do script) ----------
function props_() { return PropertiesService.getScriptProperties(); }

function config_() {
  var p = props_();
  return {
    promoAAte: Number(p.getProperty('PROMO_A_ATE') || 0),
    promoBAte: Number(p.getProperty('PROMO_B_ATE') || 0),
    vendasAbertas: p.getProperty('VENDAS_ABERTAS') !== '0',
    imagemObrigatoria: p.getProperty('IMAGEM_OBRIGATORIA') !== '0',
  };
}

function promoEstado_(cfg, agora) {
  var a = promoAtiva_(cfg.promoAAte, agora), b = promoAtiva_(cfg.promoBAte, agora);
  return {
    promoA: { ativa: a, ate: a ? cfg.promoAAte : 0 },
    promoB: { ativa: b, ate: b ? cfg.promoBAte : 0 },
    precos: precosVigentes_({ promoA: a, promoB: b }),
  };
}

function vendasAbertas_(cfg, agora) { return cfg.vendasAbertas && agora < Date.parse(TURMA.fimVendas); }

// Estado público: preços, relógio e prazos. Nunca revela quantas vagas restam.
function estadoPublico_(agora) {
  var cfg = config_();
  var pe = promoEstado_(cfg, agora);
  var abertas = vendasAbertas_(cfg, agora);
  return {
    ok: true,
    agora: agora,
    vendasAbertas: abertas,
    promoA: pe.promoA,
    promoB: pe.promoB,
    precos: {
      avulso: { tabela: pe.precos.avulsoTabela, atual: pe.precos.avulso },
      combo: { tabela: pe.precos.comboTabela, atual: pe.precos.combo },
      extra: pe.precos.extra,
    },
    noites: TURMA.noites.map(function (n) { return { n: n.n, aberta: abertas && noiteAberta_(n.n, agora) }; }),
    comboAberto: abertas && noiteAberta_(1, agora),
    imagemObrigatoria: cfg.imagemObrigatoria,
  };
}

// ---------- Planilha ----------
// Script ligado à planilha: usa a própria planilha. Script separado: abre a planilha de PLANILHA_ID
// (ex.: a planilha da live, que ganha só a aba "Reservas"; as outras abas não são tocadas).
function planilha_() {
  var id = props_().getProperty('PLANILHA_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('planilha_nao_configurada');
  return ss;
}

function aba_() {
  var ss = planilha_();
  var aba = ss.getSheetByName(ABA_RESERVAS);
  if (!aba) {
    aba = ss.insertSheet(ABA_RESERVAS);
    // Tudo como texto: CPF, CEP e celular não perdem zeros e nada vira fórmula.
    aba.getRange(1, 1, aba.getMaxRows(), COLUNAS.length).setNumberFormat('@');
    aba.appendRow(COLUNAS);
    aba.setFrozenRows(1);
  }
  return aba;
}

function lerReservas_() {
  var aba = aba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];
  var valores = aba.getRange(2, 1, ultima - 1, COLUNAS.length).getValues();
  var out = [];
  for (var i = 0; i < valores.length; i++) {
    try {
      var r = JSON.parse(valores[i][COL_DADOS]);
      r._linha = i + 2;
      out.push(r);
    } catch (err) { /* linha editada à mão: ignora */ }
  }
  return out;
}

function dataBR_(ms) {
  if (!Number(ms)) return '';
  var s = new Date(Number(ms) - 3 * 3600000).toISOString();
  return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) + ' ' + s.slice(11, 16);
}

function seguro_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function linhaDe_(r) {
  var copia = {};
  Object.keys(r).forEach(function (k) { if (k !== '_linha') copia[k] = r[k]; });
  var x = r.extraPessoa || {};
  return [r.codigo, r.status, dataBR_(r.criadoEm), dataBR_(r.expiraEm), dataBR_(r.pagoEm), r.vale || '', r.tipo,
    r.noites.join(','), r.pessoas, centavosBRL_(r.total),
    r.titular.nome, r.titular.celular, r.titular.email, r.titular.cpf, r.titular.menor ? 'sim' : 'não',
    x.nome || '', x.cpf || '', x.parentesco || '', r.promoA ? 'sim' : 'não', r.promoB ? 'sim' : 'não',
    JSON.stringify(copia)].map(seguro_);
}

function salvar_(r) {
  var aba = aba_();
  if (r._linha) aba.getRange(r._linha, 1, 1, COLUNAS.length).setValues([linhaDe_(r)]);
  else aba.appendRow(linhaDe_(r));
}

function achar_(reservas, codigo) {
  for (var i = 0; i < reservas.length; i++) if (reservas[i].codigo === codigo) return reservas[i];
  return null;
}

// ---------- Público ----------
function consultaPublica_(codigo, agora) {
  if (!/^FP[2-9A-HJ-NP-Z]{6}$/.test(codigo)) return { ok: false, erro: 'nao_encontrada' };
  var r = achar_(lerReservas_(), codigo);
  if (!r) return { ok: false, erro: 'nao_encontrada' };
  var status = statusEfetivo_(r, agora);
  var out = { ok: true, codigo: r.codigo, status: status, total: r.total, itens: r.itens, noites: r.noites, expiraEm: r.expiraEm };
  if (status === 'pendente') out.pix = pixPayload_({ centavos: r.total, txid: r.codigo });
  return out;
}

function inscrever_(d, agora) {
  var cfg = config_();
  if (!vendasAbertas_(cfg, agora)) return { ok: false, erro: 'vendas_encerradas' };

  var pedido = normalizarPedido_(d.pedido);
  if (!pedido.ok) return { ok: false, erro: pedido.erro, erros: { pedido: 'Escolha o combo ou pelo menos uma noite avulsa.' } };
  for (var i = 0; i < pedido.noites.length; i++) {
    if (!noiteAberta_(pedido.noites[i], agora)) return { ok: false, erro: 'noite_encerrada', noite: pedido.noites[i] };
  }

  var pe = promoEstado_(cfg, agora);
  var calc = calcularPedido_(pedido, pe.precos);
  if (!calc.ok) return { ok: false, erro: calc.erro };

  var v = validarInscricao_(d, { imagemObrigatoria: cfg.imagemObrigatoria });
  if (!v.ok) return { ok: false, erro: 'dados_invalidos', erros: v.erros };

  var reservas = lerReservas_();
  var cpfs = [v.titular.cpf].concat(v.extra ? [v.extra.cpf] : []);
  for (var j = 0; j < reservas.length; j++) {
    var r0 = reservas[j];
    if (ATIVOS.indexOf(statusEfetivo_(r0, agora)) < 0) continue;
    var usados = [r0.titular.cpf].concat(r0.extraPessoa ? [r0.extraPessoa.cpf] : []);
    if (cpfs.some(function (c) { return usados.indexOf(c) >= 0; })) {
      return { ok: false, erro: 'cpf_duplicado', mensagem: 'Já existe uma inscrição ativa com este CPF. Fale com o Kenji no WhatsApp para conferir.' };
    }
  }

  var pessoas = v.extra ? 2 : 1;
  var cab = cabe_(pedido.noites, pessoas, ocupacao_(reservas, agora));
  var codigo;
  do { codigo = gerarCodigo_(); } while (achar_(reservas, codigo));

  var c = v.consentimentos;
  c.privacidadeEm = agora;
  c.versao = TURMA.versaoTextos;
  var r = {
    codigo: codigo,
    status: cab.cabe ? 'pendente' : 'fila',
    criadoEm: agora,
    expiraEm: cab.cabe ? agora + TURMA.reservaMinutos * 60000 : 0,
    pagoEm: 0,
    vale: '',
    tipo: pedido.tipo,
    noites: pedido.noites,
    extra: pedido.extra,
    pessoas: pessoas,
    itens: calc.itens,
    total: calc.total,
    promoA: pe.promoA.ativa,
    promoB: pe.promoB.ativa,
    titular: v.titular,
    extraPessoa: v.extra,
    consentimentos: c,
    historico: [{ em: agora, acao: cab.cabe ? 'reserva' : 'fila' }],
  };
  salvar_(r);

  if (!cab.cabe) {
    return { ok: true, status: 'fila', codigo: codigo, lotadas: cab.lotadas, total: calc.total, itens: calc.itens };
  }
  return { ok: true, status: 'pendente', codigo: codigo, total: calc.total, itens: calc.itens, noites: pedido.noites, expiraEm: r.expiraEm, pix: pixPayload_({ centavos: calc.total, txid: codigo }) };
}

// ---------- Painel admin ----------
function iguais_(a, b) {
  a = String(a || ''); b = String(b || '');
  var dif = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return dif === 0;
}

function login_(d) {
  var senha = props_().getProperty('ADMIN_SENHA') || '';
  if (senha.length < 10) return { ok: false, erro: 'senha_nao_configurada' };
  var cache = CacheService.getScriptCache();
  var falhas = Number(cache.get('login_falhas') || 0);
  if (falhas >= MAX_FALHAS_LOGIN) return { ok: false, erro: 'bloqueado' };
  if (!iguais_(d.senha, senha)) {
    cache.put('login_falhas', String(falhas + 1), 900);
    return { ok: false, erro: 'senha_incorreta' };
  }
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  cache.put('tok_' + token, '1', 21600); // 6 horas
  return { ok: true, token: token };
}

function mascarar_(r) {
  var c = JSON.parse(JSON.stringify(r));
  delete c._linha;
  [c.titular, c.extraPessoa].forEach(function (p) {
    if (!p) return;
    p.cpf = mascararCPF_(p.cpf);
    if (p.responsavel) p.responsavel.cpf = mascararCPF_(p.responsavel.cpf);
  });
  return c;
}

function admin_(d, agora) {
  var token = String(d.token || '');
  if (!token || !CacheService.getScriptCache().get('tok_' + token)) return { ok: false, erro: 'nao_autorizado' };
  var p = props_();
  var op = d.op;

  if (op === 'promoA' || op === 'promoB') {
    p.setProperty(op === 'promoA' ? 'PROMO_A_ATE' : 'PROMO_B_ATE', String(d.ligar ? agora + TURMA.promoMinutos * 60000 : 0));
    return painel_(agora, false);
  }
  if (op === 'vendas') { p.setProperty('VENDAS_ABERTAS', d.abertas ? '1' : '0'); return painel_(agora, false); }
  if (op === 'imagem') { p.setProperty('IMAGEM_OBRIGATORIA', d.obrigatoria ? '1' : '0'); return painel_(agora, false); }
  if (op === 'listar') return painel_(agora, false);
  if (op === 'exportar') return painel_(agora, true);

  var reservas = lerReservas_();
  if (op === 'limparTestes') {
    var testes = reservas.filter(function (r) { return /^teste\b/i.test(r.titular.nome); });
    var aba = aba_();
    testes.sort(function (a, b) { return b._linha - a._linha; }).forEach(function (r) { aba.deleteRow(r._linha); });
    return { ok: true, removidas: testes.length };
  }

  var r = achar_(reservas, String(d.codigo || ''));
  if (!r) return { ok: false, erro: 'nao_encontrada' };
  var status = statusEfetivo_(r, agora);
  var outros = reservas.filter(function (x) { return x !== r; });
  var temVaga = function () { return cabe_(r.noites, r.pessoas, ocupacao_(outros, agora)).cabe; };
  var registrar = function (acao, extra) {
    r.historico = (r.historico || []).concat([{ em: agora, acao: acao }]);
    salvar_(r);
    var out = { ok: true, codigo: r.codigo, status: statusEfetivo_(r, agora) };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  };

  if (op === 'pagar') {
    if (status === 'pago') return { ok: true, codigo: r.codigo, status: 'pago' };
    if (status === 'reembolsado') return { ok: false, erro: 'reembolsada' };
    if (status !== 'pendente' && !d.forcar && !temVaga()) return { ok: false, erro: 'sem_vaga' };
    r.status = 'pago'; r.pagoEm = agora;
    return registrar('pago');
  }
  if (op === 'estender' || op === 'promover') {
    if (status === 'pago' || status === 'reembolsado') return { ok: false, erro: 'status_invalido' };
    if (status !== 'pendente' && !d.forcar && !temVaga()) return { ok: false, erro: 'sem_vaga' };
    r.status = 'pendente'; r.expiraEm = agora + TURMA.reservaMinutos * 60000;
    return registrar(op);
  }
  if (op === 'liberar') {
    if (status === 'pago' || status === 'reembolsado') return { ok: false, erro: 'status_invalido' };
    r.status = 'cancelada';
    return registrar('liberada');
  }
  if (op === 'reembolsar') {
    if (status !== 'pago') return { ok: false, erro: 'status_invalido' };
    r.status = 'reembolsado';
    var oc = ocupacao_(outros, agora);
    var fila = outros.filter(function (x) { return statusEfetivo_(x, agora) === 'fila'; })
      .sort(function (a, b) { return a.criadoEm - b.criadoEm; });
    var prox = null;
    for (var i = 0; i < fila.length; i++) if (cabe_(fila[i].noites, fila[i].pessoas, oc).cabe) { prox = fila[i].codigo; break; }
    return registrar('reembolsado', { proximaFila: prox });
  }
  if (op === 'vale') { r.vale = d.entregue ? 'entregue' : ''; return registrar(d.entregue ? 'vale entregue' : 'vale desmarcado'); }
  return { ok: false, erro: 'op_invalida' };
}

function painel_(agora, completo) {
  var cfg = config_();
  var pe = promoEstado_(cfg, agora);
  var reservas = lerReservas_();
  var pagos = reservas.filter(function (r) { return statusEfetivo_(r, agora) === 'pago'; })
    .sort(function (a, b) { return a.pagoEm - b.pagoEm; });
  var ordem = {};
  pagos.slice(0, 2).forEach(function (r, i) { ordem[r.codigo] = i + 1; });
  var lista = reservas.map(function (r) {
    var c = completo ? JSON.parse(JSON.stringify(r)) : mascarar_(r);
    delete c._linha;
    c.status = statusEfetivo_(r, agora);
    c.primeiro = ordem[r.codigo] || 0;
    return c;
  });
  return {
    ok: true,
    agora: agora,
    promoA: pe.promoA,
    promoB: pe.promoB,
    vendasAbertas: cfg.vendasAbertas,
    vendasNoPrazo: agora < Date.parse(TURMA.fimVendas),
    imagemObrigatoria: cfg.imagemObrigatoria,
    capacidade: TURMA.capacidade,
    ocupacao: ocupacao_(reservas, agora),
    reservas: lista,
    grupo: props_().getProperty('GRUPO_TURMA') || '',
  };
}
