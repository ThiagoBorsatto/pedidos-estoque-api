import { Router } from 'express';
import { pedidoController } from '../controllers/pedidoController';
import { estoqueController } from '../controllers/estoqueController';
import { produtoClient } from '../clients/produtoClient';
import { assincrono } from '../middlewares/erros';
import { env } from '../config/env';

export const rotas = Router();

// ---------------------------------------------------------------- diagnostico
rotas.get(
  '/health',
  assincrono(async (_req, res) => {
    const produtosNoAr = await produtoClient.estaNoAr();
    res.status(produtosNoAr ? 200 : 503).json({
      api: 'PedidoAPI',
      status: produtosNoAr ? 'ok' : 'degradado',
      apiDeProdutos: { url: env.produtoApiUrl, disponivel: produtosNoAr },
      timestamp: new Date().toISOString(),
    });
  }),
);

// -------------------------------------------------------------------- estoque
// (tudo aqui conversa com a API de Produtos por baixo dos panos)
rotas.get('/api/estoque/movimentacoes', estoqueController.movimentacoes);
rotas.get('/api/estoque', assincrono(estoqueController.listar));
rotas.get('/api/estoque/:produtoId', assincrono(estoqueController.detalhar));
rotas.patch('/api/estoque/:produtoId', assincrono(estoqueController.atualizar));
rotas.post('/api/estoque/produtos', assincrono(estoqueController.criarProduto));

// -------------------------------------------------------------------- pedidos
// "/resumo" precisa vir antes de "/:id", senao o Express trataria "resumo" como id
rotas.get('/api/pedidos/resumo', pedidoController.resumo);
rotas.get('/api/pedidos', pedidoController.listar);
rotas.get('/api/pedidos/:id', pedidoController.buscar);
rotas.post('/api/pedidos', assincrono(pedidoController.criar));
rotas.post('/api/pedidos/:id/cancelamento', assincrono(pedidoController.cancelar));
rotas.delete('/api/pedidos/:id', assincrono(pedidoController.excluir));
