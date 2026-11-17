// Turma 1: regras puras (preços, pedido, idade, CPF, vagas e Pix). Seção 3 do plano.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGas, pessoa, responsavel } = require('./turma-gas');
const { read } = require('./helpers');
const { JSDOM } = require('jsdom');

const N = createGas().ctx;
const T = Date.parse;

test('Preços: tabela e promoção exatamente como a seção 3.3 (em centavos)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(N.TURMA.precos)), {
    avulsoTabela: 19990, avulsoPromo: 9990, comboTabela: 24990, comboPromo: 12490, cadeiraExtra: 3000,
  });
  assert.equal(N.centavosBRL_(12490), 'R$ 124,90');
  assert.equal(N.centavosBRL_(19990), 'R$ 199,90');
  assert.equal(N.centavosBRL_(3000), 'R$ 30,00');
});

test('Preços: três estados (tabela, promo A, promo B) independentes', () => {
  const tabela = N.precosVigentes_({ promoA: false, promoB: false });
  assert.equal(tabela.avulso, 19990); assert.equal(tabela.combo, 24990); assert.equal(tabela.extra, null);
  const a = N.precosVigentes_({ promoA: true, promoB: false });
  assert.equal(a.avulso, 9990); assert.equal(a.combo, 12490); assert.equal(a.extra, null);
  const b = N.precosVigentes_({ promoA: false, promoB: true });
  assert.equal(b.avulso, 19990); assert.equal(b.combo, 24990); assert.equal(b.extra, 3000);
  const ab = N.precosVigentes_({ promoA: true, promoB: true });
  assert.equal(ab.combo, 12490); assert.equal(ab.extra, 3000);
});

test('Promoção: ativa só até o horário marcado no servidor', () => {
  const agora = T('2026-11-17T22:00:00-03:00');
  assert.equal(N.promoAtiva_(agora + 1000, agora), true);
  assert.equal(N.promoAtiva_(agora, agora), false);
  assert.equal(N.promoAtiva_(0, agora), false);
  assert.equal(N.TURMA.promoMinutos, 15);
});

test('Pedido: combo e avulsos são exclusivos; avulsos sem repetição e só noites 1 a 3', () => {
  assert.equal(N.normalizarPedido_({ combo: true, avulsos: [1] }).ok, false);
  assert.equal(N.normalizarPedido_({ combo: false, avulsos: [] }).ok, false);
  assert.equal(N.normalizarPedido_({ combo: false, avulsos: [4] }).ok, false);
  const p = N.normalizarPedido_({ combo: false, avulsos: [3, 1, 1] });
  assert.equal(p.ok, true); assert.equal(p.tipo, 'avulso'); assert.deepEqual([...p.noites], [1, 3]);
  const c = N.normalizarPedido_({ combo: true, extra: true });
  assert.equal(c.tipo, 'combo'); assert.deepEqual([...c.noites], [1, 2, 3]); assert.equal(c.extra, true);
});

test('Pedido: totais nos três estados, cadeira extra R$ 30 uma única vez', () => {
  const calc = (pedido, promo) => N.calcularPedido_(N.normalizarPedido_(pedido), N.precosVigentes_(promo));
  assert.equal(calc({ combo: true }, { promoA: true }).total, 12490);
  assert.equal(calc({ combo: true }, {}).total, 24990);
  assert.equal(calc({ avulsos: [1, 2] }, { promoA: true }).total, 19980);
  assert.equal(calc({ avulsos: [2] }, {}).total, 19990);
  assert.equal(calc({ combo: true, extra: true }, { promoA: true, promoB: true }).total, 15490);
  assert.equal(calc({ avulsos: [1, 3], extra: true }, { promoB: true }).total, 19990 * 2 + 3000);
  const semB = calc({ combo: true, extra: true }, { promoA: true });
  assert.equal(semB.ok, false); assert.equal(semB.erro, 'cadeira_indisponivel');
  const itens = calc({ combo: true, extra: true }, { promoA: true, promoB: true }).itens;
  assert.equal(itens.length, 2);
  assert.match(itens[1].descricao, /Cadeira extra/);
});

test('Vendas: cada noite fecha às 20h30 do dia e tudo para em 25/11 às 23h', () => {
  assert.equal(N.noiteAberta_(1, T('2026-11-23T20:29:00-03:00')), true);
  assert.equal(N.noiteAberta_(1, T('2026-11-23T20:30:00-03:00')), false);
  assert.equal(N.noiteAberta_(2, T('2026-11-23T21:00:00-03:00')), true);
  assert.equal(N.noiteAberta_(3, T('2026-11-25T20:31:00-03:00')), false);
  assert.equal(N.TURMA.fimVendas, '2026-11-25T23:00:00-03:00');
  assert.deepEqual([...N.TURMA.noites].map((n) => n.inicio), ['2026-11-23T20:30:00-03:00', '2026-11-24T20:30:00-03:00', '2026-11-25T20:30:00-03:00']);
});

