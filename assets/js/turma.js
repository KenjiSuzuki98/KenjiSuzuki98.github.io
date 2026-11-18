// Página da Turma 01 (turma.html): montador de pedido, preços lidos do servidor,
// formulário de inscrição e tela do Pix. Preço, vagas e validação valem no servidor
// (Google Apps Script); aqui é só a vitrine. Nenhum dado pessoal fica no navegador.
(() => {
  const { $, esc, ext, waLink } = Site;
  const ENDPOINT_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
  const POLL_MS = 15000;
  const brl = (c) => centavosBRL_(c);
  const P = TURMA.precos;

  let site = {};
  let endpoint = '';
  let estado = null;     // último estado confirmado pelo servidor (null = fail-safe)
  let falhou = false;
  let offset = 0;        // diferença entre o relógio do servidor e o do aparelho
  let concluido = false; // já mostrou Pix ou fila
  let reserva = null;    // reserva exibida (para a contagem regressiva)
  const agora = () => Date.now() + offset;

  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const waKenji = (texto) => waLink(TURMA.whatsapp, texto);
  const noiteTxt = (n) => `noite ${n} (${TURMA.noites[n - 1].data})`;

  // ---------- Preços ----------
  function precos() {
    if (!estado) return { avulso: P.avulsoTabela, combo: P.comboTabela, extra: null, promoA: false };
    return { avulso: estado.precos.avulso.atual, combo: estado.precos.combo.atual, extra: estado.precos.extra, promoA: estado.promoA.ativa };
  }
  const noiteAberta = (n) => !!(estado && estado.noites[n - 1] && estado.noites[n - 1].aberta);

  function pedido() {
    const combo = $('#modoCombo').checked && !$('#modoCombo').disabled;
    const avulsos = combo ? [] : [1, 2, 3].filter((n) => $('#noite' + n).checked && !$('#noite' + n).disabled);
    const extra = $('#optExtra').checked && !$('#optExtra').disabled;
    return { combo, avulsos, extra };
  }

  // Código de doação digitado (a validade é conferida só no servidor).
  const codigoDigitado = () => { const el = $('#codigoBonus'); return el ? el.value.trim() : ''; };
  // Preços para o total exibido: com código, o combo sai a R$ 0,00 (cadeira extra continua paga).
  function precosDoPedido(p) {
    return { avulso: p.avulso, combo: codigoDigitado() ? 0 : p.combo, extra: p.extra };
  }

  function setPreco(atualEl, tabelaEl, atual, tabela) {
    atualEl.textContent = brl(atual);
    const promo = atual < tabela;
    tabelaEl.hidden = !promo;
    tabelaEl.innerHTML = promo ? `<span class="sr-only">Preço de tabela: </span>${brl(tabela)}` : '';
  }

  function renderPrecos() {
    const p = precos();
    setPreco($('#precoCombo'), $('#tabelaCombo'), p.combo, P.comboTabela);
    setPreco($('#precoAvulso'), $('#tabelaAvulso'), p.avulso, P.avulsoTabela);

    const banner = $('#promoBanner');
    banner.hidden = !p.promoA;

    // Combo só enquanto a 1ª noite não começou; avulsos só em noites abertas.
    const comboOk = !estado || estado.comboAberto;
    $('#modoCombo').disabled = !comboOk;
    if (!comboOk && $('#modoCombo').checked) $('#modoAvulso').checked = true;
    // Com código de doação, vale só o combo.
    const comCodigo = !!codigoDigitado();
    if (comCodigo && comboOk) $('#modoCombo').checked = true;
    $('#modoAvulso').disabled = comCodigo && comboOk;
    $('#codigoInfo').textContent = !comCodigo
      ? 'Com um código válido, o combo das 3 noites sai de graça.'
      : comboOk
        ? 'Código aplicado ao combo das 3 noites: R$ 0,00 se o código for válido. A cadeira extra continua R$ 30,00.'
        : 'O código vale só para o combo das 3 noites, que já começou.';
    const modoAvulso = $('#modoAvulso').checked;
    for (const n of [1, 2, 3]) {
      const cb = $('#noite' + n);
      cb.disabled = !modoAvulso || (estado ? !noiteAberta(n) : false);
      if (cb.disabled) cb.checked = false;
      const aberta = estado ? noiteAberta(n) : true;
      cb.closest('label').classList.toggle('is-off', !aberta);
    }

    const extra = $('#optExtra');
    const tinhaExtra = extra.checked;
    extra.disabled = p.extra == null;
    if (extra.disabled) extra.checked = false;
    $('#extraInfo').textContent = extra.disabled
      ? 'Indisponível no momento.'
      : 'Acompanha o titular nas mesmas noites (cônjuge ou filho(a)).';
    if (tinhaExtra && !extra.checked && !concluido) status('A cadeira extra ficou indisponível e foi desmarcada.');

    const ped = pedido();
    const calc = calcularPedido_(normalizarPedido_(ped), precosDoPedido(p));
    $('#totalPedido').textContent = calc.ok ? brl(calc.total) : 'escolha pelo menos uma noite';

    const sug = $('#sugestaoCombo');
    sug.hidden = !(ped.avulsos.length === 3 && comboOk);
    if (!sug.hidden) $('#sugestaoTexto').textContent = `As 3 noites saem por ${brl(p.combo)} no combo, com certificado de 6h e o bônus Missão Black Friday.`;

    const bloco = $('#blocoExtra');
    if (bloco) { bloco.hidden = !ped.extra; atualizarIdades(); }
  }

  function renderAviso() {
    const aviso = $('#avisoServidor');
    const wa = ext(waKenji('Olá, Kenji! Quero me inscrever na Turma 01 do Faixa Preta em IA.'), `${icon('whatsapp')} Falar com o Kenji no WhatsApp`, 'class="btn btn-sm btn-wa"');
    if (!endpoint) {
      aviso.innerHTML = `<p>As inscrições pelo site estão sendo preparadas. Os valores abaixo são o preço de tabela. Para garantir sua vaga agora, fale com o Kenji:</p>${wa}`;
      aviso.hidden = false;
    } else if (falhou) {
      aviso.innerHTML = `<p>Não conseguimos confirmar as condições com o servidor agora, então mostramos o preço de tabela. Tente de novo em instantes ou fale com o Kenji.</p>${wa}`;
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
      aviso.textContent = '';
    }
  }

  function render() {
    renderPrecos();
    renderAviso();
    const form = $('#turmaForm');
    const fechado = !!(estado && !estado.vendasAbertas);
    $('#encerrado').hidden = !fechado || concluido;
    $('#montador').hidden = concluido || fechado;
    if (fechado) form.hidden = true;
    else if (estado && !concluido) form.hidden = false;
    if (estado) {
      $('#a2Obrig').hidden = !estado.imagemObrigatoria;
      $('#a2Opc').hidden = !!estado.imagemObrigatoria;
    }
    tick();
  }

  function tick() {
    const p = precos();
    if (estado && p.promoA) {
      const resta = estado.promoA.ate - agora();
      $('#promoTimer').textContent = mmss(resta);
      if (resta <= 0) atualizar();
    }
    if (estado && estado.promoB.ativa && estado.promoB.ate - agora() <= 0) atualizar();
    const t = $('#reservaTimer');
    if (t && reserva && reserva.expiraEm) {
      const resta = reserva.expiraEm - agora();
      t.textContent = mmss(resta);
      if (resta <= 0) $('#reservaExpirou').hidden = false;
    }
  }

  let buscando = null;
  function atualizar() {
    if (buscando) return buscando;
    buscando = (async () => {
      if (!endpoint) { estado = null; render(); return; }
      try {
        const res = await fetch(`${endpoint}?action=estado&t=${Date.now()}`, { cache: 'no-store' });
        const e = await res.json();
        if (!e || e.ok !== true || !e.precos || !e.promoA) throw new Error('estado inválido');
        estado = e;
        offset = e.agora - Date.now();
        falhou = false;
      } catch (err) {
        estado = null; // nunca usa promoção guardada: volta ao preço de tabela
        falhou = true;
      }
      render();
    })().finally(() => { buscando = null; });
    return buscando;
  }

  // ---------- Formulário ----------
  function campo(id, label, attrs = '', type = 'text') {
    return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" ${attrs} aria-describedby="e${id}"><small class="err" id="e${id}"></small></div>`;
  }
  function escolha(id, label, opcoes) {
    return `<div class="field"><label for="${id}">${label}</label><select id="${id}" aria-describedby="e${id}">${opcoes.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select><small class="err" id="e${id}"></small></div>`;
  }
  function pessoaCampos(p, proprio) {
    const ac = (v) => (proprio ? `autocomplete="${v}"` : 'autocomplete="off"');
    return `
      ${campo(p + 'Nome', 'Nome completo *', `${ac('name')} maxlength="120"`)}
      ${escolha(p + 'Sexo', 'Sexo *', [['', 'Selecione'], ['F', 'Feminino'], ['M', 'Masculino'], ['O', 'Outro'], ['N', 'Prefiro não informar']])}
      ${campo(p + 'Cel', 'Celular com WhatsApp *', `${ac('tel-national')} inputmode="tel" maxlength="16" placeholder="(17) 99999-9999"`, 'tel')}
      ${campo(p + 'Email', 'E-mail *', `${ac('email')} maxlength="160" placeholder="voce@exemplo.com"`, 'email')}
      ${campo(p + 'End', 'Endereço completo *', `${ac('street-address')} maxlength="200" placeholder="Rua, número, bairro, cidade/UF"`)}
      ${campo(p + 'Cep', 'CEP *', `${ac('postal-code')} inputmode="numeric" maxlength="9" placeholder="00000-000"`)}
      ${campo(p + 'Cpf', 'CPF *', 'autocomplete="off" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')}
      ${campo(p + 'Nasc', 'Data de nascimento *', `${ac('bday')}`, 'date')}`;
  }
  function respCampos(p, extra) {
    return `
      <fieldset class="subgrupo" id="${p}Resp" hidden>
        <legend>Responsável legal (participante menor de 18 anos)</legend>
        ${extra ? '<label class="check-field" for="xRTitular"><input type="checkbox" id="xRTitular"><span>O responsável legal é o titular desta inscrição</span></label>' : ''}
        ${campo(p + 'RNome', 'Nome completo do responsável *', 'autocomplete="off" maxlength="120"')}
        ${campo(p + 'RCpf', 'CPF do responsável *', 'autocomplete="off" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')}
        ${campo(p + 'RCel', 'Celular do responsável *', 'autocomplete="off" inputmode="tel" maxlength="16" placeholder="(17) 99999-9999"', 'tel')}
        ${campo(p + 'REmail', 'E-mail do responsável *', 'autocomplete="off" maxlength="160"', 'email')}
        ${escolha(p + 'RPar', 'Parentesco do responsável *', [['', 'Selecione'], ['Mãe', 'Mãe'], ['Pai', 'Pai'], ['Avó', 'Avó'], ['Avô', 'Avô'], ['Tutor(a) legal', 'Tutor(a) legal'], ['Outro', 'Outro']])}
      </fieldset>`;
  }

  function montarForm() {
    $('#turmaForm').innerHTML = `
      <p class="muted-text">Preencha os dados de cada pessoa. Campos com * são obrigatórios.</p>
      <fieldset class="grupo">
        <legend>Seus dados (titular)</legend>
        ${pessoaCampos('t', true)}
        ${respCampos('t', false)}
      </fieldset>
      <fieldset class="grupo" id="blocoExtra" hidden>
        <legend>Pessoa da cadeira extra</legend>
        ${escolha('xPar', 'Parentesco com o titular *', [['', 'Selecione'], ['conjuge', 'Cônjuge'], ['filho', 'Filho(a)']])}
        <label class="check-field" for="xMesmoEnd"><input type="checkbox" id="xMesmoEnd"><span>Mesmo endereço e CEP do titular</span></label>
        ${pessoaCampos('x', false)}
        ${respCampos('x', true)}
      </fieldset>
      <div class="hp" aria-hidden="true">
        <label for="fSite">Deixe este campo vazio</label>
        <input id="fSite" name="website" tabindex="-1" autocomplete="off">
      </div>
      <fieldset class="grupo">
        <legend>Declarações</legend>
        <div id="wrapA1" hidden>
          <label class="check-field" for="cA1"><input type="checkbox" id="cA1" aria-describedby="ecA1"><span><strong>Declaração do responsável legal *</strong> Ao efetuar o pagamento, confirmo que o responsável legal indicado neste formulário está ciente e de acordo com a participação do(a) menor no treinamento "${esc(TURMA.nome)}", nos dias e horários informados. <a href="turma-termos.html#responsavel">Ler a declaração</a></span></label>
          <small class="err" id="ecA1"></small>
        </div>
        <label class="check-field" for="cA2"><input type="checkbox" id="cA2" aria-describedby="ecA2"><span><strong>Autorização de uso de imagem <span id="a2Obrig">*</span><span id="a2Opc" hidden>(opcional)</span></strong> Autorizo, de forma gratuita, o uso da minha imagem e voz (fotos e vídeos do treinamento) na divulgação do treinamento. Posso revogar pelo WhatsApp. <a href="turma-termos.html#imagem">Ler a autorização completa</a></span></label>
        <small class="err" id="ecA2"></small>
        <label class="check-field" for="cA3"><input type="checkbox" id="cA3" aria-describedby="ecA3"><span><strong>Aviso de privacidade *</strong> Li o aviso de privacidade: meus dados são usados só para a inscrição, o controle de vagas, a comunicação sobre o treinamento, o certificado e o recibo, sem venda de dados. <a href="turma-termos.html#privacidade">Ler o aviso de privacidade</a></span></label>
        <small class="err" id="ecA3"></small>
      </fieldset>
      <button type="submit" class="btn btn-gold btn-block" id="btnInscrever">Reservar minha vaga e pagar via Pix</button>
      <p class="form-status" id="formStatus" role="status" aria-live="polite"></p>`;
  }

  const val = (id) => { const el = $('#' + id); return el ? el.value.trim() : ''; };
  const visivel = (id) => { const el = $('#' + id); return !!el && !el.hidden; };

  function lerPessoa(p) {
    return { nome: val(p + 'Nome'), sexo: val(p + 'Sexo'), celular: val(p + 'Cel'), email: val(p + 'Email'), endereco: val(p + 'End'), cep: dig(val(p + 'Cep')), cpf: dig(val(p + 'Cpf')), nascimento: val(p + 'Nasc') };
  }
  function lerResp(p) {
    return { nome: val(p + 'RNome'), cpf: dig(val(p + 'RCpf')), celular: val(p + 'RCel'), email: val(p + 'REmail'), parentesco: val(p + 'RPar') };
  }

  function montarBody() {
    const ped = pedido();
    const titular = lerPessoa('t');
    if (visivel('tResp')) titular.responsavel = lerResp('t');
    const body = { acao: 'inscrever', pedido: ped, titular, website: $('#fSite').value };
    if (codigoDigitado()) body.codigoBonus = codigoDigitado();
    if (ped.extra) {
      body.extra = { ...lerPessoa('x'), parentesco: val('xPar') };
      if (visivel('xResp')) body.extra.responsavel = lerResp('x');
    }
    body.consentimentos = { privacidade: $('#cA3').checked, imagem: $('#cA2').checked, responsavel: visivel('wrapA1') && $('#cA1').checked };
    return body;
  }

  // Máscaras
  const dig = (v) => String(v || '').replace(/\D/g, '');
  function fmtCPF(v) {
    const d = dig(v).slice(0, 11);
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  const fmtCEP = (v) => { const d = dig(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
  function fmtCel(v) {
    let d = dig(v);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  function mascarar(el) {
    const id = el.id || '';
    if (/Cpf$/.test(id)) el.value = fmtCPF(el.value);
    else if (/Cep$/.test(id)) el.value = fmtCEP(el.value);
    else if (/Cel$/.test(id)) el.value = fmtCel(el.value);
  }

  function idade(id) {
    const v = val(id);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? idadeEm_(v, TURMA.dataReferenciaIdade) : NaN;
  }
  const ehMenor = (i) => i >= TURMA.idadeMinima && i < TURMA.maioridade;

  function atualizarIdades() {
    const ti = idade('tNasc');
    const xi = idade('xNasc');
    const extraOn = visivel('blocoExtra');
    $('#tResp').hidden = !ehMenor(ti);
    $('#xResp').hidden = !(extraOn && ehMenor(xi));
    for (const [id, i] of [['tNasc', ti], ['xNasc', xi]]) {
      const e = $('#e' + id);
      if (i < TURMA.idadeMinima) { e.textContent = 'A idade mínima para participar é de 15 anos.'; $('#' + id).setAttribute('aria-invalid', 'true'); }
      else if (e.textContent.includes('15 anos')) { e.textContent = ''; $('#' + id).removeAttribute('aria-invalid'); }
    }
    $('#wrapA1').hidden = !(ehMenor(ti) || (extraOn && ehMenor(xi)));
  }

  function copiarTitularComoResp() {
    if (!$('#xRTitular').checked) return;
    $('#xRNome').value = val('tNome');
    $('#xRCpf').value = fmtCPF(val('tCpf'));
    $('#xRCel').value = fmtCel(val('tCel'));
    $('#xREmail').value = val('tEmail');
  }
  function copiarEndereco() {
    if (!$('#xMesmoEnd').checked) return;
    $('#xEnd').value = val('tEnd');
    $('#xCep').value = fmtCEP(val('tCep'));
  }

  // Erros: chaves do servidor → campos da tela
  const CAMPO = { nome: 'Nome', sexo: 'Sexo', celular: 'Cel', email: 'Email', endereco: 'End', cep: 'Cep', cpf: 'Cpf', nascimento: 'Nasc' };
  function idDoErro(k) {
    const especiais = { privacidade: 'cA3', imagem: 'cA2', declaracaoResponsavel: 'cA1', pedido: 'modoCombo', extra: 'xNome' };
    if (especiais[k]) return especiais[k];
    const partes = k.split('.');
    let p = 't';
    if (partes[0] === 'extra') { p = 'x'; partes.shift(); }
    if (partes[0] === 'parentesco' && p === 'x') return 'xPar';
    if (partes[0] === 'responsavel') {
      p += 'R'; partes.shift();
      if (!partes.length) return p + 'Nome';
      if (partes[0] === 'parentesco') return p + 'Par';
    }
    return p + (CAMPO[partes[0]] || 'Nome');
  }

  function limparErros() {
    document.querySelectorAll('#turmaForm .err').forEach((e) => { e.textContent = ''; });
    document.querySelectorAll('#turmaForm [aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  }
  function status(msg, html = false) {
    const s = $('#formStatus');
    if (!s) return;
    if (html) s.innerHTML = msg; else s.textContent = msg;
  }
  function mostrarErros(erros) {
    let primeiro = null;
    const soltos = [];
    for (const [k, msg] of Object.entries(erros || {})) {
      const id = idDoErro(k);
      const input = $('#' + id);
      const e = $('#e' + id);
      if (input && e) {
        if (!e.textContent) e.textContent = msg;
        input.setAttribute('aria-invalid', 'true');
        if (!primeiro) primeiro = input;
      } else soltos.push(msg);
    }
    status(['Confira os campos destacados.'].concat(soltos).join(' '));
    if (primeiro) primeiro.focus();
  }

  const MENSAGENS = {
    cadeira_indisponivel: 'A cadeira extra está indisponível agora. Desmarque a cadeira extra para continuar.',
    codigo_invalido: 'Esse código de doação não é válido. Confira as letras e os números ou fale com o Kenji.',
    codigo_usado: 'Esse código de doação já foi usado em outra inscrição.',
    codigo_so_combo: 'O código de doação vale só para o combo das 3 noites.',
    noite_encerrada: 'Uma das noites escolhidas já começou e não está mais à venda. Escolha outra opção.',
    vendas_encerradas: 'As inscrições foram encerradas.',
    pedido_vazio: 'Escolha o combo ou pelo menos uma noite avulsa.',
    pedido_invalido: 'Escolha o combo ou pelo menos uma noite avulsa.',
  };

  async function enviar(e) {
    e.preventDefault();
    const btn = $('#btnInscrever');
    if (btn.disabled) return;
    limparErros();
    status('');
    const body = montarBody();
    const v = validarInscricao_(body, { imagemObrigatoria: estado ? estado.imagemObrigatoria : true });
    if (!v.ok) { mostrarErros(v.erros); return; }
    if (!endpoint) { status('As inscrições pelo site ainda não estão abertas. Fale com o Kenji no WhatsApp.'); return; }

    const p = precos();
    const exibido = calcularPedido_(normalizarPedido_(body.pedido), precosDoPedido(p));
    btn.disabled = true;
    const rotulo = btn.textContent;
    btn.textContent = 'Enviando…';
    status('Enviando sua inscrição…');
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      const r = await res.json();
      if (r && r.ok && r.status === 'pago') mostrarIsento(r, body.codigoBonus);
      else if (r && r.ok && r.status === 'pendente') mostrarPagamento(r, exibido.ok ? exibido.total : r.total);
      else if (r && r.ok && r.status === 'fila') mostrarFila(r);
      else if (r && r.erro === 'dados_invalidos') mostrarErros(r.erros);
      else {
        status((r && (r.mensagem || MENSAGENS[r.erro])) || 'Não foi possível concluir agora. Tente de novo ou fale com o Kenji no WhatsApp.');
        if (r && MENSAGENS[r.erro]) atualizar();
      }
    } catch (err) {
      status('Não conseguimos enviar agora. Verifique sua internet e tente de novo.');
    } finally {
      btn.disabled = false;
      btn.textContent = rotulo;
    }
  }

  // ---------- Resultado: Pix ou fila ----------
  function qrSvg(payload, label) {
    if (typeof qrcode !== 'function') return '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(payload);
      qr.make();
      return `<div class="qr" role="img" aria-label="${esc(label)}">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>`;
    } catch (err) { return ''; }
  }

  function concluir(html) {
    concluido = true;
    $('#turmaForm').hidden = true;
    $('#montador').hidden = true;
    $('#encerrado').hidden = true;
    const res = $('#resultado');
    res.innerHTML = html;
    res.hidden = false;
    const titulo = $('#resultadoTitulo');
    if (titulo) titulo.focus();
    try { history.replaceState(null, '', `${location.pathname}?reserva=${encodeURIComponent(reserva.codigo)}#inscricao`); } catch (err) { /* ignora */ }
  }

  function noitesDe(r) {
    const ns = r.noites || [];
    return ns.length === 3 ? 'as 3 noites (23, 24 e 25/11)' : ns.map(noiteTxt).join(' e ');
  }

  function mostrarPagamento(r, totalExibido) {
    reserva = r;
    let aviso = '';
    if (totalExibido != null && totalExibido !== r.total) {
      aviso = r.total > totalExibido
        ? `<p class="notice">A condição especial terminou antes do envio, então o valor foi atualizado para <strong>${brl(r.total)}</strong>.</p>`
        : `<p class="notice">O valor foi atualizado pelo servidor para <strong>${brl(r.total)}</strong>.</p>`;
    }
    const msg = `Olá, Kenji! Fiz o Pix da Turma 01 (Faixa Preta em IA). Código da reserva: ${r.codigo}. Valor: ${brl(r.total)}. Segue o comprovante.`;
    concluir(`
      <p class="success-badge">${icon('check')} Vaga reservada</p>
      <h2 id="resultadoTitulo" tabindex="-1">Falta só o Pix</h2>
      ${aviso}
      <p>Código da reserva: <strong class="codigo" id="codigoReserva">${esc(r.codigo)}</strong></p>
      <p class="pix-amount">Valor: <strong>${brl(r.total)}</strong></p>
      <ul class="turma-itens">${(r.itens || []).map((it) => `<li>${esc(it.descricao)}: ${brl(it.centavos)}</li>`).join('')}</ul>
      <p>Você vai para ${esc(noitesDe(r))}. Sua vaga e este preço ficam reservados por <strong id="reservaTimer">${mmss((r.expiraEm || 0) - agora())}</strong>.</p>
      <p class="notice" id="reservaExpirou" hidden>O tempo da reserva acabou. Se você já pagou, envie o comprovante mesmo assim. Se não, faça uma nova inscrição.</p>
      ${qrSvg(r.pix, `QR Code do Pix de ${brl(r.total)} para KENJI MARCOS SUZUKI`)}
      <div class="copy-box">
        <label for="pixCopia">Pix copia e cola</label>
        <input id="pixCopia" readonly value="${esc(r.pix)}">
        <button type="button" class="btn btn-sm" id="btnCopiar">${icon('copy')} Copiar código Pix</button>
      </div>
      <p class="pix-info">Recebedor: <b>KENJI MARCOS SUZUKI</b> · Barretos/SP</p>
      <ol class="steps">
        <li><span>1</span>Abra o app do seu banco e pague pelo QR Code ou pelo Pix copia e cola.</li>
        <li><span>2</span>Envie o comprovante pelo WhatsApp (17) 98159-6797.</li>
        <li><span>3</span>Com o Pix confirmado, você recebe o convite do grupo fechado da Turma 01.</li>
      </ol>
      ${ext(waKenji(msg), `${icon('whatsapp')} Enviar comprovante pelo WhatsApp`, 'class="btn btn-wa btn-block" id="btnComprovante"')}
      <p class="muted-text">Recibo ou nota fiscal: peça pelo mesmo WhatsApp. Garantia de 7 dias com reembolso integral via Pix.</p>`);
    $('#btnCopiar').addEventListener('click', copiarPix);
    tick();
  }

  // Código de doação sem cadeira extra: inscrição confirmada na hora, sem Pix.
  function mostrarIsento(r, codigoBonus) {
    reserva = r;
    const msg = `Olá, Kenji! Fiz minha inscrição na Turma 01 (Faixa Preta em IA) com um código de doação. Reserva: ${r.codigo}. Pode me mandar o convite do grupo?`;
    concluir(`
      <p class="success-badge">${icon('check')} Inscrição confirmada</p>
      <h2 id="resultadoTitulo" tabindex="-1">Inscrição confirmada com isenção!</h2>
      <p>Código da reserva: <strong class="codigo" id="codigoReserva">${esc(r.codigo)}</strong></p>
      <p>O combo das 3 noites (23, 24 e 25/11, das 20h30 às 22h30) foi liberado pelo código de doação${codigoBonus ? ` <strong>${esc(String(codigoBonus).toUpperCase())}</strong>` : ''}. Nenhum pagamento é necessário.</p>
      <p>Agora chame o Kenji no WhatsApp para receber o convite do grupo fechado da Turma 01.</p>
      ${ext(waKenji(msg), `${icon('whatsapp')} Receber o convite do grupo no WhatsApp`, 'class="btn btn-wa btn-block"')}
      <p class="muted-text">Venha com o celular carregado e com a sua conta Google. Não há tomada para carregar no local.</p>`);
  }

  function mostrarFila(r) {
    reserva = r;
    const lotadas = (r.lotadas || []).map(noiteTxt);
    const onde = lotadas.length ? ` para ${lotadas.join(' e ')}` : '';
    const msg = `Olá, Kenji! Entrei na fila de espera da Turma 01 (Faixa Preta em IA). Código: ${r.codigo}.`;
    concluir(`
      <h2 id="resultadoTitulo" tabindex="-1">Turma lotada${esc(onde)}</h2>
      <p>Sua inscrição entrou na <strong>fila de espera</strong> com o código <strong class="codigo" id="codigoReserva">${esc(r.codigo)}</strong>.</p>
      <p>Seus dados ficaram guardados. Se abrir vaga, o Kenji chama você no WhatsApp. Nenhum pagamento é necessário agora.</p>
      ${ext(waKenji(msg), `${icon('whatsapp')} Falar com o Kenji no WhatsApp`, 'class="btn btn-wa btn-block"')}`);
  }

  function mostrarStatusReserva(r) {
    reserva = r;
    const textos = {
      pago: ['Pagamento confirmado', 'Seu Pix foi confirmado. Se ainda não recebeu o convite do grupo da Turma 01, chame o Kenji no WhatsApp.'],
      fila: ['Você está na fila de espera', 'Se abrir vaga, o Kenji chama você no WhatsApp.'],
      expirada: ['Esta reserva expirou', 'O tempo para o Pix acabou. Se você já pagou, envie o comprovante pelo WhatsApp. Se não, faça uma nova inscrição abaixo.'],
      cancelada: ['Esta reserva foi cancelada', 'Faça uma nova inscrição abaixo ou fale com o Kenji no WhatsApp.'],
      reembolsado: ['Reserva reembolsada', 'O reembolso desta reserva foi registrado.'],
    };
    const [titulo, texto] = textos[r.status] || ['Reserva', ''];
    const res = $('#resultado');
    res.innerHTML = `<h2 id="resultadoTitulo" tabindex="-1">${esc(titulo)}</h2><p>Código: <strong class="codigo" id="codigoReserva">${esc(r.codigo)}</strong></p><p>${esc(texto)}</p>
      ${ext(waKenji(`Olá, Kenji! Sobre a minha reserva ${r.codigo} da Turma 01.`), `${icon('whatsapp')} Falar com o Kenji no WhatsApp`, 'class="btn btn-wa btn-block"')}`;
    res.hidden = false;
    if (r.status === 'pago' || r.status === 'fila' || r.status === 'reembolsado') { concluido = true; render(); }
  }

  async function consultarReserva(codigo) {
    if (!endpoint || !/^FP[2-9A-HJ-NP-Z]{6}$/.test(codigo)) return;
    try {
      const res = await fetch(`${endpoint}?action=reserva&codigo=${encodeURIComponent(codigo)}`, { cache: 'no-store' });
      const r = await res.json();
      if (!r || !r.ok) return;
      if (r.status === 'pendente') mostrarPagamento(r, r.total);
      else mostrarStatusReserva(r);
    } catch (err) { /* segue com a página normal */ }
  }

  async function copiarPix() {
    const input = $('#pixCopia');
    try { await navigator.clipboard.writeText(input.value); }
    catch (err) { input.select(); try { document.execCommand('copy'); } catch (e2) { /* ignora */ } }
    Site.toast('Código Pix copiado.');
  }

  // ---------- Prova social (só material autorizado) ----------
  function renderProva() {
    const itens = ((site.turma && site.turma.provaSocial) || []).filter((x) => x && x.autorizado === true && Site.safeUrl(x.imagem));
    const sec = $('#provaSocial');
    sec.hidden = !itens.length;
    $('#galeria').innerHTML = itens.map((x) => `
      <figure class="card turma-foto"><img src="${esc(Site.safeUrl(x.imagem))}" alt="${esc(x.alt || 'Foto de aula anterior')}" loading="lazy">
      ${x.legenda ? `<figcaption>${esc(x.legenda)}</figcaption>` : ''}</figure>`).join('');
  }

  // ---------- Eventos ----------
  function bind() {
    $('#montador').addEventListener('change', (e) => {
      if (e.target.id === 'modoCombo' && e.target.checked) [1, 2, 3].forEach((n) => { $('#noite' + n).checked = false; });
      renderPrecos();
    });
    $('#codigoBonus').addEventListener('input', () => renderPrecos());
    $('#trocarCombo').addEventListener('click', () => {
      $('#modoCombo').checked = true;
      [1, 2, 3].forEach((n) => { $('#noite' + n).checked = false; });
      renderPrecos();
      $('#modoCombo').focus();
    });
    const form = $('#turmaForm');
    form.addEventListener('submit', enviar);
    const reagir = (e) => {
      const t = e.target;
      if (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'date') mascarar(t);
      if (t.getAttribute('aria-invalid') === 'true' && t.type !== 'date') {
        t.removeAttribute('aria-invalid');
        const msg = document.getElementById('e' + t.id);
        if (msg) msg.textContent = '';
      }
      if (/Nasc$/.test(t.id)) atualizarIdades();
      if (t.id === 'xMesmoEnd' || t.id === 'tEnd' || t.id === 'tCep') copiarEndereco();
      if (t.id === 'xRTitular' || /^t(Nome|Cpf|Cel|Email)$/.test(t.id)) copiarTitularComoResp();
    };
    form.addEventListener('input', reagir);
    form.addEventListener('change', reagir);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizar(); });
    setInterval(tick, 1000);
    setInterval(atualizar, POLL_MS);
  }

  async function iniciar() {
    try { site = await Site.load(); } catch (err) { site = {}; }
    const name = (site.profile && site.profile.name) || '';
    if (name) $('#brandName').textContent = name;
    const url = String((site.turma && site.turma.endpoint) || '').trim();
    endpoint = ENDPOINT_RE.test(url) ? url : '';
    renderProva();
    montarForm();
    bind();
    if (site.contact) Site.init(site);
    await atualizar();
    const codigo = new URLSearchParams(location.search).get('reserva');
    if (codigo) await consultarReserva(codigo.toUpperCase());
  }

  window.TurmaPagina = { atualizar };
  iniciar();
})();
