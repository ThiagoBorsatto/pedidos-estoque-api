import type { Request, Response } from 'express';
import { z } from 'zod';
import { estoqueService } from '../services/estoqueService';
import { produtoClient } from '../clients/produtoClient';
import { AppError } from '../errors/AppError';

const idSchema = z.coerce.number().int().positive({ message: 'o id do produto deve ser um numero positivo' });

const definirEstoqueSchema = z
  .object({
    quantidade: z.number().int().min(0, 'a quantidade nao pode ser negativa').optional(),
    ajuste: z.number().int().refine((n) => n !== 0, 'o ajuste nao pode ser zero').optional(),
    motivo: z.string().trim().max(200).optional(),
  })
  .refine((corpo) => corpo.quantidade !== undefined || corpo.ajuste !== undefined, {
    message: 'informe "quantidade" (valor final) ou "ajuste" (quanto somar/subtrair)',
  })
  .refine((corpo) => !(corpo.quantidade !== undefined && corpo.ajuste !== undefined), {
    message: 'use "quantidade" ou "ajuste", nunca os dois ao mesmo tempo',
  });

const novoProdutoSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  descricao: z.string().trim().max(500).nullish(),
  preco: z.number().positive('o preco deve ser maior que zero'),
  quantidade: z.number().int().min(0),
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

export const estoqueController = {
  /** GET /api/estoque - lista o estoque (consultando a API de Produtos ao vivo). */
  async listar(req: Request, res: Response): Promise<void> {
    const nome = typeof req.query.nome === 'string' ? req.query.nome : undefined;
    const apenasDisponiveis = req.query.disponiveis === 'true';

    const itens = await estoqueService.listar(nome, apenasDisponiveis);

    res.json({
      fonte: 'API de Produtos (Spring Boot)',
      totalDeProdutos: itens.length,
      unidadesEmEstoque: itens.reduce((soma, i) => soma + i.quantidade, 0),
      valorTotalEmEstoque: Number(itens.reduce((soma, i) => soma + i.valorEmEstoque, 0).toFixed(2)),
      itens,
    });
  },

  /** GET /api/estoque/:produtoId */
  async detalhar(req: Request, res: Response): Promise<void> {
    const id = validar(idSchema, req.params.produtoId);
    res.json(await estoqueService.detalhar(id));
  },

  /** PATCH /api/estoque/:produtoId - { quantidade } ou { ajuste } */
  async atualizar(req: Request, res: Response): Promise<void> {
    const id = validar(idSchema, req.params.produtoId);
    const corpo = validar(definirEstoqueSchema, req.body);

    const produto =
      corpo.quantidade !== undefined
        ? await estoqueService.definirQuantidade(id, corpo.quantidade, corpo.motivo)
        : await estoqueService.ajustarQuantidade(id, corpo.ajuste!, corpo.motivo);

    res.json({
      mensagem: `estoque do produto '${produto.nome}' atualizado para ${produto.quantidade}`,
      produto,
    });
  },

  /** POST /api/estoque/produtos - cadastra um produto novo na API de Produtos. */
  async criarProduto(req: Request, res: Response): Promise<void> {
    const corpo = validar(novoProdutoSchema, req.body);

    const produto = await produtoClient.criar({
      nome: corpo.nome,
      descricao: corpo.descricao ?? null,
      preco: corpo.preco,
      quantidade: corpo.quantidade,
    });

    res.status(201).json({ mensagem: `produto '${produto.nome}' cadastrado na API de Produtos`, produto });
  },

  /** GET /api/estoque/movimentacoes - historico gravado no banco de pedidos. */
  movimentacoes(req: Request, res: Response): void {
    const produtoId = req.query.produtoId ? validar(idSchema, req.query.produtoId) : undefined;
    const limite = req.query.limite ? validar(z.coerce.number().int().min(1).max(500), req.query.limite) : 50;

    res.json({ movimentacoes: estoqueService.movimentacoes(produtoId, limite) });
  },
};