test('Módulos: nomes aprovados (N-12)', () => {
  assert.deepEqual([...N.TURMA.noites].map((n) => n.modulo), [
    'O Primeiro Golpe: Dominando o ChatGPT',
    'Dominando o Arsenal de IA',
    'A Arte do Impacto: Criação Audiovisual com IA',
  ]);
});

test('CPF: valida dígitos verificadores e recusa repetidos', () => {
  assert.equal(N.validarCPF_('529.982.247-25'), true);
  assert.equal(N.validarCPF_('52998224724'), false);
  assert.equal(N.validarCPF_('11111111111'), false);
  assert.equal(N.validarCPF_('123'), false);
  assert.equal(N.mascararCPF_('52998224725'), '***.982.247-**');
});

test('Idade: calculada na data da 1ª noite (23/11/2026)', () => {
  assert.equal(N.idadeEm_('2011-11-23', '2026-11-23'), 15);
  assert.equal(N.idadeEm_('2011-11-24', '2026-11-23'), 14);
  assert.equal(N.idadeEm_('2008-11-24', '2026-11-23'), 17);
  assert.equal(N.idadeEm_('2008-11-23', '2026-11-23'), 18);
});

test('Pessoa: todos os campos obrigatórios da seção 3.5', () => {
  const r = N.validarPessoa_({}, 'titular');
  assert.equal(r.ok, false);
  for (const campo of ['nome', 'sexo', 'celular', 'email', 'endereco', 'cep', 'cpf', 'nascimento']) assert.ok(r.erros[campo], `falta erro de ${campo}`);
  const ok = N.validarPessoa_(pessoa(), 'titular');
  assert.equal(ok.ok, true, JSON.stringify(ok.erros));
  assert.equal(ok.pessoa.celular, '5517981596797');
  assert.equal(ok.pessoa.menor, false);
});

test('Pessoa: menor de 15 é bloqueado; menor de 18 exige responsável completo', () => {
  const crianca = N.validarPessoa_(pessoa({ nascimento: '2012-01-01' }), 'titular');
  assert.equal(crianca.ok, false);
  assert.match(crianca.erros.nascimento, /15 anos/);
  const jovem = N.validarPessoa_(pessoa({ nascimento: '2010-01-01' }), 'titular');
  assert.equal(jovem.ok, false);
  assert.ok(jovem.erros.responsavel);
  const comResp = N.validarPessoa_(pessoa({ nascimento: '2010-01-01', responsavel: responsavel() }), 'titular');
  assert.equal(comResp.ok, true, JSON.stringify(comResp.erros));
  assert.equal(comResp.pessoa.menor, true);
  const respRuim = N.validarPessoa_(pessoa({ nascimento: '2010-01-01', responsavel: responsavel({ cpf: '123', email: 'x' }) }), 'titular');
  assert.equal(respRuim.ok, false);
});

test('Cadeira extra: parentesco só cônjuge ou filho(a) (N-3)', () => {
  assert.deepEqual([...N.TURMA.parentescosExtra], ['conjuge', 'filho']);
  assert.equal(N.validarPessoa_(pessoa({ parentesco: 'irmao' }), 'extra').ok, false);
  assert.equal(N.validarPessoa_(pessoa({ parentesco: 'filho' }), 'extra').ok, true);
});

test('Inscrição: declarações A1 (com menor), A2 (configurável) e A3 (sempre)', () => {
  const base = (over = {}) => ({ pedido: { combo: true }, titular: pessoa(), consentimentos: { privacidade: true, imagem: true }, ...over });
  assert.equal(N.validarInscricao_(base(), { imagemObrigatoria: true }).ok, true);
  const semA3 = N.validarInscricao_(base({ consentimentos: { imagem: true } }), { imagemObrigatoria: true });
  assert.ok(semA3.erros.privacidade);
  const semA2 = base({ consentimentos: { privacidade: true } });
  assert.ok(N.validarInscricao_(semA2, { imagemObrigatoria: true }).erros.imagem);
  assert.equal(N.validarInscricao_(semA2, { imagemObrigatoria: false }).ok, true);
  const menor = base({ titular: pessoa({ nascimento: '2010-01-01', responsavel: responsavel() }) });
  assert.ok(N.validarInscricao_(menor, { imagemObrigatoria: true }).erros.declaracaoResponsavel);
  menor.consentimentos.responsavel = true;
  assert.equal(N.validarInscricao_(menor, { imagemObrigatoria: true }).ok, true);
});

