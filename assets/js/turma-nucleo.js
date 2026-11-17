/**
 * Turma 1 · "Do Zero ao Faixa Preta com Inteligência Artificial"
 * Regras do treinamento (preços, pedido, idade, CPF, vagas e Pix).
 *
 * ESTE MESMO ARQUIVO É USADO EM DOIS LUGARES:
 *  - no site (turma.html), só para mostrar informações e validar o formulário;
 *  - no Google Apps Script (arquivo "Nucleo"), onde vale de verdade: o servidor
 *    recalcula preço, vagas e validações, então mexer no navegador não muda nada.
 * Se alterar aqui, cole de novo no Apps Script e publique uma nova versão.
 *
 * Não coloque aqui senha nem o link do grupo da Turma 01: o repositório é público.
 */
var TURMA = {
  nome: 'Do Zero ao Faixa Preta com Inteligência Artificial',
  turma: 'Turma 01',
  noites: [
    { n: 1, data: '23/11', diaSemana: 'segunda-feira', inicio: '2026-11-23T20:30:00-03:00', modulo: 'O Primeiro Golpe: Dominando o ChatGPT', foco: 'Marketing', verbo: 'atrair' },
    { n: 2, data: '24/11', diaSemana: 'terça-feira', inicio: '2026-11-24T20:30:00-03:00', modulo: 'Dominando o Arsenal de IA', foco: 'Vendas', verbo: 'converter' },
    { n: 3, data: '25/11', diaSemana: 'quarta-feira', inicio: '2026-11-25T20:30:00-03:00', modulo: 'A Arte do Impacto: Criação Audiovisual com IA', foco: 'Criação', verbo: 'comunicar' },
  ],
  horario: { recepcao: '19h50', aula: '20h30 às 22h30' },
  endereco: 'Avenida 19, nº 2306, Barretos/SP',
  precos: { avulsoTabela: 19990, avulsoPromo: 9990, comboTabela: 24990, comboPromo: 12490, cadeiraExtra: 3000 },
  capacidade: { oficial: 10, maxima: 14 },
  promoMinutos: 15,
  reservaMinutos: 30,
  fimVendas: '2026-11-25T23:00:00-03:00',
  dataReferenciaIdade: '2026-11-23',
  idadeMinima: 15,
  maioridade: 18,
  parentescosExtra: ['conjuge', 'filho'],
  sexos: ['F', 'M', 'O', 'N'],
  pix: { chave: '8126c242-f4fe-49f4-909a-17b790215cc6', nome: 'KENJI MARCOS SUZUKI', cidade: 'BARRETOS' },
  whatsapp: '5517981596797',
  versaoTextos: 'v1-rascunho-2026-11-17',
};

// ---------- Utilidades ----------
function soDigitos_(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function texto_(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 200); }

function centavosBRL_(c) {
  c = Math.round(Number(c) || 0);
  var reais = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$ ' + reais + ',' + String(c % 100).padStart(2, '0');
}

// ---------- Preços e promoções ----------
function promoAtiva_(ateMs, agora) { return Number(ateMs) > agora; }

function precosVigentes_(promo) {
  promo = promo || {};
  var p = TURMA.precos;
  return {
    avulso: promo.promoA ? p.avulsoPromo : p.avulsoTabela,
    combo: promo.promoA ? p.comboPromo : p.comboTabela,
    extra: promo.promoB ? p.cadeiraExtra : null,
    avulsoTabela: p.avulsoTabela,
    comboTabela: p.comboTabela,
  };
}

function noiteAberta_(n, agora) {
  var noite = TURMA.noites[n - 1];
  if (!noite) return false;
  return agora < Date.parse(noite.inicio) && agora < Date.parse(TURMA.fimVendas);
}

// ---------- Pedido ----------
function normalizarPedido_(p) {
  p = p || {};
  var combo = p.combo === true;
  var extra = p.extra === true;
  var lista = Array.isArray(p.avulsos) ? p.avulsos : [];
  var noites = [];
  for (var i = 0; i < lista.length; i++) {
    var n = Number(lista[i]);
    if (!(n === 1 || n === 2 || n === 3)) return { ok: false, erro: 'pedido_invalido' };
    if (noites.indexOf(n) < 0) noites.push(n);
  }
  noites.sort();
  if (combo && noites.length) return { ok: false, erro: 'pedido_invalido' };
  if (!combo && !noites.length) return { ok: false, erro: 'pedido_vazio' };
  return { ok: true, tipo: combo ? 'combo' : 'avulso', noites: combo ? [1, 2, 3] : noites, extra: extra };
}

