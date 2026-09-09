# PedidoAPI

API REST de **Pedidos** em Node + TypeScript que consome a **ProdutoAPI** (Spring Boot) para
controlar o estoque. Criar um pedido baixa o estoque na API de Produtos; excluir o pedido
devolve exatamente o que saiu, para o produto de onde saiu.

```
  REST Client (.http)          Menu do terminal
          |                            |
          +------------+---------------+
                       v
              PedidoAPI  (Node/TS, :3000)  --- banco SQLite (pedidos.db)
                       |                        pedidos, itens, movimentacoes
                       | HTTP (fetch)
                       v
              ProdutoAPI (Spring, :8080)   --- banco H2 (estoque = campo quantidade)
```

O estoque **nao e duplicado**: a fonte da verdade continua sendo a API de Produtos.
O banco da PedidoAPI guarda os pedidos e a trilha de auditoria de cada movimentacao.

## Como rodar

**1. Suba a API de Produtos** (em um terminal):

```powershell
cd ..\ProdutoAPI
.\mvnw spring-boot:run
```

**2. Suba a API de Pedidos** (em outro terminal):

```powershell
cd PedidoAPI
npm install        # so na primeira vez
npm run dev        # http://localhost:3000
```

**3. Menu do terminal** (em um terceiro terminal, com a API de Pedidos no ar):

```powershell
npm run menu
```

No VS Code, `Ctrl+Shift+P` -> `Tasks: Run Task` -> **Subir tudo (Produtos + Pedidos)**
sobe as duas de uma vez.

## Testes com o REST Client

Os arquivos ficam em [`requests/`](requests) e sao feitos para rodar **de cima para baixo**:

| Arquivo | O que faz |
| --- | --- |
| `00-fluxo-completo.http` | O roteiro dos dois lados: olha o estoque no Spring, cria o pedido no Node, volta no Spring para ver o estoque mudar, exclui o pedido e confirma a devolucao |
| `01-produtos-spring.http` | Requests direto na API de Produtos (porta 8080) |
| `02-pedidos-node.http` | Todos os endpoints da API de Pedidos (porta 3000), inclusive os casos de erro |

Comece pelo `00-fluxo-completo.http`: ele encadeia as respostas
(`{{pedidoCriado.response.body.pedido.id}}`), entao voce ve o efeito de um lado
aparecendo no outro sem copiar id na mao.

## Endpoints

### Estoque (tudo consulta/atualiza a API de Produtos)

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/api/estoque` | Lista o estoque. `?nome=` filtra, `?disponiveis=true` esconde os esgotados |
| GET | `/api/estoque/:produtoId` | Estoque de um produto |
| PATCH | `/api/estoque/:produtoId` | Atualiza o estoque: `{ "quantidade": 50 }` (valor final) ou `{ "ajuste": -3 }` (soma/subtrai) |
| POST | `/api/estoque/produtos` | Cadastra um produto novo na API de Produtos |
| GET | `/api/estoque/movimentacoes` | Historico de baixas, devolucoes e ajustes |

Cada item da lista traz, alem dos campos do produto:

- `situacao`: `DISPONIVEL`, `ESTOQUE_BAIXO` (5 ou menos) ou `ESGOTADO`
- `reservadoEmPedidos`: quanto daquele produto esta preso em pedidos ativos
- `valorEmEstoque`: `preco x quantidade`

### Pedidos

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/api/pedidos` | Lista pedidos. `?status=CRIADO\|CANCELADO`, `?cliente=` |
| GET | `/api/pedidos/resumo` | Totais de pedidos, itens reservados e valor |
| GET | `/api/pedidos/:id` | Detalhe com os itens |
| POST | `/api/pedidos` | Cria o pedido e baixa o estoque |
| POST | `/api/pedidos/:id/cancelamento` | Devolve o estoque, mantem o pedido no historico |
| DELETE | `/api/pedidos/:id` | Devolve o estoque e apaga o pedido |

Exemplo de criacao:

```json
{
  "cliente": "Maria Silva",
  "observacao": "entregar apos as 18h",
  "itens": [
    { "produtoId": 1, "quantidade": 2 },
    { "produtoId": 2, "quantidade": 3 }
  ]
}
```

## Decisoes de projeto que valem comentar

**Baixa com rollback.** Um pedido com tres itens faz tres chamadas a API de Produtos.
Se o terceiro nao tiver saldo, os dois primeiros ja sairam do estoque — entao a
PedidoAPI devolve os dois automaticamente antes de responder 409. O `PASSO 8` do
`00-fluxo-completo.http` testa exatamente isso.

**Fila de escrita.** A API de Produtos so tem `PUT` (substituicao completa), entao
atualizar estoque e um `GET` seguido de `PUT`. Dois pedidos simultaneos poderiam ler
o mesmo saldo e um sobrescrever o outro. As operacoes de escrita passam por uma fila
unica em [`estoqueService.ts`](src/services/estoqueService.ts) para nunca rodarem em paralelo.

**O preco fica congelado no item.** O pedido guarda `precoUnitario` do momento da compra.
Se o produto mudar de preco depois, o pedido antigo continua com o valor certo.

**Excluir x cancelar.** `DELETE` apaga o pedido; o cancelamento devolve o estoque mas
mantem o registro. Cancelar duas vezes da 409 — o estoque nao volta em dobro. E excluir
um pedido ja cancelado nao devolve nada de novo.

**Produto apagado depois do pedido.** Se alguem excluir o produto na API de Produtos e
depois voce excluir o pedido, a devolucao daquele item aparece marcada na resposta em vez
de derrubar a operacao inteira.

**Erros no mesmo formato.** As respostas de erro seguem o mesmo desenho do
`ProblemDetail` (RFC 7807) usado pelo Spring: `status`, `titulo`, `detalhe`, `timestamp`.

## Banco de dados

SQLite pelo modulo nativo `node:sqlite` — sem dependencia para compilar, o arquivo
`pedidos.db` aparece na pasta ao subir a API. Tres tabelas:

- `pedidos` — cliente, status, total, datas
- `pedido_itens` — produto, preco congelado, quantidade, subtotal
- `movimentacoes_estoque` — tipo (`BAIXA`, `DEVOLUCAO`, `AJUSTE`, `ENTRADA`), saldo antes e depois, motivo

Para nao persistir entre execucoes, coloque `DATABASE_FILE=:memory:` no `.env`.

## Configuracao

Copie `.env.example` para `.env` se precisar mudar algo:

| Variavel | Padrao | Para que serve |
| --- | --- | --- |
| `PORT` | `3000` | Porta da API de Pedidos |
| `PRODUTO_API_URL` | `http://localhost:8080` | Onde a API de Produtos esta |
| `DATABASE_FILE` | `pedidos.db` | Arquivo do banco |
| `PRODUTO_API_TIMEOUT_MS` | `8000` | Timeout das chamadas a API de Produtos |

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe com reload automatico |
| `npm start` | Sobe sem reload |
| `npm run menu` | Abre o menu interativo do terminal |
| `npm run typecheck` | Checa os tipos sem gerar arquivos |
| `npm run build` | Compila para `dist/` |
