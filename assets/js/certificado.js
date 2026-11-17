// Modelo de certificado da Turma 01: o nome digitado só aparece na tela e na impressão.
(() => {
  const input = document.getElementById('nomeAluno');
  const alvo = document.getElementById('certNome');
  input.addEventListener('input', () => { alvo.textContent = input.value.trim() || 'Nome do aluno'; });
  document.getElementById('btnImprimir').addEventListener('click', () => window.print());
})();
