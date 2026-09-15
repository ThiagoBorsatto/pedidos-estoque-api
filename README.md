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

## Rodando as duas na nuvem (para a apresentacao)

Quando as duas APIs precisam rodar em maquinas diferentes e a rede local nao deixa
(sala de aula com isolamento entre os computadores, por exemplo), a saida e hospedar
as duas: cada maquina so precisa de internet, e o teste passa a ser feito por HTTPS.

O repositorio ja vem pronto para isso: um `Dockerfile` em cada API e um
[`render.yaml`](render.yaml) que descreve os dois servicos.

1. Crie uma conta gratuita em [render.com](https://render.com) (da para entrar com o GitHub)
2. **New** > **Blueprint** > selecione este repositorio
3. O Render le o `render.yaml`, cria `produto-api` e `pedido-api` e **pergunta o valor
   de `PRODUTO_API_URL`**. Como a URL da `produto-api` so existe depois que ela e criada,
   deixe qualquer coisa nesse momento (ex.: `http://localhost:8080`) e ajuste no passo 5
4. Ao terminar, copie as duas URLs (algo como `https://produto-api-xxxx.onrender.com`)
5. Abra **pedido-api > Environment**, coloque em `PRODUTO_API_URL` a URL publica **completa**
   da `produto-api` (com `https://` e com `.onrender.com`) e salve — o Render reinicia o
   servico sozinho. Sem o dominio completo a API de Pedidos responde
   `502 Falha ao falar com a API de Produtos`
6. Nos arquivos `.http`, troque as variaveis do topo pelas URLs da nuvem — cada arquivo
   ja tem as linhas prontas, e so comentar as de `localhost` e descomentar as de cima

Assim voce pode abrir o VS Code em **qualquer** maquina, rodar os mesmos testes e ver
uma API chamando a outra, sem depender da rede da sala.

**Dois detalhes do plano gratuito:**

- Os servicos **dormem apos ~15 minutos** sem acesso, e a API de Produtos (Java) leva
  perto de um minuto para acordar. Abra as duas URLs no navegador uns 3 minutos antes
  de apresentar; depois disso as respostas ficam rapidas.
- Os bancos sao **efemeros**: quando um servico reinicia, os produtos de exemplo sao
  recarregados e os pedidos se perdem. Para a demonstracao isso ate ajuda, porque cada
  apresentacao comeca do mesmo estado.

As URLs sao publicas e as APIs nao tem autenticacao — o que esta la sao os dados de
exemplo da aula. Terminada a entrega, da para suspender os servicos no painel do Render.

### Alternativa: as duas na mesma rede

Se a rede da sala permitir, nao precisa de nuvem. O `ping` costuma estar bloqueado pelo
firewall do Windows mesmo quando o HTTP funciona, entao vale testar direto:

```powershell
# na maquina que roda a API de Pedidos, apontando para a que roda a de Produtos
Test-NetConnection -ComputerName 192.168.0.42 -Port 8080
```

Se conectar, basta criar um `.env` na pasta `PedidoAPI` com
`PRODUTO_API_URL=http://192.168.0.42:8080`. Se nao conectar, libere a porta no firewall
da maquina que hospeda a API de Produtos (PowerShell como administrador):

```powershell
New-NetFirewallRule -DisplayName "API Produtos 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

Continuando sem passar, a rede tem isolamento entre clientes e o caminho e a nuvem.

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
