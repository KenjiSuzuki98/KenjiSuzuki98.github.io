// Certificado pós-aula (certificado.html): dados do aluno → avaliação → 2 indicações → certificado.
// Tudo é enviado de uma vez só, no fim da etapa 3, para a planilha Google do responsável.
// O certificado é desenhado no próprio celular (canvas) e baixado em PDF ou PNG.
(() => {
  const C = window.CERTIFICADO || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ENDPOINT_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SAVE_KEY = 'certificado:' + (C.prefixoCodigo || 'cert');
  // Usa a mesma planilha das inscrições da aula (data/site.json → event.formEndpoint),
  // a não ser que certificado-config.js defina outra URL.
  let urlPlanilha = '';
  let carregandoUrl = Promise.resolve();
  const endpoint = () => { const u = String(C.endpoint || urlPlanilha || '').trim(); return ENDPOINT_RE.test(u) ? u : ''; };

  const state = { dados: null, pesquisa: null, indicacoes: [], codigo: '', teste: false };
  const box = $('#etapa');

  // ---------- Utilidades ----------
  const digits = (v) => String(v || '').replace(/\D/g, '');
  function phoneDigits(v) {
    let d = digits(v);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    return d;
  }
  function formatPhone(v) {
    const d = phoneDigits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  const clean = (v) => String(v || '').trim().replace(/\s+/g, ' ');
  // "MARIA DA SILVA" ou "maria da silva" → "Maria da Silva". Nomes já com maiúsculas ficam como estão.
  function nameCase(v) {
    const s = clean(v);
    if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
    return s.toLowerCase().split(' ').map((w, i) => (i > 0 && /^(de|da|do|das|dos|e|di|du|van|von)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }
  function localCode() {
    const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    const r = new Uint8Array(6);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => { r[i] = Math.random() * 256; });
    return (C.prefixoCodigo || 'CERT') + '-' + [...r].map((n) => abc[n % abc.length]).join('');
  }
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
    clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* sem armazenamento */ } },
  };

  function setError(input, id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    return !msg;
  }
  function focusFirstError() {
    const bad = box.querySelector('[aria-invalid="true"]');
    if (bad) bad.focus();
    return !bad;
  }
  function bindPhone(input) {
    input.addEventListener('input', () => { if (input.selectionStart === input.value.length) input.value = formatPhone(input.value); });
    input.addEventListener('blur', () => { input.value = formatPhone(input.value); });
  }
  function clearOnInput(form) {
    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true') {
        e.target.removeAttribute('aria-invalid');
        const msg = document.getElementById(e.target.getAttribute('aria-describedby'));
        if (msg) msg.textContent = '';
      }
      // Grupos de opções: o erro fica no fieldset.
      const fs = e.target.closest('fieldset[aria-invalid="true"]');
      if (fs) { fs.removeAttribute('aria-invalid'); const m = document.getElementById(fs.getAttribute('aria-describedby')); if (m) m.textContent = ''; }
    });
  }

  function go(step) {
    for (const li of document.querySelectorAll('#passos li')) {
      const n = Number(li.dataset.step);
      li.classList.toggle('is-done', n < step);
      li.classList.toggle('is-current', n === step);
      if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    }
    ({ 1: stepDados, 2: stepPesquisa, 3: stepIndicacoes, 4: stepCertificado })[step]();
    const h = box.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Etapa 1: dados do certificado ----------
  function stepDados() {
    const d = state.dados || {};
    box.innerHTML = `
      <h2>Dados do certificado</h2>
      <p class="muted-text">O nome sai no certificado exatamente como você escrever.</p>
      <form id="fDados" novalidate>
        <div class="field">
          <label for="cNome">Nome completo *</label>
          <input id="cNome" name="nome" autocomplete="name" required maxlength="90" value="${esc(d.nome)}" aria-describedby="eNome">
          <small class="err" id="eNome"></small>
        </div>
        <div class="field">
          <label for="cCel">Celular com WhatsApp *</label>
          <input id="cCel" name="celular" type="tel" inputmode="tel" autocomplete="tel-national" required maxlength="16" placeholder="(17) 99999-9999" value="${esc(d.celular ? formatPhone(d.celular) : '')}" aria-describedby="eCel">
          <small class="err" id="eCel"></small>
        </div>
        <div class="field">
          <label for="cEmail">E-mail *</label>
          <input id="cEmail" name="email" type="email" autocomplete="email" required maxlength="160" placeholder="voce@exemplo.com" value="${esc(d.email)}" aria-describedby="eEmail">
          <small class="err" id="eEmail"></small>
        </div>
        <div class="field">
          <label for="cEmpresa">Empresa ou profissão (opcional)</label>
          <input id="cEmpresa" name="empresa" autocomplete="organization" maxlength="90" value="${esc(d.empresa)}">
        </div>
        <div class="hp" aria-hidden="true">
          <label for="cSite">Deixe este campo vazio</label>
          <input id="cSite" name="website" tabindex="-1" autocomplete="off">
        </div>
        <label class="check-field">
          <input type="checkbox" id="cNovidades" name="novidades" ${d.novidades ? 'checked' : ''}>
          <span>Quero receber novidades e convites para as próximas turmas. (opcional)</span>
        </label>
        <p class="data-use">Usamos estes dados para emitir seu certificado e falar com você sobre este treinamento. Veja a <a href="privacidade.html">Política de Privacidade</a>.</p>
        <div class="certflow-preview" aria-live="polite"><small>Como vai sair no certificado</small><strong id="cPrevia">${esc(d.nome || 'Seu nome completo')}</strong></div>
        <button type="submit" class="btn btn-gold btn-block">Continuar</button>
      </form>`;
    const form = $('#fDados');
    const nome = $('#cNome');
    nome.addEventListener('input', () => { $('#cPrevia').textContent = clean(nome.value) || 'Seu nome completo'; });
    nome.addEventListener('blur', () => { nome.value = nameCase(nome.value); $('#cPrevia').textContent = nome.value || 'Seu nome completo'; });
    bindPhone($('#cCel'));
    clearOnInput(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = nameCase(nome.value);
      nome.value = n;
      const cel = phoneDigits($('#cCel').value);
      const email = clean($('#cEmail').value).toLowerCase();
      setError(nome, 'eNome', n.length < 5 ? 'Informe seu nome completo.' : !/\s/.test(n) ? 'Informe nome e sobrenome.' : '');
      setError($('#cCel'), 'eCel', cel.length === 10 || cel.length === 11 ? '' : 'Informe o celular com DDD. Ex.: (17) 99999-9999.');
      setError($('#cEmail'), 'eEmail', EMAIL_RE.test(email) ? '' : 'Informe um e-mail válido. Ex.: voce@exemplo.com.');
      if (!focusFirstError()) return;
      state.robo = !!$('#cSite').value;
      state.dados = { nome: n, celular: '55' + cel, email, empresa: clean($('#cEmpresa').value), novidades: $('#cNovidades').checked };
      go(2);
    });
  }

  // ---------- Etapa 2: avaliação rápida ----------
  const PERGUNTAS = [
    { id: 'nps', req: true, tipo: 'escala', de: 0, ate: 10, txt: 'De 0 a 10, quanto você indicaria este treinamento para um amigo ou colega?', min: 'Nada provável', max: 'Com certeza' },
    { id: 'geral', req: true, tipo: 'escala', de: 1, ate: 5, txt: 'Qual sua nota geral para o treinamento?', min: 'Ruim', max: 'Excelente' },
    { id: 'aplicavel', tipo: 'opcoes', txt: 'O conteúdo serve para o seu dia a dia ou trabalho?', ops: ['Sim, muito', 'Em parte', 'Pouco'] },
    { id: 'didatica', tipo: 'escala', de: 1, ate: 5, txt: 'Como foi a didática do instrutor?', min: 'Ruim', max: 'Excelente' },
    { id: 'ritmo', tipo: 'opcoes', txt: 'O ritmo das aulas foi…', ops: ['Rápido demais', 'Na medida', 'Devagar demais'] },
    { id: 'gostou', tipo: 'texto', txt: 'O que você mais gostou?' },
    { id: 'melhorar', tipo: 'texto', txt: 'O que podemos melhorar?' },
    { id: 'aplicacao', req: true, tipo: 'texto', txt: 'Qual aplicação você gostaria de criar que revolucionaria seu negócio ou dia a dia?', dica: 'Ex.: um app que responde clientes no WhatsApp, um controle de estoque que avisa quando acabar…' },
    { id: 'proximo', tipo: 'opcoes', txt: 'Quer continuar aprendendo com a gente?', ops: ['Quero saber da próxima turma', 'Quero IA na minha empresa', 'Agora não'] },
  ];

  function pergunta(p, valor) {
    const label = `${esc(p.txt)}${p.req ? ' *' : ' <small>(opcional)</small>'}`;
    if (p.tipo === 'texto') {
      const desc = [p.dica ? `d_${p.id}` : '', p.req ? `e_${p.id}` : ''].filter(Boolean).join(' ');
      return `<div class="field"><label for="q_${p.id}">${label}</label>${p.dica ? `<small id="d_${p.id}">${esc(p.dica)}</small>` : ''}<textarea id="q_${p.id}" name="${p.id}" rows="${p.req ? 3 : 2}" maxlength="500"${p.req ? ' required' : ''}${desc ? ` aria-describedby="${desc}"` : ''}>${esc(valor)}</textarea>${p.req ? `<small class="err" id="e_${p.id}"></small>` : ''}</div>`;
    }
    const ops = p.tipo === 'escala' ? Array.from({ length: p.ate - p.de + 1 }, (_, i) => String(p.de + i)) : p.ops;
    const cls = p.tipo === 'escala' ? `chips chips-escala chips-${ops.length}` : 'chips chips-texto';
    return `
      <fieldset class="certflow-q" id="fs_${p.id}" aria-describedby="e_${p.id}">
        <legend>${label}</legend>
        <div class="${cls}">
          ${ops.map((o, i) => `<label class="opc"><input type="radio" name="${p.id}" value="${esc(o)}" ${String(valor) === o ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}
        </div>
        ${p.min ? `<p class="chips-legenda"><span>${esc(p.min)}</span><span>${esc(p.max)}</span></p>` : ''}
        <small class="err" id="e_${p.id}"></small>
      </fieldset>`;
  }

  function stepPesquisa() {
    const v = state.pesquisa || {};
    box.innerHTML = `
      <h2>Avaliação rápida</h2>
      <p class="muted-text">Sua opinião ajuda a melhorar as próximas turmas. As perguntas com * são obrigatórias.</p>
      <form id="fPesquisa" novalidate>
        ${PERGUNTAS.map((p) => pergunta(p, v[p.id])).join('')}
        <label class="check-field">
          <input type="checkbox" id="qDepoimento" name="depoimento" ${v.depoimento ? 'checked' : ''}>
          <span>Autorizo usar meu comentário, com meu primeiro nome, como depoimento sobre o treinamento. (opcional)</span>
        </label>
        <div class="certflow-nav">
          <button type="button" class="btn" id="voltar">Voltar</button>
          <button type="submit" class="btn btn-gold">Continuar</button>
        </div>
      </form>`;
    const form = $('#fPesquisa');
    clearOnInput(form);
    $('#voltar').addEventListener('click', () => { state.pesquisa = ler(form); go(1); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = ler(form);
      for (const p of PERGUNTAS.filter((q) => q.req)) {
        if (p.tipo === 'texto') setError($('#q_' + p.id), 'e_' + p.id, r[p.id].length < 5 ? 'Conte em poucas palavras a aplicação que você gostaria de criar.' : '');
        else setError($('#fs_' + p.id), 'e_' + p.id, r[p.id] === '' ? 'Escolha uma nota.' : '');
      }
      const bad = form.querySelector('fieldset[aria-invalid="true"] input, textarea[aria-invalid="true"]');
      if (bad) { bad.focus(); return; }
      state.pesquisa = r;
      go(3);
    });
  }
  function ler(form) {
    const r = {};
    for (const p of PERGUNTAS) {
      if (p.tipo === 'texto') r[p.id] = clean(form.elements[p.id].value);
      else { const c = form.querySelector(`input[name="${p.id}"]:checked`); r[p.id] = c ? c.value : ''; }
    }
    r.depoimento = $('#qDepoimento').checked;
    return r;
  }

  // ---------- Etapa 3: indicações ----------
  function stepIndicacoes() {
    const ind = state.indicacoes;
    const bloco = (i) => {
      const x = ind[i] || {};
      return `
        <fieldset class="certflow-ind">
          <legend>Indicação ${i + 1}</legend>
          <div class="field">
            <label for="iNome${i}">Nome *</label>
            <input id="iNome${i}" maxlength="90" autocomplete="off" value="${esc(x.nome)}" aria-describedby="eiNome${i}">
            <small class="err" id="eiNome${i}"></small>
          </div>
          <div class="field">
            <label for="iTel${i}">Telefone ou WhatsApp *</label>
            <input id="iTel${i}" type="tel" inputmode="tel" maxlength="16" autocomplete="off" placeholder="(17) 99999-9999" value="${esc(x.telefone ? formatPhone(x.telefone) : '')}" aria-describedby="eiTel${i}">
            <small class="err" id="eiTel${i}"></small>
          </div>
          <div class="field">
            <label for="iEmp${i}">Empresa (opcional)</label>
            <input id="iEmp${i}" maxlength="90" autocomplete="off" value="${esc(x.empresa)}">
          </div>
        </fieldset>`;
    };
    box.innerHTML = `
      <h2>Quem mais deveria fazer este treinamento?</h2>
      <p class="muted-text">Indique 2 pessoas que você acha que aproveitariam. Vamos chamá-las uma única vez, dizendo que a indicação foi sua.</p>
      <form id="fInd" novalidate>
        ${bloco(0)}${bloco(1)}
        <label class="check-field">
          <input type="checkbox" id="iOk" aria-describedby="eiOk">
          <span>Essas pessoas sabem da indicação e aceitam receber um contato sobre o treinamento. *</span>
        </label>
        <small class="err certflow-err-check" id="eiOk"></small>
        <div class="certflow-nav">
          <button type="button" class="btn" id="voltar">Voltar</button>
          <button type="submit" class="btn btn-gold" id="enviar">Gerar meu certificado</button>
        </div>
        ${C.indicacoesObrigatorias === false ? '<button type="button" class="btn-link" id="pular">Pular esta etapa</button>' : ''}
        <p class="form-status" id="status" role="status"></p>
      </form>`;
    const form = $('#fInd');
    bindPhone($('#iTel0')); bindPhone($('#iTel1'));
    clearOnInput(form);
    const lerInd = () => [0, 1].map((i) => ({ nome: nameCase($('#iNome' + i).value), telefone: phoneDigits($('#iTel' + i).value), empresa: clean($('#iEmp' + i).value) }));
    $('#voltar').addEventListener('click', () => { state.indicacoes = lerInd(); go(2); });
    const pular = $('#pular');
    if (pular) pular.addEventListener('click', () => { state.indicacoes = []; enviar(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const ind2 = lerInd();
      const own = phoneDigits(state.dados.celular);
      ind2.forEach((x, i) => {
        setError($('#iNome' + i), 'eiNome' + i, x.nome.length < 2 ? 'Informe o nome.' : '');
        let msg = x.telefone.length === 10 || x.telefone.length === 11 ? '' : 'Informe o telefone com DDD.';
        if (!msg && x.telefone === own) msg = 'Este é o seu número. Indique outra pessoa.';
        if (!msg && i === 1 && x.telefone === ind2[0].telefone) msg = 'Indique duas pessoas diferentes.';
        setError($('#iTel' + i), 'eiTel' + i, msg);
      });
      setError($('#iOk'), 'eiOk', $('#iOk').checked ? '' : 'Confirme que as pessoas aceitam o contato.');
      if (!focusFirstError()) return;
      state.indicacoes = ind2.map((x) => ({ ...x, telefone: '55' + x.telefone }));
      enviar();
    });
  }

  async function enviar() {
    const btn = $('#enviar');
    const status = $('#status');
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    await carregandoUrl;
    const url = endpoint();
    if (state.robo) { state.codigo = localCode(); go(4); return; }
    if (!url) { state.codigo = localCode(); state.teste = true; finalizar(); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Gerando…'; }
    if (status) status.textContent = 'Enviando suas respostas…';
    try {
      const res = await fetch(url, {
        method: 'POST',
        // text/plain evita o "preflight" de CORS, que o Google Apps Script não responde.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ tipo: 'certificado', turma: C.turma || '', prefixo: C.prefixoCodigo || '', dados: state.dados, pesquisa: state.pesquisa, indicacoes: state.indicacoes, website: '' }),
      });
      const out = await res.json();
      if (!res.ok || !out || out.ok !== true || !out.codigo) throw new Error('falha');
      state.codigo = String(out.codigo).slice(0, 40);
      finalizar();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Tentar de novo'; }
      if (status) status.textContent = 'Não conseguimos enviar agora. Verifique sua internet e toque em "Tentar de novo".';
    }
  }
  function finalizar() {
    store.set({ nome: state.dados.nome, codigo: state.codigo, teste: state.teste });
    go(4);
  }

  // ---------- Etapa 4: certificado ----------
  function stepCertificado() {
    const primeiro = (state.dados.nome || '').split(' ')[0];
    box.innerHTML = `
      <p class="success-badge">Certificado liberado</p>
      <h2>Parabéns, ${esc(primeiro)}!</h2>
      ${state.teste ? '<p class="notice">Modo de teste: a planilha ainda não está ligada, então estas respostas não foram salvas.</p>' : ''}
      <p class="muted-text">Baixe agora e guarde. Se fechar a página, é só abrir o mesmo link neste celular para baixar de novo.</p>
      <div class="certflow-canvas"><canvas id="certCanvas" role="img" aria-label="Certificado de ${esc(state.dados.nome)}"></canvas></div>
      <div class="certflow-actions">
        <button type="button" class="btn btn-gold btn-block" id="baixarPdf" disabled>Baixar em PDF</button>
        <button type="button" class="btn btn-block" id="baixarPng" disabled>Baixar como imagem (PNG)</button>
        <button type="button" class="btn btn-block" id="compartilhar" hidden>Compartilhar</button>
      </div>
      <p class="certflow-codigo">Código do certificado: <strong>${esc(state.codigo)}</strong></p>
      <button type="button" class="btn-link" id="refazer">Não é você? Preencher para outra pessoa</button>`;
    $('#refazer').addEventListener('click', () => {
      store.clear();
      Object.assign(state, { dados: null, pesquisa: null, indicacoes: [], codigo: '', teste: false });
      go(1);
    });
    desenhar($('#certCanvas')).then((ok) => {
      if (!ok) { $('#baixarPdf').closest('.certflow-actions').insertAdjacentHTML('beforebegin', '<p class="notice">Seu navegador não conseguiu desenhar o certificado. Tente abrir o link no Chrome ou no Safari.</p>'); return; }
      ligarDownloads($('#certCanvas'));
    });
  }

  const nomeArquivo = () => 'certificado-' + (state.dados.nome || 'aluno').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function ligarDownloads(canvas) {
    const pdf = $('#baixarPdf'), png = $('#baixarPng'), share = $('#compartilhar');
    pdf.disabled = false; png.disabled = false;
    const pngBlob = () => new Promise((r) => canvas.toBlob(r, 'image/png'));
    const pdfBlob = async () => {
      const jpg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
      return pdfFromJpeg(new Uint8Array(await jpg.arrayBuffer()), canvas.width, canvas.height);
    };
    const baixar = (blob, ext) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nomeArquivo() + '.' + ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    };
    pdf.addEventListener('click', async () => baixar(await pdfBlob(), 'pdf'));
    png.addEventListener('click', async () => baixar(await pngBlob(), 'png'));
    // Celular: compartilhar direto no WhatsApp, Drive, e-mail…
    pdfBlob().then((blob) => {
      const file = new File([blob], nomeArquivo() + '.pdf', { type: 'application/pdf' });
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) return;
      share.hidden = false;
      share.addEventListener('click', () => navigator.share({ files: [file], title: 'Meu certificado' }).catch(() => {}));
    }).catch(() => {});
  }

  // ---------- Desenho do certificado ----------
  function carregarImagem(src) {
    return new Promise((ok, falha) => { const img = new Image(); img.onload = () => ok(img); img.onerror = falha; img.src = src; });
  }
  async function fontes() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all(['700 40px "Space Grotesk"', '600 40px "Space Grotesk"', '400 20px Inter', '600 20px Inter', '500 20px Inter'].map((f) => document.fonts.load(f)));
    } catch (e) { /* usa a fonte reserva */ }
  }
  // Define a fonte no maior tamanho (até "tamanho") em que o texto cabe na largura; devolve esse tamanho.
  function ajustar(ctx, texto, tamanho, largura, peso, fonte) {
    let t = tamanho + 2;
    do { t -= 2; ctx.font = `${peso} ${t}px "${fonte}", Inter, Arial, sans-serif`; } while (ctx.measureText(texto).width > largura && t > 10);
    return t;
  }
  function quebrar(ctx, texto, largura) {
    const linhas = []; let atual = '';
    for (const p of texto.split(' ')) {
      const teste = atual ? atual + ' ' + p : p;
      if (ctx.measureText(teste).width > largura && atual) { linhas.push(atual); atual = p; } else atual = teste;
    }
    if (atual) linhas.push(atual);
    return linhas;
  }

  async function desenhar(canvas) {
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return false;
    await fontes();
    const valores = { nome: state.dados.nome, codigo: `Código ${state.codigo} · ${C.dataEmissao || ''}`.replace(/ · $/, '') };
    if (C.imagem) {
      try {
        const img = await carregarImagem(C.imagem);
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        for (const [k, f] of Object.entries(C.campos || {})) {
          if (!valores[k]) continue;
          ctx.fillStyle = f.cor || '#111'; ctx.textAlign = f.alinhamento || 'center'; ctx.textBaseline = 'middle';
          const base = Math.round((f.tamanho || 0.05) * canvas.height);
          const larg = (f.largura || 0.8) * canvas.width;
          const x = (f.x == null ? 0.5 : f.x) * canvas.width, y = (f.y == null ? 0.5 : f.y) * canvas.height;
          const caberia = ajustar(ctx, valores[k], base, larg, f.peso || 600, f.fonte || 'Inter');
          const palavras = valores[k].split(' ');
          // Nome muito comprido: em vez de ficar minúsculo, quebra em 2 linhas equilibradas.
          if (k === 'nome' && caberia < base * 0.72 && palavras.length > 2) {
            let melhor = 1, dif = Infinity;
            for (let i = 1; i < palavras.length; i++) {
              const d = Math.abs(palavras.slice(0, i).join(' ').length - palavras.slice(i).join(' ').length);
              if (d < dif) { dif = d; melhor = i; }
            }
            const l1 = palavras.slice(0, melhor).join(' '), l2 = palavras.slice(melhor).join(' ');
            const t = Math.min(ajustar(ctx, l1, Math.round(base * 0.68), larg, f.peso || 600, f.fonte || 'Inter'),
              ajustar(ctx, l2, Math.round(base * 0.68), larg, f.peso || 600, f.fonte || 'Inter'));
            ctx.font = `${f.peso || 600} ${t}px "${f.fonte || 'Inter'}", Inter, Arial, sans-serif`;
            ctx.fillText(l1, x, y - t * 0.58);
            ctx.fillText(l2, x, y + t * 0.58);
          } else {
            ctx.fillText(valores[k], x, y);
          }
        }
        return true;
      } catch (e) { /* arte não encontrada: usa o modelo padrão */ }
    }
    padrao(ctx, canvas, valores);
    return true;
  }

  // Modelo padrão, A4 deitado (2480 x 1754 px ≈ 210 dpi), nas cores do site.
  function padrao(ctx, canvas, valores) {
    const W = 2480, H = 1754;
    canvas.width = W; canvas.height = H;
    const navy = '#0a0f1f', gold = '#f5b544', ink = '#1b2036', soft = '#5a6180';
    ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = navy; ctx.fillRect(0, 0, W, 70); ctx.fillRect(0, H - 70, W, 70);
    ctx.strokeStyle = gold; ctx.lineWidth = 6; ctx.strokeRect(110, 140, W - 220, H - 280);
    ctx.lineWidth = 2; ctx.strokeRect(132, 162, W - 264, H - 324);

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const linha = (txt, y, font, cor) => { ctx.font = font; ctx.fillStyle = cor; ctx.fillText(txt, W / 2, y); };
    ctx.save(); ctx.font = '600 38px Inter, Arial, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
    ctx.fillStyle = soft; ctx.fillText('CERTIFICADO DE CONCLUSÃO', W / 2, 330); ctx.restore();
    linha(C.titulo || 'Certificado', 450, '700 110px "Space Grotesk", Inter, Arial, sans-serif', navy);
    linha('Certificamos que', 580, '400 44px Inter, Arial, sans-serif', soft);

    ctx.fillStyle = ink; ajustar(ctx, valores.nome, 120, W - 600, 700, 'Space Grotesk');
    ctx.fillText(valores.nome, W / 2, 730);
    ctx.fillStyle = gold; ctx.fillRect(W / 2 - 520, 770, 1040, 5);

    ctx.font = '400 42px Inter, Arial, sans-serif'; ctx.fillStyle = ink;
    const corpo = `concluiu o treinamento ${C.curso || ''}${C.turma ? ` (${C.turma})` : ''}, ${C.periodo || ''}${C.cargaHoraria ? `, com carga horária de ${C.cargaHoraria}` : ''}.`;
    let y = 870;
    for (const l of quebrar(ctx, corpo, W - 760)) { ctx.fillText(l, W / 2, y); y += 62; }
    if ((C.modulos || []).length) {
      y += 20;
      ctx.font = '500 36px Inter, Arial, sans-serif'; ctx.fillStyle = soft;
      ctx.fillText(C.modulos.map((m, i) => `${i + 1}. ${m}`).join('   ·   '), W / 2, y, W - 500);
    }

    // Local/data à esquerda, assinatura à direita.
    const base = H - 330;
    ctx.textAlign = 'center';
    ctx.font = '400 38px Inter, Arial, sans-serif'; ctx.fillStyle = ink;
    ctx.fillText(`${C.local || ''}${C.local && C.dataEmissao ? ', ' : ''}${C.dataEmissao || ''}.`, W * 0.3, base + 40);
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.7 - 300, base); ctx.lineTo(W * 0.7 + 300, base); ctx.stroke();
    ctx.font = '600 40px Inter, Arial, sans-serif'; ctx.fillText(C.instrutor || '', W * 0.7, base + 56);
    ctx.font = '400 34px Inter, Arial, sans-serif'; ctx.fillStyle = soft; ctx.fillText(C.cargoInstrutor || '', W * 0.7, base + 102);

    ctx.font = '500 30px Inter, Arial, sans-serif'; ctx.fillStyle = soft;
    ctx.fillText(valores.codigo, W / 2, H - 196);
  }

  // PDF de uma página com a imagem JPEG ocupando tudo (sem bibliotecas externas).
  // Largura de uma folha A4 deitada; a altura segue a proporção da arte, sem distorcer.
  function pdfFromJpeg(jpg, w, h) {
    const enc = (s) => new TextEncoder().encode(s);
    const PW = 841.89, PH = Math.round((841.89 * h / w) * 100) / 100;
    const parts = []; const off = []; let len = 0;
    const push = (u) => { parts.push(u); len += u.length; };
    const obj = (n, dict, stream) => {
      off[n] = len;
      push(enc(`${n} 0 obj\n${dict}\n`));
      if (stream) { push(enc('stream\n')); push(stream); push(enc('\nendstream\n')); }
      push(enc('endobj\n'));
    };
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4 + binário
    const conteudo = enc(`q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`);
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    obj(4, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
    obj(5, `<< /Length ${conteudo.length} >>`, conteudo);
    const xref = len;
    let x = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) x += String(off[i]).padStart(10, '0') + ' 00000 n \n';
    push(enc(`${x}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    return new Blob(parts, { type: 'application/pdf' });
  }
  window.CertificadoPDF = pdfFromJpeg; // usado nos testes

  // ---------- Início ----------
  $('#turmaLabel').textContent = [C.titulo, C.turma].filter(Boolean).join(' · ') || 'Certificado';
  $('#cursoTitulo').textContent = 'Seu certificado';
  const salvo = store.get();
  if (salvo && salvo.nome && salvo.codigo) {
    Object.assign(state, { dados: { nome: salvo.nome }, codigo: salvo.codigo, teste: !!salvo.teste });
    go(4);
  } else go(1);
  if (!C.endpoint) {
    carregandoUrl = fetch('data/site.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then((d) => { urlPlanilha = (d && d.event && d.event.formEndpoint) || ''; })
      .catch(() => {});
  }
})();
