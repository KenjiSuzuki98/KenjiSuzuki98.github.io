/**
 * Recebe as inscrições da aula gratuita (aula.html) e grava numa planilha Google.
 * Também recebe o formulário do certificado (certificado.html): dados do aluno,
 * avaliação e indicações, em abas próprias da mesma planilha.
 *
 * Como ativar (uma vez só, cerca de 5 minutos):
 *  1. Crie uma planilha nova no Google Planilhas (ex.: "Inscrições - Aula IA").
 *  2. Menu Extensões → Apps Script. Apague o que estiver lá e cole TODO este arquivo.
 *  3. Clique em Implantar → Nova implantação → engrenagem → "App da Web".
 *       Executar como: Eu (seu e-mail)
 *       Quem pode acessar: Qualquer pessoa
 *  4. Clique em Implantar, autorize com a sua conta Google e copie a "URL do app da Web"
 *     (termina em /exec).
 *  5. No painel admin do site, aba "Aula / Evento", cole a URL em
 *     "Endereço da planilha (Google Apps Script)" e clique em "Salvar e publicar".
 *
 * Se mudar este código depois: Implantar → Gerenciar implantações → editar (lápis)
 * → Versão: "Nova versão" → Implantar. Assim a URL continua a mesma.
 */

const ABA = 'Inscrições';
const CABECALHO = ['Data/hora', 'Evento', 'Nome', 'Celular', 'E-mail', 'Aceita ofertas', 'Consentimento', 'WhatsApp (link)'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return resposta({ ok: true }); // robô preencheu o campo escondido
    if (d.tipo === 'certificado') return certificado(d);

    const nome = texto(d.nome, 120);
    let celular = String(d.celular || '').replace(/\D/g, '');
    if (celular.length === 10 || celular.length === 11) celular = '55' + celular;
    const email = texto(d.email, 160).toLowerCase();
    const evento = texto(d.evento, 160);

    if (nome.length < 3 || !/^55\d{10,11}$/.test(celular) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || d.consentimento !== true) {
      return resposta({ ok: false, erro: 'dados inválidos' });
    }

    const aba = planilha();
    // Mesma pessoa se inscrevendo de novo no mesmo evento: atualiza a linha em vez de duplicar.
    const linhas = aba.getDataRange().getValues();
    for (let i = 1; i < linhas.length; i++) {
      if (linhas[i][1] === evento && (String(linhas[i][4]).toLowerCase() === email || String(linhas[i][3]).replace(/\D/g, '') === celular)) {
        aba.getRange(i + 1, 1, 1, CABECALHO.length).setValues([linha(evento, nome, celular, email, d.ofertas === true)]);
        return resposta({ ok: true, repetido: true });
      }
    }
    aba.appendRow(linha(evento, nome, celular, email, d.ofertas === true));
    return resposta({ ok: true });
  } catch (err) {
    return resposta({ ok: false, erro: 'erro interno' });
  } finally {
    lock.releaseLock();
  }
}

// Abrir a URL no navegador mostra se o script está no ar.
function doGet() {
  return resposta({ ok: true, mensagem: 'Recebendo inscrições.' });
}

// ---------- Certificado (certificado.html) ----------
const ABA_CERT = 'Certificados';
const CAB_CERT = ['Data/hora', 'Turma', 'Código', 'Nome no certificado', 'Celular', 'E-mail', 'Empresa/profissão', 'Quer novidades', 'WhatsApp (link)'];
const ABA_AVAL = 'Avaliações';
const CAB_AVAL = ['Data/hora', 'Turma', 'Código', 'Nome', 'Indicaria (0-10)', 'Nota geral (1-5)', 'Conteúdo aplicável', 'Didática (1-5)', 'Ritmo', 'O que mais gostou', 'O que melhorar', 'Aplicação que gostaria de criar', 'Próximo passo', 'Autoriza depoimento'];
const ABA_IND = 'Indicações';
const CAB_IND = ['Data/hora', 'Turma', 'Indicado por', 'Celular de quem indicou', 'Nome indicado', 'Telefone', 'Empresa', 'WhatsApp (link)', 'Contatado?'];

