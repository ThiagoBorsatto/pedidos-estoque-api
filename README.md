# Integracao de APIs REST — Produtos + Pedidos

Duas APIs REST conversando entre si: uma de **produtos** (Java / Spring Boot) que e a dona do
estoque, e uma de **pedidos** (Node / TypeScript) que consome a primeira por HTTP para vender
esse estoque, devolvendo tudo quando um pedido e cancelado ou excluido.

```
  REST Client (.http)          Menu do terminal
          |                            |
          +------------+---------------+
                       v
              PedidoAPI  (Node/TS, :3000)  --- SQLite (pedidos.db)
                       |                        pedidos, itens, movimentacoes
                       | HTTP (fetch)
                       v
              ProdutoAPI (Spring, :8080)   --- H2 (estoque = campo quantidade)
```

O estoque **nao e duplicado**: a fonte da verdade e sempre a API de Produtos. O banco da
API de Pedidos guarda os pedidos e a trilha de auditoria de cada movimentacao de estoque.

| Pasta | O que e | Porta |
| --- | --- | --- |
| [`ProdutoAPI/`](ProdutoAPI) | API de Produtos — Java 21+, Spring Boot, JPA, banco H2 em memoria | 8080 |
| [`PedidoAPI/`](PedidoAPI) | API de Pedidos — Node 22+, TypeScript, Express, banco SQLite | 3000 |

## Como rodar

```powershell
# terminal 1 — API de Produtos
cd ProdutoAPI
.\mvnw spring-boot:run

# terminal 2 — API de Pedidos
cd PedidoAPI
npm install
npm run dev

# terminal 3 — menu interativo (opcional)
cd PedidoAPI
npm run menu
```

No VS Code: `Ctrl+Shift+P` → `Tasks: Run Task` → **Subir tudo (Produtos + Pedidos)**.

## Testando os dois lados

Os testes de endpoint usam a extensao **REST Client** (`humao.rest-client`), e ficam em
[`PedidoAPI/requests/`](PedidoAPI/requests):

| Arquivo | O que faz |
| --- | --- |
| [`00-fluxo-completo.http`](PedidoAPI/requests/00-fluxo-completo.http) | O roteiro dos dois lados: le o estoque no Spring, cria o pedido no Node, volta ao Spring para ver a quantidade cair, exclui o pedido e confirma a devolucao |
| [`01-produtos-spring.http`](PedidoAPI/requests/01-produtos-spring.http) | Requests direto na API de Produtos (8080) |
| [`02-pedidos-node.http`](PedidoAPI/requests/02-pedidos-node.http) | Todos os endpoints da API de Pedidos (3000), inclusive os casos de erro |

Comece pelo `00-fluxo-completo.http` e va clicando em **Send Request** de cima para baixo:
ele encadeia as respostas (`{{pedidoCriado.response.body.pedido.id}}`), entao da para ver o
efeito de um lado aparecendo no outro sem copiar id na mao.

## O que o trabalho cobre

- **Criar pedidos** com os produtos disponiveis, dando baixa no estoque da outra API
- **Consultar o estoque** em lista, com situacao (`DISPONIVEL` / `ESTOQUE_BAIXO` / `ESGOTADO`) e quanto esta reservado em pedidos ativos
- **Atualizar o estoque** por valor final (`{ "quantidade": 50 }`) ou por ajuste (`{ "ajuste": -3 }`)
- **Excluir pedidos** devolvendo cada item para o produto de onde saiu, na quantidade exata
- **Cancelar** como alternativa a exclusao: o estoque volta e o pedido fica no historico
- **Trilha de auditoria** de toda baixa, devolucao e ajuste, com saldo antes e depois

Os detalhes de cada endpoint, as decisoes de projeto (rollback de baixa parcial, fila de
escrita para evitar corrida, preco congelado no item) e o modelo do banco estao no
[README da PedidoAPI](PedidoAPI/README.md).
