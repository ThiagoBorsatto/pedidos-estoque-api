import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env';

/**
 * Banco local (SQLite via modulo nativo do Node, sem dependencia externa).
 * Guardamos os PEDIDOS aqui; o estoque continua morando na API de Produtos.
 */
export const db = new DatabaseSync(env.arquivoBanco);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente      TEXT    NOT NULL,
    observacao   TEXT,
    status       TEXT    NOT NULL DEFAULT 'CRIADO',
    total        REAL    NOT NULL DEFAULT 0,
    criado_em    TEXT    NOT NULL,
    atualizado_em TEXT   NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pedido_itens (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id      INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id     INTEGER NOT NULL,
    produto_nome   TEXT    NOT NULL,
    preco_unitario REAL    NOT NULL,
    quantidade     INTEGER NOT NULL,
    subtotal       REAL    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_itens_pedido ON pedido_itens(pedido_id);

  /* Trilha de tudo que mexeu no estoque: quem tirou, quem devolveu e por que. */
  CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id  INTEGER NOT NULL,
    pedido_id   INTEGER,
    tipo        TEXT    NOT NULL,
    quantidade  INTEGER NOT NULL,
    saldo_antes INTEGER NOT NULL,
    saldo_depois INTEGER NOT NULL,
    motivo      TEXT,
    criado_em   TEXT    NOT NULL
  );
`);

export function agora(): string {
  return new Date().toISOString();
}
