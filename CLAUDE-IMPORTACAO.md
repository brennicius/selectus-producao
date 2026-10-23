# Instrução para o Claude — Plano Selectus

Envie ao Claude o arquivo do plano de produção e o arquivo baixado em **Modelo para o Claude** no site. Use este pedido:

> Transforme o arquivo de produção em um JSON compatível com o modelo anexo. Retorne um arquivo .json válido, sem comentários e sem cercas de Markdown. Mantenha versao = 1, informe data_producao no formato AAAA-MM-DD e o lote real. Em itens, cada registro deve ter produto, pdv e planejado. Use os nomes exatos do cadastro do modelo e quantidades inteiras não negativas. Uma combinação de produto e PDV só pode aparecer uma vez; se a origem tiver várias linhas para a mesma combinação, some antes de gerar o JSON. Não preencha produção realizada. Se houver produto ou cliente desconhecido, ou se faltar a data ou o lote, sinalize antes de gerar o arquivo. Não invente quantidades ou substitua produtos semelhantes. Ignore subtotais, totais e metas arredondadas: importe somente os quantitativos planejados por produto e PDV.

Exemplo do formato (ilustrativo, não é um plano real):

```json
{
  "versao": 1,
  "data_producao": "2026-10-23",
  "lote": "LOTE-EXEMPLO",
  "itens": [
    {"produto": "CUSCUZ", "pdv": "Portugues", "planejado": 10},
    {"produto": "CUSCUZ", "pdv": "Amaro", "planejado": 6}
  ]
}
```

No site, use **Importar plano**, envie ou cole o JSON, clique em **Conferir arquivo** e confira data, lote e total. Confirme para criar um novo plano. Itens omitidos equivalem a planejamento zero. O histórico anterior é preservado. A importação não atualiza planos existentes pelo lote; cada confirmação cria um plano novo, portanto evite importar duas vezes o mesmo arquivo.

O plano abre em **Apontar produção · Josué**. Josué preenche a coluna Produzido de cada local: 0 significa que nada foi produzido e vazio significa ainda não informado. Clique em **Salvar plano** para atualizar o histórico. As edições também ficam em um rascunho automático no navegador.

Para entrada direta do Claude sem a etapa de importar arquivo, será necessário integrar o banco e criar uma API autenticada. Esta versão não tem essa conexão. O modo de trabalho não é uma restrição por usuário; qualquer pessoa com acesso ao navegador pode alternar entre planejamento e produção.
