# Site pessoal: portfólio, serviços, loja e contato

Site estático para o **GitHub Pages**. Não precisa de servidor nem de banco de dados.

- `index.html`: página pública (apresentação, serviços, loja, portfólio, contato).
- `admin.html`: painel para editar tudo e publicar direto no GitHub.
- `data/site.json`: todo o conteúdo do site (o painel edita este arquivo).
- `assets/uploads/`: imagens enviadas pelo painel.

## Como editar o site

1. Acesse `https://SEU-USUARIO.github.io/admin.html` (ou `/NOME-DO-REPO/admin.html`).
2. Informe usuário, repositório, branch (`main`) e um **token do GitHub**.
3. Edite e clique em **Salvar e publicar**. O site atualiza em cerca de 1 minuto.

### Criar o token (uma vez só)

GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**

- *Repository access*: **Only select repositories**, depois selecione este repositório.
- *Permissions → Repository permissions → Contents*: **Read and write**.

O token fica salvo apenas no navegador onde você fez login. Para sair, use o botão **Sair** do painel.

## Pagamentos via Pix

- Na aba **Pix** do painel, configure a chave padrão, o nome do recebedor e a cidade.
- Cada serviço ou produto pode ter **preço** e **chave Pix própria** (opcional).
- O cliente vê o QR Code e o "Pix Copia e Cola" com o valor já preenchido. Depois toca em
  **"Já paguei: enviar comprovante"**, que abre seu WhatsApp com a mensagem pronta.
- O site **não confirma pagamentos automaticamente**: confira o recebimento no app do banco.
- Faça um teste de R$ 1,00 depois de configurar a chave.

## Testar no computador

```bash
python -m http.server 8000
```

Depois abra http://localhost:8000.
