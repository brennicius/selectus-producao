# Armazenamento online da produção

Projeto dedicado: Selectus Produção, região São Paulo, organização no plano Free. Nenhuma migração foi aplicada ao projeto de inventário. Não há dependências pagas ou adicionais contratados por este código.

## Primeiro acesso

1. O responsável autoriza o e-mail inicial de ADM na tabela `production_members`, pelo painel SQL ou pela integração de administração do Supabase. Somente os dados `email` e `role='admin'` são necessários. A senha deve ser criada pela própria pessoa no site; nunca deve ser enviada por chat ou colocada no repositório.
2. No Supabase, em Authentication → URL Configuration, configure Site URL e Redirect URLs com o endereço publicado do site. A confirmação de e-mail também confirma a conta mesmo se um endereço de retorno ainda não estiver configurado; nesse caso, a pessoa pode voltar ao site e entrar manualmente.
3. A pessoa usa **Criar minha conta**, confirma o e-mail e entra. Acesso depende de uma conta confirmada e do e-mail autorizado. Cadastros de conta, por si só, não liberam os dados.
4. O ADM pode usar **Liberar acesso** para autorizar o e-mail da cozinha. A conta da cozinha só pode consultar os planos e registrar o realizado, inclusive se tentar alterar o código no navegador.

O seletor de perfil continua existindo: ADM pode usar ambas as telas; contas de cozinha têm a opção ADM bloqueada. A sessão dura na aba/aparelho em uso; fechar a aba requer novo login. **Sair** encerra a sessão.

## Uso e sincronização

Salvar plano, importar um planejamento e cadastrar clientes/produtos enviam os dados ao Supabase. A cozinha salva apenas os produtos alterados na loja selecionada. Outras lojas não são sobrescritas; divergências no mesmo produto/local geram um conflito e o rascunho é mantido para conferência. Alterações administrativas usam uma revisão do plano para impedir gravação sobre uma edição mais recente.

Use **Atualizar dados** no outro aparelho para carregar os registros novos. Não há atualização em tempo real nem consultas periódicas automáticas, evitando tráfego desnecessário no plano gratuito. Digitar mantém um rascunho local; o indicador distingue rascunho de dados salvos online. Em falha de rede, a interface não diz que salvou online.

## Dados anteriores

Na primeira abertura desta versão, a cópia local anterior é preservada. **Backup anterior** permite baixá-la. **Enviar dados antigos deste aparelho**, disponível ao ADM, transfere os cadastros e planos para o banco com confirmação. Um rascunho válido com data/lote também é incluído. Os identificadores existentes online são mantidos; a migração nunca sobrescreve um plano remoto pelo conteúdo de um backup. Falhas são relatadas por plano e permitem nova tentativa sem duplicar os sucessos.

Backups JSON continuam disponíveis. Restaurar um backup passa a fazer a mesma importação aditiva online. Trocar ou limpar um navegador não remove os registros que já foram salvos no Supabase. Rascunhos ainda não enviados continuam dependendo do aparelho.

## Estrutura e validação

- `production_members`: e-mails aprovados e permissão ADM/Cozinha.
- `production_config`: catálogo e ordem estável dos locais, com revisão.
- `production_plans`: planejamento e realizado, revisões e exclusão recuperável.
- Escritas passam por RPCs com autorização no banco; tabelas não aceitam INSERT/UPDATE/DELETE direto do navegador. RLS bloqueia leitura de visitantes e contas não aprovadas.
- O projeto e a chave **publishable** em `cloud.js` são públicos por definição. Não existe chave `service_role` no frontend.
- `db/schema.sql` descreve a estrutura final já aplicada ao projeto remoto. `db/checks.sql` testa permissões, conflitos, zero/vazio e isolamento de lojas, em uma transação com rollback.

As verificações SQL e de acesso anônimo foram concluídas. O teste de login real, migração dos dados do aparelho e publicação da integração dependem da liberação do primeiro ADM e da confirmação de e-mail por essa pessoa. Nenhum usuário de teste ou plano de teste foi mantido no banco.

O plano Free tem limites de capacidade e regras de inatividade do provedor. Não foi feito upgrade. Consulte os limites no painel antes de ativar recursos adicionais.
