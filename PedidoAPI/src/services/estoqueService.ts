import { agora, db } from '../db/database';
import { AppError } from '../errors/AppError';
import { produtoClient, type Produto } from '../clients/produtoClient';

export type TipoMovimentacao = 'BAIXA' | 'DEVOLUCAO' | 'AJUSTE' | 'ENTRADA';

export interface LinhaEstoque extends Produto {
  situacao: 'ESGOTADO' | 'ESTOQUE_BAIXO' | 'DISPONIVEL';
  reservadoEmPedidos: number;
  valorEmEstoque: number;
}

export interface Baixa {
  produto: Produto;
  quantidade: number;
  saldoAntes: number;
  saldoDepois: number;
}

export interface Devolucao {
  produtoId: number;
  produtoNome: string;
  devolvido: number;
  saldoAntes: number;
  saldoDepois: number;
}

const LIMITE_ESTOQUE_BAIXO = 5;

/**
 * Ler o estoque e depois grava-lo de volta e um "read-modify-write": se duas
 * requisicoes fizerem isso ao mesmo tempo, uma sobrescreve a outra. Como a API
 * de Produtos nao tem endpoint atomico de estoque, serializamos as operacoes
 * de escrita aqui, numa fila unica.
 */
let fila: Promise<unknown> = Promise.resolve();

function emFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = fila.then(operacao, operacao);
  fila = resultado.catch(() => undefined);
  return resultado;
}

