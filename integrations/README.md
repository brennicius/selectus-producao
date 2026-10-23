# Atualização automática da planilha de descartes

O arquivo `selectus-google-sync.gs` está pronto para a planilha original Contagem Café e Descarte APP. Ele lê Dados Brutos, considera somente descartes de produtos reconhecidos no catálogo da produção e substitui a cópia no Supabase, preservando associações. Não altera células nem exige tornar a planilha pública. Usa apenas a chave publicável já usada pelo site público.

## Ativar uma vez

1. Na planilha original, abra **Extensões → Apps Script**.
2. Crie um **novo arquivo de script** chamado `SelectusSync`. Cole o conteúdo completo de `selectus-google-sync.gs` e salve. Preserve os scripts existentes da planilha.
3. Selecione a função **instalarSincronizacaoSelectus** e clique em **Executar**. Autorize sua conta Google a ler esta planilha e realizar as requisições ao banco. A primeira sincronização acontece durante essa execução; em seguida é instalado um acionador a cada 5 minutos.

O site não pede conta Google aos visitantes. Depois de incluir um descarte, aguarde o próximo ciclo e clique em **Atualizar dados online** na aba Envios e descartes do site para carregar a nova cópia. Para sincronizar imediatamente, execute **sincronizarDescartesSelectus** no Apps Script. Para parar, execute **pararSincronizacaoSelectus**.

## Limites e operação

Este código está preparado, mas não é ativado por colocá-lo no GitHub: precisa ser instalado e autorizado no Google pelo proprietário da planilha. Não há autorização Google disponível para o site na conexão do ChatGPT. O acionador roda na conta que o instalou, sem precisar manter a planilha aberta, sujeito às cotas gratuitas do Apps Script. Não é sincronização instantânea.

Consulte **Execuções** no Apps Script para verificar sucesso ou falhas. Falhas de leitura, cabeçalho inválido, quantidades inválidas ou ausência de produtos reconhecidos preservam a cópia anterior. Atualizações simultâneas têm controle de revisão. Evite alternar uploads manuais e sincronização automática: o próximo ciclo automático volta a refletir a planilha original completa.

Fonte técnica: https://developers.google.com/apps-script/guides/triggers/installable
