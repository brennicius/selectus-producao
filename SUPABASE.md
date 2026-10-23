# Selectus Produção — Supabase com acesso livre

Projeto dedicado Selectus Produção, região São Paulo, organização no plano Free. Nenhum adicional pago foi contratado, e o projeto Inventário Selectus não foi alterado.

## Acesso

Por solicitação explícita do responsável, o site não exige conta, e-mail ou senha. Ao abrir, selecione ADM ou Josué / Cozinha. Esse seletor organiza as telas; não é uma autorização de segurança. Qualquer pessoa com o link pode ler os registros e usar ambas as telas, cadastrar produtos/clientes e enviar alterações. O acesso ao banco também é público para as operações validadas da aplicação. Não coloque dados confidenciais neste sistema aberto.

Os dados públicos são o catálogo e os planos. Tabelas de autenticação e a tabela auxiliar de membros, criadas na preparação anterior, não foram liberadas ao público e não são usadas pelo site. Não existe chave service_role no código. A chave publishable é pública por definição.

## Uso e sincronização

Salvar plano, importar planejamento e cadastrar clientes/produtos gravam no Supabase. A cozinha salva apenas os produtos alterados na loja selecionada. Outras lojas não são sobrescritas; edições concorrentes no mesmo produto/local geram conflito e mantêm o rascunho. Alterações administrativas usam revisões para impedir gravação sobre uma edição mais recente.

Use Atualizar dados no outro aparelho para carregar os registros novos. Não há consultas periódicas ou serviço pago de atualização em tempo real. Digitar mantém um rascunho no navegador; toque em Salvar para enviar ao banco. O indicador distingue o rascunho de um registro salvo online. Falhas de rede não são apresentadas como salvamento bem-sucedido.

## Dados anteriores

A primeira abertura desta versão preserva uma cópia anterior do navegador. Backup anterior permite baixá-la. Enviar dados antigos deste aparelho, na tela ADM, transfere os cadastros e planos com confirmação. Um rascunho válido com data e lote também é incluído. Planos já existentes online não são substituídos por um backup; cada falha é relatada, e a operação pode ser repetida sem duplicar os sucessos. Os dados locais não são apagados.

Os backups JSON continuam disponíveis. Restaurar backup usa a mesma importação aditiva online. Limpar ou trocar de navegador não remove registros que já foram enviados ao banco, mas pode remover rascunhos ainda não salvos.

## Verificação

As tabelas mantêm RLS; visitantes têm leitura pública apenas dos dados de produção e escrita por RPC com validação. INSERT, UPDATE e DELETE diretos nas tabelas continuam bloqueados. Essas validações evitam valores inválidos e perda acidental por concorrência, mas não distinguem pessoas autorizadas, pois o acesso foi definido como livre.

`db/schema.sql` descreve a estrutura final. `db/checks.sql` verifica o acesso público, quantidades, zero, isolamento de lojas e conflitos, com rollback dos dados de teste. `node --test tests/cloud.test.cjs` verifica envio por loja, ausência de login e preservação dos rascunhos.

O plano Free tem limites de capacidade e regras de inatividade do provedor. Não foi realizado upgrade.

## Importação direta de Excel

Em ADM → Importar plano, envie um arquivo .xlsx ou JSON. O Excel é lido localmente no navegador, sem serviço pago e sem biblioteca externa. Arquivos .xls antigos precisam ser salvos como .xlsx. A leitura usa recursos nativos de navegadores atualizados.

O importador encontra uma única aba com Produto na primeira coluna, lê as colunas dos locais e ignora TOTAL, Validade, subtotais e linhas de categoria. A data é identificada nos cabeçalhos de produção, não nas datas de validade ou de vendas. O lote é solicitado quando não aparece no arquivo. A relação entre cada coluna e o local é exibida e pode ser corrigida antes de confirmar, incluindo as siglas HP, SA e Iz.

Quantidades vazias viram zero planejado; números fracionários/negativos, fórmulas nas quantidades por local e produtos desconhecidos bloqueiam o plano inteiro. A conferência mostra os totais por local e a data/lote antes de habilitar a importação. A observação escrita no cabeçalho não substitui os números preenchidos. A coluna Produzido começa vazia. A regra existente de arredondamento de sobremesas na meta da cozinha continua ativa, independentemente das fórmulas de total do Excel.

Teste de navegador com a planilha fornecida: 26/10/2026, 25 produtos, seis locais, 489 unidades planejadas, sendo Portugues 171, Amaro 108, Izabel 142, Agnus 8, CRIS 40 e Amaro2 20. A conferência não salvou esse plano no banco, pois o lote real não foi informado. Testes adicionais cobrem siglas, subtotais, fórmulas, quantidades inválidas, campos obrigatórios e ZIP inválido.

## Conferência, expedição e descartes

A migração `db/conference.sql` adiciona auditoria somente de leitura pela API,
registros de envio por plano/produto/PDV e uma cópia versionada dos descartes.
Aplique após o esquema público existente. Valide com `db/conference-checks.sql`
(todos os registros de teste são revertidos).

Na aba Conferência, uma correção exige quantidade, motivo e responsável informado.
O histórico guarda antes/depois e horário do servidor. Revisões feitas pela tela
antiga da cozinha também geram auditoria automática quando já havia um valor.
Primeiros apontamentos não são classificados como erros. Sem login, os nomes não
são identidades verificadas. Registros de auditoria não podem ser alterados ou
apagados pelo cliente público.

Envio é registrado explicitamente, separadamente do produzido. A comparação soma
os envios e descartes por lote exato (sem trocar O por 0), produto associado e PDV.
Se um plano do mesmo lote ainda tiver envio pendente, não calcula percentual.
Saldo é enviado menos descartado: não é venda nem estoque atual.

O XLSX usa apenas Dados Brutos (Tipo=Descarte), ou Relatório de Lotes como fallback.
Não soma abas derivadas. Cada importação substitui uma única cópia com controle de
revisão; repetir o arquivo não duplica registros. Use exportações completas para
manter o histórico da origem. Dados sem lote e nomes não associados ficam nas
pendências. As associações são explícitas e compartilhadas no Supabase.

A cópia não sincroniza automaticamente com o Google Sheets. Para atualizar,
exporte a planilha original como XLSX e use Atualizar com planilha na aba Envios e
descartes. Não é necessário tornar a planilha pública. Integração automática exige
um serviço autorizado a ler a planilha; nenhuma credencial Google é enviada ao
navegador. O arquivo da origem não é alterado.

Validação local: `node --test tests/*.test.cjs`.

Planos com envio registrado preservam data e lote e não podem ser excluídos pela tela; isso impede que os envios mudem de lote ou desapareçam da comparação. Corrija as quantidades pela Conferência.
