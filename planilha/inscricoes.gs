/**
 * Recebe as inscrições da aula gratuita (aula.html) e grava numa planilha Google.
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