function certificado(d) {
  const turma = texto(d.turma, 60);
  const a = d.dados || {};
  const nome = texto(a.nome, 90);
  const celular = fone(a.celular);
  const email = texto(a.email, 160).toLowerCase();
  const p = d.pesquisa || {};
  const nps = Number(p.nps), geral = Number(p.geral);
  const aplicacao = texto(p.aplicacao, 500);
  const ind = (Array.isArray(d.indicacoes) ? d.indicacoes : []).slice(0, 2)
    .map((x) => ({ nome: texto(x && x.nome, 90), tel: fone(x && x.telefone), empresa: texto(x && x.empresa, 90) }))
    .filter((x) => x.nome.length >= 2 && x.tel);

  if (nome.length < 5 || !celular || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
      || !(nps >= 0 && nps <= 10) || !(geral >= 1 && geral <= 5) || aplicacao.length < 5) {
    return resposta({ ok: false, erro: 'dados inválidos' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cert = aba(ss, ABA_CERT, CAB_CERT);
  const agora = new Date();
  // Mesma pessoa pedindo de novo na mesma turma: mantém o código e atualiza o nome.
  let codigo = '';
  const linhas = cert.getDataRange().getValues();
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i][1] === turma && (String(linhas[i][5]).toLowerCase() === email || String(linhas[i][4]).replace(/\D/g, '') === celular)) {
      codigo = String(linhas[i][2]);
      cert.getRange(i + 1, 1, 1, CAB_CERT.length).setValues([linhaCert(agora, turma, codigo, nome, celular, email, a)]);
      break;
    }
  }
  if (!codigo) {
    codigo = novoCodigo(texto(d.prefixo, 10) || 'CERT');
    cert.appendRow(linhaCert(agora, turma, codigo, nome, celular, email, a));
  }

  aba(ss, ABA_AVAL, CAB_AVAL).appendRow([agora, turma, codigo, seguro(nome), nps, geral,
    opcao(p.aplicavel), num(p.didatica), opcao(p.ritmo), seguro(texto(p.gostou, 500)), seguro(texto(p.melhorar, 500)), seguro(aplicacao),
    opcao(p.proximo), p.depoimento === true ? 'Sim' : 'Não']);

  const abaInd = aba(ss, ABA_IND, CAB_IND);
  ind.forEach((x) => abaInd.appendRow([agora, turma, seguro(nome), "'" + celular, seguro(x.nome), "'" + x.tel, seguro(x.empresa), 'https://wa.me/' + x.tel, 'Não']));

  return resposta({ ok: true, codigo: codigo });
}

function linhaCert(agora, turma, codigo, nome, celular, email, a) {
  return [agora, turma, codigo, seguro(nome), "'" + celular, seguro(email), seguro(texto(a.empresa, 90)), a.novidades === true ? 'Sim' : 'Não', 'https://wa.me/' + celular];
}

function novoCodigo(prefixo) {
  const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 6; i++) c += abc.charAt(Math.floor(Math.random() * abc.length));
  return prefixo.replace(/[^A-Za-z0-9]/g, '') + '-' + c;
}

// Telefone brasileiro com DDD: devolve 55 + número, ou '' se inválido.
function fone(v) {
  let n = String(v || '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return /^55\d{10,11}$/.test(n) ? n : '';
}
const opcao = (v) => seguro(texto(v, 60));
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? '' : Number(v));

function aba(ss, nome, cabecalho) {
  let a = ss.getSheetByName(nome);
  if (!a) {
    a = ss.insertSheet(nome);
    a.appendRow(cabecalho);
    a.setFrozenRows(1);
    a.getRange(1, 1, 1, cabecalho.length).setFontWeight('bold');
  }
  return a;
}

function linha(evento, nome, celular, email, ofertas) {
  return [new Date(), seguro(evento), seguro(nome), "'" + celular, seguro(email), ofertas ? 'Sim' : 'Não', 'Sim', 'https://wa.me/' + celular];
}

function planilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(ABA);
  if (!aba) {
    aba = ss.insertSheet(ABA);
    aba.appendRow(CABECALHO);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, CABECALHO.length).setFontWeight('bold');
  }
  return aba;
}

const texto = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
// Impede que um texto digitado vire fórmula na planilha (=, +, -, @).
const seguro = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v);

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