test('Inscrição: pessoa extra menor também pede responsável e A1; CPFs diferentes', () => {
  const titular = pessoa();
  const filho = pessoa({ nome: 'Pedro Filho Teste', nascimento: '2010-03-03', parentesco: 'filho' });
  const body = { pedido: { combo: true, extra: true }, titular, extra: filho, consentimentos: { privacidade: true, imagem: true, responsavel: true } };
  const r = N.validarInscricao_(body, { imagemObrigatoria: true });
  assert.ok(r.erros['extra.responsavel']);
  filho.responsavel = responsavel();
  assert.equal(N.validarInscricao_(body, { imagemObrigatoria: true }).ok, true);
  const mesmo = { ...body, extra: { ...filho, cpf: titular.cpf } };
  assert.ok(N.validarInscricao_(mesmo, { imagemObrigatoria: true }).erros['extra.cpf']);
  const semExtra = { ...body, extra: undefined };
  assert.ok(N.validarInscricao_(semExtra, { imagemObrigatoria: true }).erros.extra);
});

test('Vagas: oficial 10, aceita até 14 por noite; titular e cadeira extra contam', () => {
  assert.equal(N.TURMA.capacidade.oficial, 10);
  assert.equal(N.TURMA.capacidade.maxima, 14);
  const agora = T('2026-11-17T21:00:00-03:00');
  const reservas = [
    { status: 'pago', noites: [1, 2, 3], pessoas: 2 },
    { status: 'pendente', expiraEm: agora + 60000, noites: [1], pessoas: 1 },
    { status: 'pendente', expiraEm: agora - 1, noites: [2], pessoas: 1 },
    { status: 'fila', noites: [3], pessoas: 1 },
    { status: 'reembolsado', noites: [3], pessoas: 1 },
  ];
  const oc = N.ocupacao_(reservas, agora);
  assert.deepEqual([oc[1], oc[2], oc[3]], [3, 2, 2]);
  assert.equal(N.cabe_([1, 2, 3], 2, { 1: 12, 2: 0, 3: 0 }).cabe, true);
  const cheio = N.cabe_([1, 2, 3], 2, { 1: 13, 2: 0, 3: 0 });
  assert.equal(cheio.cabe, false); assert.deepEqual([...cheio.lotadas], [1]);
  assert.equal(N.cabe_([2], 1, { 1: 14, 2: 13, 3: 14 }).cabe, true);
});

test('Reserva: pendente vencida vira expirada (30 min de trava, N-4)', () => {
  assert.equal(N.TURMA.reservaMinutos, 30);
  const agora = 1000;
  assert.equal(N.statusEfetivo_({ status: 'pendente', expiraEm: 999 }, agora), 'expirada');
  assert.equal(N.statusEfetivo_({ status: 'pendente', expiraEm: 1001 }, agora), 'pendente');
  assert.equal(N.statusEfetivo_({ status: 'pago', expiraEm: 1 }, agora), 'pago');
});

test('Pix: BR Code com valor exato, chave, nome, cidade e txid; CRC16 correto', () => {
  assert.equal(N.crc16_('123456789'), '29B1');
  const p = N.pixPayload_({ centavos: 12490, txid: 'FP7K3Q9X' });
  assert.match(p, /^000201/);
  assert.ok(p.includes('0014br.gov.bcb.pix0136' + '8126c242-f4fe-49f4-909a-17b790215cc6'));
  assert.ok(p.includes('5406124.90'));
  assert.ok(p.includes('5919KENJI MARCOS SUZUKI'));
  assert.ok(p.includes('6008BARRETOS'));
  assert.ok(p.includes('62120508FP7K3Q9X'));
  assert.equal(p.slice(-4), N.crc16_(p.slice(0, -4)));
});

test('Pix: igual ao gerador já usado no site (assets/js/pix.js)', () => {
  const w = new JSDOM('', { runScripts: 'outside-only' }).window;
  w.eval(read('assets/js/pix.js'));
  const site = w.Pix.payload({ key: '8126c242-f4fe-49f4-909a-17b790215cc6', keyType: 'aleatoria', name: 'KENJI MARCOS SUZUKI', city: 'BARRETOS', amount: 154.9, txid: 'FPABC123' });
  assert.equal(N.pixPayload_({ centavos: 15490, txid: 'FPABC123' }), site);
});

test('Código da reserva: curto, sem caracteres confusos e serve de txid', () => {
  const vistos = new Set();
  for (let i = 0; i < 200; i++) {
    const c = N.gerarCodigo_();
    assert.match(c, /^FP[2-9A-HJ-NP-Z]{6}$/);
    vistos.add(c);
  }
  assert.ok(vistos.size > 190);
});
