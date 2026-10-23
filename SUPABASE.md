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
