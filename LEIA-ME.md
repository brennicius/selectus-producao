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

## Atualização: cadastros e impressão

A tabela tem rolagem interna com os cabeçalhos dos locais e a coluna de produtos fixos. Em Produtos e clientes, adicione produtos nas cinco categorias e cadastre novos locais. Eles aparecem automaticamente no plano, nos totais e na exportação. Os cadastros também ficam neste navegador. O backup versão 2 inclui cadastros; arquivos antigos versão 1 continuam aceitos. A importação mescla clientes por nome exato e produtos por identificador, preservando as colunas originais.

Em Imprimir, escolha produção consolidada (todos os locais), distribuição de um local ou folhas separadas para todos os locais. Pode incluir ou omitir os produtos zerados. A impressão exige data e lote. Sobremesas arredondam apenas no relatório consolidado; a distribuição usa quantidades exatas. Cada local começa em uma página nova e pode ocupar mais páginas caso tenha muitos produtos.

Para atualizar um site já publicado, substitua os arquivos no mesmo projeto e publique. Antes, baixe um backup. Mantenha o mesmo endereço para acessar os dados já salvos no navegador.

## Planejado e Produzido por PDV

Cada local possui duas colunas. O modo Editar planejamento libera Planejado. O modo Apontar produção · Josué libera Produzido e mantém o planejamento somente para consulta. Isso é uma proteção de interface, sem autenticação ou permissão por usuário. O realizado é sempre exato, sem arredondamento. Vazio significa não informado; 0 é um apontamento explícito. Totais e diferenças dos apontamentos incompletos são parciais. A meta arredondada da cozinha continua em cartão separado.

O botão Importar plano aceita JSON no formato do botão Modelo para o Claude. Envie o arquivo de origem e o modelo JSON ao Claude e peça que ele preencha as quantidades planejadas. Depois importe o resultado. Os produtos e locais precisam estar cadastrados; nomes desconhecidos, itens duplicados e quantidades inválidas bloqueiam a importação inteira, sem importação parcial. A tela mostra o resumo antes de confirmar. Cada importação cria um novo plano salvo no histórico e abre no modo de apontamento, com realizado em branco.

O site não tem integração automática com Claude, endpoint de escrita nem sincronização entre aparelhos. Essas funções dependem do banco ainda pendente. Para transferir planos entre aparelhos nesta versão, use o backup completo (v3, inclui o produzido). Backups v1 e v2 continuam aceitos; registros antigos são tratados como planejamento e o realizado começa vazio.