function calcularPedido_(pedido, precos) {
  if (!pedido || !pedido.ok) return { ok: false, erro: (pedido && pedido.erro) || 'pedido_invalido' };
  var itens = [];
  if (pedido.tipo === 'combo') {
    itens.push({ descricao: 'Combo 3 noites (certificado + bônus)', centavos: precos.combo });
  } else {
    pedido.noites.forEach(function (n) {
      itens.push({ descricao: 'Noite ' + n + ' avulsa (' + TURMA.noites[n - 1].data + ')', centavos: precos.avulso });
    });
  }
  if (pedido.extra) {
    if (precos.extra == null) return { ok: false, erro: 'cadeira_indisponivel' };
    itens.push({ descricao: 'Cadeira extra (acompanhante nas mesmas noites)', centavos: precos.extra });
  }
  var total = itens.reduce(function (s, it) { return s + it.centavos; }, 0);
  return { ok: true, itens: itens, total: total };
}

// ---------- Pessoas ----------
function validarCPF_(cpf) {
  var d = soDigitos_(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (var t = 9; t < 11; t++) {
    var s = 0;
    for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}

function mascararCPF_(cpf) {
  var d = soDigitos_(cpf);
  return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : '***';
}

function idadeEm_(nascISO, refISO) {
  var a = String(nascISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var b = String(refISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!a || !b) return NaN;
  var idade = Number(b[1]) - Number(a[1]);
  if (Number(b[2]) * 100 + Number(b[3]) < Number(a[2]) * 100 + Number(a[3])) idade--;
  return idade;
}

function dataValida_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

var EMAIL_RE_ = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function celular_(v) {
  var d = soDigitos_(v);
  if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? '55' + d : '';
}

function validarContato_(p, erros, prefixo) {
  var nome = texto_(p.nome, 120);
  if (nome.length < 5 || nome.indexOf(' ') < 0) erros[prefixo + 'nome'] = 'Informe o nome completo (nome e sobrenome).';
  var cel = celular_(p.celular);
  if (!cel) erros[prefixo + 'celular'] = 'Informe o celular com DDD. Ex.: (17) 99999-9999.';
  var email = texto_(p.email, 160).toLowerCase();
  if (!EMAIL_RE_.test(email)) erros[prefixo + 'email'] = 'Informe um e-mail válido.';
  var cpf = soDigitos_(p.cpf);
  if (!validarCPF_(cpf)) erros[prefixo + 'cpf'] = 'CPF inválido. Confira os números.';
  return { nome: nome, celular: cel, email: email, cpf: cpf };
}

function validarPessoa_(p, papel) {
  p = p || {};
  var erros = {};
  var base = validarContato_(p, erros, '');
  var sexo = String(p.sexo || '');
  if (TURMA.sexos.indexOf(sexo) < 0) erros.sexo = 'Selecione uma opção.';
  var endereco = texto_(p.endereco, 200);
  if (endereco.length < 8) erros.endereco = 'Informe o endereço completo (rua, número, bairro e cidade).';
  var cep = soDigitos_(p.cep);
  if (cep.length !== 8) erros.cep = 'Informe o CEP com 8 números.';
  var nascimento = String(p.nascimento || '');
  var idade = dataValida_(nascimento) ? idadeEm_(nascimento, TURMA.dataReferenciaIdade) : NaN;
  if (!(idade >= 0 && idade < 110)) erros.nascimento = 'Informe a data de nascimento.';
  else if (idade < TURMA.idadeMinima) erros.nascimento = 'A idade mínima para participar é de 15 anos.';
  var menor = idade >= TURMA.idadeMinima && idade < TURMA.maioridade;

  var pessoa = {
    nome: base.nome, sexo: sexo, celular: base.celular, email: base.email,
    endereco: endereco, cep: cep, cpf: base.cpf, nascimento: nascimento,
    idade: idade, menor: !!menor,
  };

  if (papel === 'extra') {
    var parentesco = String(p.parentesco || '');
    if (TURMA.parentescosExtra.indexOf(parentesco) < 0) erros.parentesco = 'A cadeira extra é para cônjuge ou filho(a).';
    pessoa.parentesco = parentesco;
  }

  if (menor) {
    var r = p.responsavel;
    if (!r || typeof r !== 'object') {
      erros.responsavel = 'Menores de 18 anos precisam dos dados do responsável legal.';
    } else {
      var resp = validarContato_(r, erros, 'responsavel.');
      resp.parentesco = texto_(r.parentesco, 40);
      if (!resp.parentesco) erros['responsavel.parentesco'] = 'Informe o parentesco do responsável.';
      if (resp.cpf && resp.cpf === pessoa.cpf) erros['responsavel.cpf'] = 'O CPF do responsável deve ser diferente do CPF do participante.';
      pessoa.responsavel = resp;
    }
  }
  return { ok: Object.keys(erros).length === 0, erros: erros, pessoa: pessoa };
}

function validarInscricao_(body, cfg) {
  body = body || {};
  cfg = cfg || {};
  var erros = {};
  var pedido = normalizarPedido_(body.pedido);
  if (!pedido.ok) erros.pedido = 'Escolha o combo ou pelo menos uma noite avulsa.';

  var t = validarPessoa_(body.titular, 'titular');
  Object.keys(t.erros).forEach(function (k) { erros[k] = t.erros[k]; });

  var x = null;
  if (pedido.ok && pedido.extra) {
    if (!body.extra || typeof body.extra !== 'object') {
      erros.extra = 'Preencha os dados da pessoa da cadeira extra.';
    } else {
      x = validarPessoa_(body.extra, 'extra');
      Object.keys(x.erros).forEach(function (k) { erros['extra.' + k] = x.erros[k]; });
      if (x.pessoa.cpf && x.pessoa.cpf === t.pessoa.cpf) erros['extra.cpf'] = 'A pessoa da cadeira extra precisa de um CPF diferente do titular.';
    }
  }

  var c = body.consentimentos || {};
  var menores = t.pessoa.menor || !!(x && x.pessoa.menor);
  if (c.privacidade !== true) erros.privacidade = 'Para se inscrever, confirme que leu o aviso de privacidade.';
  if (cfg.imagemObrigatoria && c.imagem !== true) erros.imagem = 'Para participar desta turma, é preciso autorizar o uso de imagem.';
  if (menores && c.responsavel !== true) erros.declaracaoResponsavel = 'Confirme a declaração do responsável legal.';

  return {
    ok: Object.keys(erros).length === 0,
    erros: erros,
    pedido: pedido,
    titular: t.pessoa,
    extra: x ? x.pessoa : null,
    menores: menores,
    consentimentos: { privacidade: c.privacidade === true, imagem: c.imagem === true, responsavel: menores ? c.responsavel === true : false },
  };
}

// ---------- Vagas ----------
function statusEfetivo_(r, agora) {
  if (r.status === 'pendente' && Number(r.expiraEm) <= agora) return 'expirada';
  return r.status;
}

function ocupacao_(reservas, agora) {
  var oc = { 1: 0, 2: 0, 3: 0 };
  (reservas || []).forEach(function (r) {
    var s = statusEfetivo_(r, agora);
    if (s !== 'pendente' && s !== 'pago') return;
    (r.noites || []).forEach(function (n) { oc[n] = (oc[n] || 0) + (Number(r.pessoas) || 1); });
  });
  return oc;
}

function cabe_(noites, pessoas, oc, maxima) {
  var max = maxima || TURMA.capacidade.maxima;
  var lotadas = (noites || []).filter(function (n) { return (oc[n] || 0) + pessoas > max; });
  return { cabe: lotadas.length === 0, lotadas: lotadas };
}

// ---------- Código da reserva e Pix ----------
var ALFABETO_CODIGO_ = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function gerarCodigo_() {
  var s = 'FP';
  for (var i = 0; i < 6; i++) s += ALFABETO_CODIGO_[Math.floor(Math.random() * ALFABETO_CODIGO_.length)];
  return s;
}

function crc16_(str) {
  var crc = 0xffff;
  for (var i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (var j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function campoPix_(id, valor) { return id + String(valor.length).padStart(2, '0') + valor; }
function limparPix_(s, max) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .,\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function pixPayload_(o) {
  var chave = o.chave || TURMA.pix.chave;
  var txid = limparPix_(o.txid, 25).replace(/[^A-Za-z0-9]/g, '') || '***';
  var out = campoPix_('00', '01') +
    campoPix_('26', campoPix_('00', 'br.gov.bcb.pix') + campoPix_('01', chave)) +
    campoPix_('52', '0000') + campoPix_('53', '986');
  if (Number(o.centavos) > 0) out += campoPix_('54', (Number(o.centavos) / 100).toFixed(2));
  out += campoPix_('58', 'BR') +
    campoPix_('59', limparPix_(o.nome || TURMA.pix.nome, 25)) +
    campoPix_('60', limparPix_(o.cidade || TURMA.pix.cidade, 15)) +
    campoPix_('62', campoPix_('05', txid)) + '6304';
  return out + crc16_(out);
}
