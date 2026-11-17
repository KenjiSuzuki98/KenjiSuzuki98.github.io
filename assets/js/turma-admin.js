// Painel da Turma 01 (turma-admin.html): botões A e B da live, vagas por noite,
// inscrições por status, marcar pago, fila, reembolso, vale R$ 10 e exportação.
// A senha fica no Apps Script; aqui guardamos só um token temporário na sessão.
(() => {
  const { $, esc, waLink } = Site;
  const ENDPOINT_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
  const TOKEN_KEY = 'turma-admin-token';
  const brl = (c) => centavosBRL_(c);
  const ERROS = {
    senha_incorreta: 'Senha incorreta.',
    bloqueado: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.',
    senha_nao_configurada: 'A senha do painel ainda não foi configurada no Apps Script (ADMIN_SENHA, mínimo 10 caracteres).',
    nao_autorizado: 'Sua sessão expirou. Entre de novo.',
    sem_vaga: 'Não há vaga para esta reserva em todas as noites dela.',
    status_invalido: 'Esta ação não vale para o status atual da reserva.',
    nao_encontrada: 'Reserva não encontrada. Atualize a lista.',
    reembolsada: 'Esta reserva já foi reembolsada.',
  };

  let endpoint = '';
  let dados = null;
  let offset = 0;
  let aba = 'pendente';
  const agora = () => Date.now() + offset;
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const token = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } };
  const setToken = (t) => { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignora */ } };
  const aviso = (msg) => { $('#painelStatus').textContent = msg; };

  async function post(body) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return res.json();
  }
  async function admin(op, extra = {}) {
    try {
      const r = await post({ acao: 'admin', token: token(), op, ...extra });
      if (r && r.erro === 'nao_autorizado') sair(ERROS.nao_autorizado);
      return r || { ok: false };
    } catch (e) {
      aviso('Sem conexão com o servidor. Confira a internet e toque em "Atualizar lista".');
      return { ok: false, erro: 'rede' };
    }
  }

  // ---------- Login ----------
  async function entrar(e) {
    e.preventDefault();
    const st = $('#loginStatus');
    if (!endpoint) { st.textContent = 'Endereço do servidor (turma.endpoint) não configurado em data/site.json.'; return; }
    st.textContent = 'Entrando…';
    try {
      const r = await post({ acao: 'login', senha: $('#senha').value });
      $('#senha').value = '';
      if (!r.ok) { st.textContent = ERROS[r.erro] || 'Não foi possível entrar.'; return; }
      setToken(r.token);
      st.textContent = '';
      await abrirPainel();
    } catch (err) { st.textContent = 'Sem conexão com o servidor.'; }
  }
  function sair(msg) {
    setToken('');
    dados = null;
    $('#painel').hidden = true;
    $('#login').hidden = false;
    $('#loginStatus').textContent = msg || '';
  }
  async function abrirPainel() {
    $('#login').hidden = true;
    $('#painel').hidden = false;
    await carregar();
  }

  // ---------- Dados ----------
  async function carregar() {
    const r = await admin('listar');
    if (!r.ok) return;
    dados = r;
    offset = r.agora - Date.now();
    render();
  }

  function render() {
    if (!dados) return;
    const d = dados;
    for (const n of [1, 2, 3]) {
      const noite = TURMA.noites[n - 1];
      $('#contNoite' + n).textContent = `Noite ${n} (${noite.data}): ${d.ocupacao[n] || 0} / ${d.capacidade.oficial} (máx. ${d.capacidade.maxima})`;
    }
    $('#chkVendas').checked = !!d.vendasAbertas;
    $('#chkImagem').checked = !!d.imagemObrigatoria;
    const contagem = {};
    d.reservas.forEach((r) => { contagem[r.status] = (contagem[r.status] || 0) + 1; });
    document.querySelectorAll('[data-aba]').forEach((b) => {
      const k = b.dataset.aba;
      const n = k === 'todas' ? d.reservas.length : contagem[k] || 0;
      b.textContent = `${b.textContent.replace(/\s*\(\d+\)$/, '')} (${n})`;
      b.setAttribute('aria-pressed', String(k === aba));
      b.classList.toggle('active', k === aba);
    });
    const ordenadas = d.reservas.slice().sort((a, b) => a.criadoEm - b.criadoEm);
    $('#lista').innerHTML = ordenadas.map(cartao).join('') || '<p class="muted-text">Nenhuma inscrição ainda.</p>';
    filtrar();
    tick();
  }

  function filtrar() {
    let visiveis = 0;
    document.querySelectorAll('#lista [data-codigo]').forEach((c) => {
      c.hidden = !(aba === 'todas' || c.dataset.status === aba);
      if (!c.hidden) visiveis++;
    });
    let vazio = $('#listaVazia');
    if (!vazio) { vazio = document.createElement('p'); vazio.id = 'listaVazia'; vazio.className = 'muted-text'; $('#lista').append(vazio); }
    vazio.textContent = visiveis ? '' : 'Nenhuma inscrição neste status.';
  }

  const ROTULO = { pendente: 'Aguardando Pix', pago: 'Pago', fila: 'Fila de espera', expirada: 'Expirada', cancelada: 'Liberada', reembolsado: 'Reembolsada' };
  const PARENTESCO = { conjuge: 'cônjuge', filho: 'filho(a)' };
  const noitesTxt = (ns) => (ns.length === 3 ? 'Noites 1, 2 e 3' : ns.map((n) => `Noite ${n} (${TURMA.noites[n - 1].data})`).join(', '));
  const dataHora = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
  const primeiroNome = (n) => String(n || '').split(' ')[0];

  function pessoaTxt(p) {
    if (!p) return '';
    const resp = p.responsavel ? `<br><small>Responsável: ${esc(p.responsavel.nome)} (${esc(p.responsavel.parentesco)}) · ${esc(Site.formatPhone(p.responsavel.celular))}</small>` : '';
    return `${esc(p.nome)}${p.menor ? ' <span class="tag tag-warn">menor</span>' : ''}<br><small>CPF ${esc(p.cpf)} · ${esc(Site.formatPhone(p.celular))} · ${esc(p.email)}</small>${resp}`;
  }

  function botao(op, texto, extra = '') { return `<button type="button" class="btn btn-sm" data-op="${op}" ${extra}>${texto}</button>`; }
  function linkMsg(tipo, r, texto) {
    const tel = (r.titular && r.titular.celular) || '';
    return tel ? `<a class="btn btn-sm btn-wa" data-msg="${tipo}" href="${esc(waLink(tel, mensagem(tipo, r)))}" target="_blank" rel="noopener noreferrer">${texto}<span class="sr-only"> (abre em nova aba)</span></a>` : '';
  }

  function cartao(r) {
    const s = r.status;
    const acoes = [];
    if (s === 'pendente' || s === 'expirada' || s === 'fila' || s === 'cancelada') acoes.push(botao('pagar', 'Marcar pago'));
    if (s === 'pendente' || s === 'expirada') acoes.push(botao('estender', 'Estender 5 min'));
    if (s === 'fila' || s === 'cancelada') acoes.push(botao('promover', 'Promover (5 min para pagar)'));
    if (s === 'pendente' || s === 'expirada' || s === 'fila') acoes.push(botao('liberar', 'Liberar vaga'));
    if (s === 'pago') acoes.push(botao('reembolsar', 'Marcar reembolsado'));
    if (s === 'pago' && r.primeiro) acoes.push(botao('vale', r.vale === 'entregue' ? 'Desmarcar vale R$ 10' : 'Vale R$ 10 entregue'));
    if (s === 'pago') acoes.push(linkMsg('confirmacao', r, 'Enviar confirmação + grupo'));
    if (s === 'pendente') acoes.push(linkMsg('lembrete', r, 'Lembrar do Pix'));
    if (s === 'fila') acoes.push(linkMsg('fila', r, 'Avisar: está na fila'));
    if (s === 'expirada') acoes.push(linkMsg('expirada', r, 'Avisar: reserva expirou'));
    const x = r.extraPessoa;
    return `
      <article class="card ta-card" data-codigo="${esc(r.codigo)}" data-status="${esc(s)}">
        <div class="card-body">
          <h3><span class="codigo">${esc(r.codigo)}</span> <span class="tag tag-${esc(s)}">${esc(ROTULO[s] || s)}</span>
            ${r.primeiro ? `<span class="tag tag-gold">${r.primeiro}º inscrito · vale R$ 10${r.vale === 'entregue' ? ' entregue' : ''}</span>` : ''}</h3>
          <p>${pessoaTxt(r.titular)}</p>
          ${x ? `<p><small>Cadeira extra (${esc(PARENTESCO[x.parentesco] || x.parentesco)}):</small> ${pessoaTxt(x)}</p>` : ''}
          <p><small>${esc(r.tipo === 'combo' ? 'Combo' : 'Avulso')} · ${esc(noitesTxt(r.noites))} · ${r.pessoas} pessoa(s) · <strong>${brl(r.total)}</strong>${r.promoA ? ' · promo A' : ''}${r.promoB ? ' · promo B' : ''}</small></p>
          <p><small>Inscrição ${esc(dataHora(r.criadoEm))}${r.pagoEm ? ` · paga ${esc(dataHora(r.pagoEm))}` : ''}${s === 'pendente' ? ` · expira em <strong data-expira="${Number(r.expiraEm)}"></strong>` : ''}
            · imagem: ${r.consentimentos && r.consentimentos.imagem ? 'autorizou' : '<strong>não autorizou</strong>'}</small></p>
          <div class="card-actions">${acoes.join('')}</div>
        </div>
      </article>`;
  }

  // ---------- Mensagens de WhatsApp para o inscrito ----------
  function linkReserva(codigo) {
    try { return new URL(`turma.html?reserva=${codigo}`, location.href).href; } catch (e) { return `turma.html?reserva=${codigo}`; }
  }
  function mensagem(tipo, r) {
    const nome = primeiroNome(r.titular && r.titular.nome);
    const noites = noitesTxt(r.noites);
    if (tipo === 'confirmacao') {
      return [
        `Olá, ${nome}! Seu Pix da Turma 01 do treinamento "${TURMA.nome}" foi confirmado.`,
        `Código: ${r.codigo} · ${noites} · Total: ${brl(r.total)}`,
        dados && dados.grupo ? `Entre no grupo fechado da Turma 01: ${dados.grupo}` : 'O convite do grupo fechado da Turma 01 vai em seguida.',
        `Local: ${TURMA.endereco}. Recepção às ${TURMA.horario.recepcao}, aula das ${TURMA.horario.aula}.`,
        'Venha com o celular carregado e, se puder, traga um power bank: não há tomada para carregar no local.',
        'Entre com a sua conta Google no celular e, se puder, crie uma segunda conta Google.',
        'Recibo ou nota fiscal: é só pedir por aqui.',
        'Garantia de 7 dias: reembolso integral via Pix, pedido por aqui, mesmo depois de participar de uma noite.',
      ].join('\n');
    }
    if (tipo === 'lembrete') return `Olá, ${nome}! Sua vaga na Turma 01 (${noites}) está reservada e aguardando o Pix de ${brl(r.total)}. Para pagar: ${linkReserva(r.codigo)} Depois, me envie o comprovante por aqui.`;
    if (tipo === 'fila') return `Olá, ${nome}! A Turma 01 lotou para ${noites} e sua inscrição (${r.codigo}) está na fila de espera. Seus dados estão guardados: se abrir vaga, eu chamo você por aqui.`;
    if (tipo === 'expirada') return `Olá, ${nome}! O tempo da sua reserva ${r.codigo} na Turma 01 acabou antes do Pix. Se ainda quiser participar, me chame por aqui que eu vejo se ainda há vaga.`;
    return '';
  }

  // ---------- Ações ----------
  const CONFIRMAR = {
    pagar: (r) => `Confirmar o Pix de ${brl(r.total)} da reserva ${r.codigo} (${r.titular.nome})? Confira no app do banco antes.`,
    liberar: (r) => `Liberar a vaga da reserva ${r.codigo} (${r.titular.nome})?`,
    reembolsar: (r) => `Marcar a reserva ${r.codigo} (${r.titular.nome}) como reembolsada? Faça o Pix de volta de ${brl(r.total)} antes. A vaga será liberada.`,
  };

  async function executar(op, codigo) {
    const r = dados && dados.reservas.find((x) => x.codigo === codigo);
    if (!r) return;
    if (CONFIRMAR[op] && !window.confirm(CONFIRMAR[op](r))) return;
    let out = await admin(op, op === 'vale' ? { codigo, entregue: r.vale !== 'entregue' } : { codigo });
    if (!out.ok && out.erro === 'sem_vaga' && window.confirm(`${ERROS.sem_vaga} Quer confirmar mesmo assim, passando do limite?`)) {
      out = await admin(op, { codigo, forcar: true });
    }
    if (!out.ok) { if (out.erro !== 'rede') aviso(ERROS[out.erro] || 'Não foi possível concluir a ação.'); return; }
    await carregar();
    if (op === 'reembolsar') {
      aviso(out.proximaFila
        ? `Reembolso registrado e vaga liberada. Sugestão: promover ${out.proximaFila} da fila de espera.`
        : 'Reembolso registrado e vaga liberada. Ninguém da fila cabe nas noites liberadas.');
      if (out.proximaFila) { aba = 'fila'; render(); }
    } else {
      const textos = { pagar: 'Pagamento confirmado. Envie a confirmação com o convite do grupo.', estender: 'Reserva estendida por mais 5 minutos.', promover: 'Promovida da fila: 5 minutos para pagar. Avise a pessoa agora.', liberar: 'Vaga liberada.', vale: 'Vale atualizado.' };
      aviso(textos[op] || 'Feito.');
    }
  }

  async function promo(op, ligar) {
    const out = await admin(op, { ligar });
    if (out.ok) {
      aviso(ligar ? `${op === 'promoA' ? 'Promoção' : 'Cadeira extra'} ativada para todos por 15 minutos.` : `${op === 'promoA' ? 'Promoção' : 'Cadeira extra'} encerrada. A página voltou ao preço de tabela.`);
      await carregar();
    }
  }

  function tick() {
    if (!dados) return;
    for (const [k, op] of [['A', 'promoA'], ['B', 'promoB']]) {
      const p = dados[op];
      const resta = p && p.ativa ? p.ate - agora() : 0;
      const ativa = resta > 0;
      $('#estadoPromo' + k).textContent = ativa ? 'Ativa: termina em' : 'Desligada';
      $('#timerPromo' + k).textContent = ativa ? mmss(resta) : '';
      $('#fimPromo' + k).hidden = !ativa;
      $('#btnPromo' + k).hidden = ativa;
      if (p && p.ativa && !ativa) { p.ativa = false; carregar(); }
    }
    document.querySelectorAll('[data-expira]').forEach((el) => { el.textContent = mmss(Number(el.dataset.expira) - agora()); });
  }

  // ---------- CSV ----------
  function csv(reservas) {
    const cel = (v) => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const reais = (c) => (Number(c || 0) / 100).toFixed(2).replace('.', ',');
    const pes = (p) => (p ? [p.nome, p.sexo, p.nascimento, p.menor ? 'sim' : 'não', p.cpf, p.celular, p.email, p.endereco, p.cep] : ['', '', '', '', '', '', '', '', '']);
    const resp = (p) => (p && p.responsavel ? [p.responsavel.nome, p.responsavel.parentesco, p.responsavel.cpf, p.responsavel.celular, p.responsavel.email] : ['', '', '', '', '']);
    const cab = ['Código', 'Status', 'Tipo', 'Noites', 'Pessoas', 'Total (R$)', 'Criado em', 'Pago em', 'Vale R$ 10',
      'Titular nome', 'Titular sexo', 'Titular nascimento', 'Titular menor', 'Titular CPF', 'Titular celular', 'Titular e-mail', 'Titular endereço', 'Titular CEP',
      'Resp. titular nome', 'Resp. titular parentesco', 'Resp. titular CPF', 'Resp. titular celular', 'Resp. titular e-mail',
      'Extra parentesco', 'Extra nome', 'Extra sexo', 'Extra nascimento', 'Extra menor', 'Extra CPF', 'Extra celular', 'Extra e-mail', 'Extra endereço', 'Extra CEP',
      'Resp. extra nome', 'Resp. extra parentesco', 'Resp. extra CPF', 'Resp. extra celular', 'Resp. extra e-mail',
      'Aviso de privacidade', 'Autoriza imagem', 'Declaração do responsável'];
    const linhas = reservas.map((r) => {
      const c = r.consentimentos || {};
      const x = r.extraPessoa;
      return [r.codigo, r.status, r.tipo, (r.noites || []).join(','), r.pessoas, reais(r.total), dataHora(r.criadoEm), dataHora(r.pagoEm), r.vale || '',
        ...pes(r.titular), ...resp(r.titular), x ? x.parentesco : '', ...pes(x), ...resp(x),
        c.privacidade ? 'sim' : 'não', c.imagem ? 'sim' : 'não', c.responsavel ? 'sim' : 'não'];
    });
    return '﻿' + [cab, ...linhas].map((l) => l.map(cel).join(';')).join('\r\n');
  }

  async function exportar() {
    const out = await admin('exportar');
    if (!out.ok) return;
    const blob = new Blob([csv(out.reservas)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turma01-inscricoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    aviso('Planilha exportada. Ela tem CPFs completos: guarde em local seguro.');
  }

  // ---------- Eventos ----------
  function bind() {
    $('#loginForm').addEventListener('submit', entrar);
    $('#btnPromoA').addEventListener('click', () => promo('promoA', true));
    $('#fimPromoA').addEventListener('click', () => promo('promoA', false));
    $('#btnPromoB').addEventListener('click', () => promo('promoB', true));
    $('#fimPromoB').addEventListener('click', () => promo('promoB', false));
    $('#chkVendas').addEventListener('change', async (e) => { const out = await admin('vendas', { abertas: e.target.checked }); if (out.ok) { aviso(e.target.checked ? 'Vendas abertas.' : 'Vendas fechadas na página.'); await carregar(); } });
    $('#chkImagem').addEventListener('change', async (e) => { const out = await admin('imagem', { obrigatoria: e.target.checked }); if (out.ok) { aviso(e.target.checked ? 'Autorização de imagem obrigatória.' : 'Autorização de imagem opcional.'); await carregar(); } });
    document.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { aba = b.dataset.aba; render(); }));
    $('#lista').addEventListener('click', (e) => {
      const b = e.target.closest('[data-op]');
      if (b) executar(b.dataset.op, b.closest('[data-codigo]').dataset.codigo);
    });
    $('#btnAtualizar').addEventListener('click', () => { aviso(''); carregar(); });
    $('#btnExportar').addEventListener('click', exportar);
    $('#btnLimparTestes').addEventListener('click', async () => {
      if (!window.confirm('Apagar de vez todas as inscrições cujo nome do titular começa com "TESTE"? Isso não pode ser desfeito.')) return;
      const out = await admin('limparTestes');
      if (out.ok) { aviso(`${out.removidas} inscrição(ões) de teste apagada(s).`); await carregar(); }
    });
    $('#btnSair').addEventListener('click', () => sair('Você saiu do painel.'));
    setInterval(tick, 1000);
    setInterval(() => { if (dados && !document.hidden) carregar(); }, 20000);
  }

  async function iniciar() {
    bind();
    try {
      const site = await Site.load();
      const url = String((site.turma && site.turma.endpoint) || '').trim();
      endpoint = ENDPOINT_RE.test(url) ? url : '';
    } catch (e) { endpoint = ''; }
    if (endpoint && token()) await abrirPainel();
  }

  window.TurmaAdmin = { csv, mensagem };
  iniciar();
})();
