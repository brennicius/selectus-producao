# Selectus — Produção

Site estático baseado em modelo cozinha.xlsx: 25 produtos, cinco categorias e seis PDVs, com lote, data e quantidades editáveis. Os valores iniciais ficam vazios para evitar produção acidental; “Carregar exemplo” importa as quantidades da planilha. Sobremesas arredondam para múltiplos de cinco como no arquivo original. Os totais gerais sempre incluem o plano inteiro, mesmo com busca ou categoria selecionada.

## Publicar na Vercel

1. Extraia este ZIP.
2. Crie um repositório no GitHub e envie os arquivos desta pasta na raiz.
3. Na Vercel, escolha Add New → Project e importe o repositório.
4. Em Framework Preset selecione Other. Deixe Build Command desativado e Output Directory na raiz (.). Não há instalação de dependências.
5. Clique em Deploy.

Também é possível executar `npx vercel --prod` dentro desta pasta em uma máquina autenticada na sua conta Vercel. A publicação não foi executada pelo ChatGPT.

## Uso

Digite data e lote, preencha quantidades por PDV e salve no histórico. CSV pode ser aberto no Excel; Imprimir permite salvar um PDF. O backup JSON contém histórico e rascunho; a restauração mescla o histórico por identificador. O rascunho incluído no backup é informativo e não substitui automaticamente o plano em edição.

## Armazenamento

Esta versão salva no navegador e dispositivo em uso, sem banco compartilhado, login ou sincronização com a planilha original. Limpar os dados do navegador remove os planos locais. Baixe backups regularmente. Publicar na Vercel não torna os registros compartilhados entre computadores: isso requer uma próxima integração com banco ou API. Não use esta versão como único arquivo da produção.

## Abrir localmente

Abra um terminal nesta pasta e execute `python3 -m http.server 3000` (ou `python -m http.server 3000` no Windows). Acesse http://localhost:3000. Sem dependências externas.
