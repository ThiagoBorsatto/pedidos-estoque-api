import type { Request, Response } from 'express';
import { z } from 'zod';
import { pedidoService } from '../services/pedidoService';
import { AppError } from '../errors/AppError';

const idSchema = z.coerce.number().int().positive({ message: 'o id do pedido deve ser um numero positivo' });

const novoPedidoSchema = z.object({
  cliente: z.string().trim().min(2, 'o nome do cliente e obrigatorio').max(120),
  observacao: z.string().trim().max(300).nullish(),
  itens: z
    .array(
      z.object({
        produtoId: z.number().int().positive('o produtoId deve ser um numero positivo'),
        quantidade: z.number().int().positive('a quantidade deve ser pelo menos 1'),
      }),
    )
    .min(1, 'o pedido precisa de pelo menos um item'),
});

function validar<T>(schema: z.ZodType<T>, valor: unknown): T {
  const resultado = schema.safeParse(valor);
  if (!resultado.success) {
    throw AppError.dadosInvalidos(
      'um ou mais campos nao passaram na validacao',
      resultado.error.issues.map((i) => ({ campo: i.path.join('.') || '(corpo)', erro: i.message })),
    );
  }
  return resultado.data;
}

export const pedidoController = {
  /** GET /api/pedidos?status=CRIADO&cliente=maria */
  listar(req: Request, res: Response): void {
    const status = req.query.status
      ? validar(z.enum(['CRIADO', 'CANCELADO']), String(req.query.status).toUpperCase())
      : undefined;
    const cliente = typeof req.query.cliente === 'string' ? req.query.cliente : undefined;

    const pedidos = pedidoService.listar(status, cliente);
    res.json({ total: pedidos.length, pedidos });
  },

  /** GET /api/pedidos/:id */
  buscar(req: Request, res: Response): void {
    res.json(pedidoService.buscarPorId(validar(idSchema, req.params.id)));
  },

  /** POST /api/pedidos - baixa o estoque na API de Produtos e grava o pedido. */
  async criar(req: Request, res: Response): Promise<void> {
    const corpo = validar(novoPedidoSchema, req.body);
    const pedido = await pedidoService.criar(corpo);

    res
      .status(201)
      .location(`/api/pedidos/${pedido.id}`)
      .json({ mensagem: `pedido #${pedido.id} criado e estoque baixado na API de Produtos`, pedido });
  },

  /** DELETE /api/pedidos/:id - exclui e devolve o estoque. */
  async excluir(req: Request, res: Response): Promise<void> {
    const id = validar(idSchema, req.params.id);
    const { pedido, devolucoes } = await pedidoService.excluir(id);

    res.json({
      mensagem: `pedido #${id} excluido e estoque devolvido a API de Produtos`,
      pedidoExcluido: { id: pedido.id, cliente: pedido.cliente, total: pedido.total, status: pedido.status },
      devolucoes,
    });
  },

  /** POST /api/pedidos/:id/cancelamento - devolve o estoque mas mantem o historico. */
  async cancelar(req: Request, res: Response): Promise<void> {
    const id = validar(idSchema, req.params.id);
    const { pedido, devolucoes } = await pedidoService.cancelar(id);

    res.json({ mensagem: `pedido #${id} cancelado e estoque devolvido`, pedido, devolucoes });
  },

  /** GET /api/pedidos/resumo */
  resumo(_req: Request, res: Response): void {
    res.json(pedidoService.resumo());
  },
};
