import { agora, db } from '../db/database';
import { AppError } from '../errors/AppError';
import { estoqueService } from './estoqueService';
import type { Devolucao } from './estoqueService';

export interface ItemPedido {
  id: number;
  produtoId: number;
  produtoNome: string;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
}

export interface Pedido {
  id: number;
  cliente: string;
  observacao: string | null;
  status: 'CRIADO' | 'CANCELADO';
  total: number;
  itens: ItemPedido[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface NovoPedido {
  cliente: string;
  observacao?: string | null;
  itens: Array<{ produtoId: number; quantidade: number }>;
}

function montarPedido(linha: Record<string, unknown>): Pedido {
  const id = Number(linha.id);

  const itens = (
    db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ? ORDER BY id').all(id) as Array<Record<string, unknown>>
  ).map((i) => ({
    id: Number(i.id),
    produtoId: Number(i.produto_id),
    produtoNome: String(i.produto_nome),
    precoUnitario: Number(i.preco_unitario),
    quantidade: Number(i.quantidade),
    subtotal: Number(i.subtotal),
  }));

  return {
    id,
    cliente: String(linha.cliente),
    observacao: linha.observacao === null ? null : String(linha.observacao),
    status: String(linha.status) as Pedido['status'],
    total: Number(linha.total),
    itens,
    criadoEm: String(linha.criado_em),
    atualizadoEm: String(linha.atualizado_em),
  };
}

/** Junta linhas repetidas do mesmo produto: 2x + 3x do produto 1 vira 5x. */
function agruparItens(itens: NovoPedido['itens']): Array<{ produtoId: number; quantidade: number }> {
  const mapa = new Map<number, number>();
  for (const item of itens) {
    mapa.set(item.produtoId, (mapa.get(item.produtoId) ?? 0) + item.quantidade);
  }
  return [...mapa].map(([produtoId, quantidade]) => ({ produtoId, quantidade }));
}

export const pedidoService = {
  listar(status?: Pedido['status'], cliente?: string): Pedido[] {
    const condicoes: string[] = [];
    const parametros: Array<string> = [];

    if (status) {
      condicoes.push('status = ?');
      parametros.push(status);
    }
    if (cliente) {
      condicoes.push('LOWER(cliente) LIKE ?');
      parametros.push(`%${cliente.toLowerCase()}%`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const linhas = db
      .prepare(`SELECT * FROM pedidos ${where} ORDER BY id DESC`)
      .all(...parametros) as Array<Record<string, unknown>>;

    return linhas.map(montarPedido);
  },

  buscarPorId(id: number): Pedido {
    const linha = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!linha) throw AppError.naoEncontrado(`pedido nao encontrado para o id ${id}`);
    return montarPedido(linha);
  },

  /**
   * Cria o pedido: valida os produtos na API de Produtos, da baixa no estoque
   * e so entao grava o pedido aqui. Se a baixa falhar, nada e gravado.
   */
  async criar(dados: NovoPedido): Promise<Pedido> {
    const itens = agruparItens(dados.itens);
    if (itens.length === 0) {
      throw AppError.dadosInvalidos('o pedido precisa de pelo menos um item');
    }

    // 1) reserva no estoque (API de Produtos) - ja valida existencia e saldo
    const baixas = await estoqueService.baixarParaPedido(itens);

    // 2) grava o pedido no nosso banco, em transacao
    const dataHora = agora();
    const total = Number(
      baixas.reduce((soma, b) => soma + b.produto.preco * b.quantidade, 0).toFixed(2),
    );

    let pedidoId: number;

    try {
      db.exec('BEGIN');

      const resultado = db
        .prepare(
          `INSERT INTO pedidos (cliente, observacao, status, total, criado_em, atualizado_em)
           VALUES (?, ?, 'CRIADO', ?, ?, ?)`,
        )
        .run(dados.cliente.trim(), dados.observacao?.trim() || null, total, dataHora, dataHora);

      pedidoId = Number(resultado.lastInsertRowid);

      const inserirItem = db.prepare(
        `INSERT INTO pedido_itens (pedido_id, produto_id, produto_nome, preco_unitario, quantidade, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );

      for (const baixa of baixas) {
        inserirItem.run(
          pedidoId,
          baixa.produto.id,
          baixa.produto.nome,
          baixa.produto.preco,
          baixa.quantidade,
          Number((baixa.produto.preco * baixa.quantidade).toFixed(2)),
        );
      }

      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');

      // o estoque ja tinha sido baixado: devolve tudo para nao perder produto
      await estoqueService.devolverDoPedido(
        0,
        baixas.map((b) => ({ produtoId: b.produto.id, quantidade: b.quantidade })),
        'falha ao gravar o pedido no banco local',
      );
      throw erro;
    }

    estoqueService.registrarBaixaDePedido(pedidoId, baixas);
    return this.buscarPorId(pedidoId);
  },

  /**
   * Exclui o pedido e devolve cada item para o estoque da API de Produtos.
   * Devolvemos exatamente a quantidade que saiu, para o produto de onde saiu.
   */
  async excluir(id: number): Promise<{ pedido: Pedido; devolucoes: Devolucao[] }> {
    const pedido = this.buscarPorId(id);

    const devolucoes =
      pedido.status === 'CANCELADO'
        ? [] // ja tinha sido cancelado: o estoque ja voltou antes
        : await estoqueService.devolverDoPedido(
            pedido.id,
            pedido.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
            `exclusao do pedido #${pedido.id}`,
          );

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM pedido_itens WHERE pedido_id = ?').run(id);
      db.prepare('DELETE FROM pedidos WHERE id = ?').run(id);
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }

    return { pedido, devolucoes };
  },

  /** Cancela sem apagar: o estoque volta e o pedido fica no historico. */
  async cancelar(id: number): Promise<{ pedido: Pedido; devolucoes: Devolucao[] }> {
    const pedido = this.buscarPorId(id);

    if (pedido.status === 'CANCELADO') {
      throw AppError.regraDeNegocio(`o pedido #${id} ja esta cancelado`);
    }

    const devolucoes = await estoqueService.devolverDoPedido(
      pedido.id,
      pedido.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      `cancelamento do pedido #${pedido.id}`,
    );

    db.prepare("UPDATE pedidos SET status = 'CANCELADO', atualizado_em = ? WHERE id = ?").run(agora(), id);

    return { pedido: this.buscarPorId(id), devolucoes };
  },

  /** Numeros rapidos para o menu do terminal e para o endpoint de resumo. */
  resumo() {
    const linha = db
      .prepare(
        `SELECT
           COUNT(*)                                              AS total,
           SUM(CASE WHEN status = 'CRIADO'    THEN 1 ELSE 0 END) AS criados,
           SUM(CASE WHEN status = 'CANCELADO' THEN 1 ELSE 0 END) AS cancelados,
           COALESCE(SUM(CASE WHEN status = 'CRIADO' THEN total ELSE 0 END), 0) AS valorAtivo
         FROM pedidos`,
      )
      .get() as Record<string, unknown>;

    const itens = db
      .prepare("SELECT COALESCE(SUM(i.quantidade), 0) AS total FROM pedido_itens i JOIN pedidos p ON p.id = i.pedido_id WHERE p.status = 'CRIADO'")
      .get() as Record<string, unknown>;

    return {
      pedidos: Number(linha.total ?? 0),
      ativos: Number(linha.criados ?? 0),
      cancelados: Number(linha.cancelados ?? 0),
      itensReservados: Number(itens.total ?? 0),
      valorEmPedidosAtivos: Number(Number(linha.valorAtivo ?? 0).toFixed(2)),
    };
  },
};
