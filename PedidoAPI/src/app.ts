import express from 'express';
import { rotas } from './routes';
import { rotaNaoEncontrada, tratadorDeErros } from './middlewares/erros';
import { env } from './config/env';

export function criarApp() {
  const app = express();

  app.use(express.json());

  // log simples de cada requisicao, para acompanhar os testes no terminal
  app.use((req, _res, next) => {
    console.log(`${new Date().toLocaleTimeString('pt-BR')}  ${req.method} ${req.originalUrl}`);
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      api: 'PedidoAPI',
      descricao: 'API de Pedidos que consome a API de Produtos para controlar o estoque',
      apiDeProdutos: env.produtoApiUrl,
      endpoints: {
        'GET    /health': 'checa a API e a conexao com a API de Produtos',
        'GET    /api/estoque': 'lista o estoque (?nome=, ?disponiveis=true)',
        'GET    /api/estoque/:produtoId': 'detalhe do estoque de um produto',
        'PATCH  /api/estoque/:produtoId': 'atualiza estoque { quantidade } ou { ajuste }',
        'POST   /api/estoque/produtos': 'cadastra um produto novo na API de Produtos',
        'GET    /api/estoque/movimentacoes': 'historico de baixas e devolucoes',
        'GET    /api/pedidos': 'lista pedidos (?status=, ?cliente=)',
        'GET    /api/pedidos/resumo': 'numeros gerais dos pedidos',
        'GET    /api/pedidos/:id': 'detalhe de um pedido',
        'POST   /api/pedidos': 'cria pedido e baixa o estoque',
        'POST   /api/pedidos/:id/cancelamento': 'cancela e devolve o estoque',
        'DELETE /api/pedidos/:id': 'exclui e devolve o estoque',
      },
    });
  });

  app.use(rotas);
  app.use(rotaNaoEncontrada);
  app.use(tratadorDeErros);

  return app;
}