function registrarMovimentacao(dados: {
  produtoId: number;
  pedidoId: number | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  saldoAntes: number;
  saldoDepois: number;
  motivo: string | null;
}): void {
  db.prepare(
    `INSERT INTO movimentacoes_estoque
       (produto_id, pedido_id, tipo, quantidade, saldo_antes, saldo_depois, motivo, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    dados.produtoId,
    dados.pedidoId,
    dados.tipo,
    dados.quantidade,
    dados.saldoAntes,
    dados.saldoDepois,
    dados.motivo,
    agora(),
  );
}

function situacaoDe(quantidade: number): LinhaEstoque['situacao'] {
  if (quantidade <= 0) return 'ESGOTADO';
  if (quantidade <= LIMITE_ESTOQUE_BAIXO) return 'ESTOQUE_BAIXO';
  return 'DISPONIVEL';
}

/** Quanto de cada produto esta preso em pedidos ainda ativos. */
function reservasPorProduto(): Map<number, number> {
  const linhas = db
    .prepare(
      `SELECT i.produto_id AS produtoId, SUM(i.quantidade) AS total
         FROM pedido_itens i
         JOIN pedidos p ON p.id = i.pedido_id
        WHERE p.status = 'CRIADO'
        GROUP BY i.produto_id`,
    )
    .all() as Array<{ produtoId: number; total: number }>;

  return new Map(linhas.map((l) => [Number(l.produtoId), Number(l.total)]));
}

function comSituacao(produto: Produto, reservas: Map<number, number>): LinhaEstoque {
  return {
    ...produto,
    situacao: situacaoDe(produto.quantidade),
    reservadoEmPedidos: reservas.get(produto.id) ?? 0,
    valorEmEstoque: Number((produto.preco * produto.quantidade).toFixed(2)),
  };
}

export const estoqueService = {
  /** Lista o estoque atual: dados vivos da API de Produtos + o que temos reservado. */
  async listar(nome?: string, apenasDisponiveis = false): Promise<LinhaEstoque[]> {
    const produtos = await produtoClient.listar(nome);
    const reservas = reservasPorProduto();

    return produtos
      .filter((p) => !apenasDisponiveis || p.quantidade > 0)
      .map((p) => comSituacao(p, reservas));
  },

  async detalhar(produtoId: number): Promise<LinhaEstoque> {
    const produto = await produtoClient.buscarPorId(produtoId);
    return comSituacao(produto, reservasPorProduto());
  },

  /** Define o estoque em um valor absoluto. */
  definirQuantidade(produtoId: number, quantidade: number, motivo?: string): Promise<Produto> {
    return emFila(async () => {
      const produto = await produtoClient.buscarPorId(produtoId);
      const atualizado = await produtoClient.definirQuantidade(produto, quantidade);

      registrarMovimentacao({
        produtoId,
        pedidoId: null,
        tipo: 'AJUSTE',
        quantidade: quantidade - produto.quantidade,
        saldoAntes: produto.quantidade,
        saldoDepois: atualizado.quantidade,
        motivo: motivo ?? 'ajuste manual de estoque',
      });

      return atualizado;
    });
  },

  /** Soma (ou subtrai, com valor negativo) uma quantidade ao estoque atual. */
  ajustarQuantidade(produtoId: number, ajuste: number, motivo?: string): Promise<Produto> {
    return emFila(async () => {
      const produto = await produtoClient.buscarPorId(produtoId);
      const novoSaldo = produto.quantidade + ajuste;

      if (novoSaldo < 0) {
        throw AppError.regraDeNegocio(
          `o ajuste deixaria o estoque negativo: '${produto.nome}' tem ${produto.quantidade} em estoque e o ajuste pedido foi ${ajuste}`,
        );
      }

      const atualizado = await produtoClient.definirQuantidade(produto, novoSaldo);

      registrarMovimentacao({
        produtoId,
        pedidoId: null,
        tipo: ajuste >= 0 ? 'ENTRADA' : 'BAIXA',
        quantidade: ajuste,
        saldoAntes: produto.quantidade,
        saldoDepois: atualizado.quantidade,
        motivo: motivo ?? 'ajuste manual de estoque',
      });

      return atualizado;
    });
  },

  /**
   * Tira do estoque tudo que o pedido precisa.
   * Se algum item falhar no meio do caminho, devolvemos o que ja tinha saido
   * (compensacao) para nao deixar o estoque furado.
   */
  baixarParaPedido(itens: Array<{ produtoId: number; quantidade: number }>): Promise<Baixa[]> {
    return emFila(async () => {
      const baixados: Baixa[] = [];

      try {
        for (const item of itens) {
          const produto = await produtoClient.buscarPorId(item.produtoId);

          if (produto.quantidade < item.quantidade) {
            throw AppError.regraDeNegocio(
              `estoque insuficiente para '${produto.nome}': disponivel ${produto.quantidade}, solicitado ${item.quantidade}`,
              { produtoId: produto.id, disponivel: produto.quantidade, solicitado: item.quantidade },
            );
          }

          const atualizado = await produtoClient.definirQuantidade(produto, produto.quantidade - item.quantidade);

          baixados.push({
            produto: atualizado,
            quantidade: item.quantidade,
            saldoAntes: produto.quantidade,
            saldoDepois: atualizado.quantidade,
          });
        }

        return baixados;
      } catch (erro) {
        // rollback: devolve para o estoque tudo que ja tinha saido antes do erro
        for (const feito of [...baixados].reverse()) {
          try {
            const atual = await produtoClient.buscarPorId(feito.produto.id);
            await produtoClient.definirQuantidade(atual, atual.quantidade + feito.quantidade);
          } catch {
            // se ate o rollback falhar nao ha o que fazer aqui; o erro original segue adiante
          }
        }
        throw erro;
      }
    });
  },

  /** Devolve ao estoque os itens de um pedido excluido/cancelado. */
  devolverDoPedido(
    pedidoId: number,
    itens: Array<{ produtoId: number; quantidade: number }>,
    motivo: string,
  ): Promise<Devolucao[]> {
    return emFila(async () => {
      const devolucoes: Devolucao[] = [];

      for (const item of itens) {
        // Se o produto foi apagado da API de Produtos depois do pedido, avisamos
        // no resultado em vez de derrubar a exclusao do pedido inteiro.
        let produto: Produto;
        try {
          produto = await produtoClient.buscarPorId(item.produtoId);
        } catch {
          devolucoes.push({
            produtoId: item.produtoId,
            produtoNome: '(produto nao existe mais na API de Produtos)',
            devolvido: 0,
            saldoAntes: 0,
            saldoDepois: 0,
          });
          continue;
        }

        const atualizado = await produtoClient.definirQuantidade(produto, produto.quantidade + item.quantidade);

        registrarMovimentacao({
          produtoId: item.produtoId,
          pedidoId,
          tipo: 'DEVOLUCAO',
          quantidade: item.quantidade,
          saldoAntes: produto.quantidade,
          saldoDepois: atualizado.quantidade,
          motivo,
        });

        devolucoes.push({
          produtoId: produto.id,
          produtoNome: produto.nome,
          devolvido: item.quantidade,
          saldoAntes: produto.quantidade,
          saldoDepois: atualizado.quantidade,
        });
      }

      return devolucoes;
    });
  },

  registrarBaixaDePedido(pedidoId: number, baixas: Baixa[]): void {
    for (const baixa of baixas) {
      registrarMovimentacao({
        produtoId: baixa.produto.id,
        pedidoId,
        tipo: 'BAIXA',
        quantidade: -baixa.quantidade,
        saldoAntes: baixa.saldoAntes,
        saldoDepois: baixa.saldoDepois,
        motivo: `baixa pelo pedido #${pedidoId}`,
      });
    }
  },

  /** Historico de movimentacoes gravado no nosso banco. */
  movimentacoes(produtoId?: number, limite = 50) {
    const linhas = (produtoId
      ? db
          .prepare('SELECT * FROM movimentacoes_estoque WHERE produto_id = ? ORDER BY id DESC LIMIT ?')
          .all(produtoId, limite)
      : db.prepare('SELECT * FROM movimentacoes_estoque ORDER BY id DESC LIMIT ?').all(limite)) as Array<
      Record<string, unknown>
    >;

    return linhas.map((l) => ({
      id: Number(l.id),
      produtoId: Number(l.produto_id),
      pedidoId: l.pedido_id === null ? null : Number(l.pedido_id),
      tipo: String(l.tipo),
      quantidade: Number(l.quantidade),
      saldoAntes: Number(l.saldo_antes),
      saldoDepois: Number(l.saldo_depois),
      motivo: l.motivo === null ? null : String(l.motivo),
      criadoEm: String(l.criado_em),
    }));
  },
};
