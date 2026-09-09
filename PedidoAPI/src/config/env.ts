import fs from 'node:fs';
import path from 'node:path';

/**
 * Leitor de .env bem simples (sem dependencia externa).
 * Se o arquivo nao existir, seguimos so com os valores padrao.
 */
function carregarArquivoEnv(): void {
  const caminho = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(caminho)) return;

  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;

    const separador = limpa.indexOf('=');
    if (separador === -1) continue;

    const chave = limpa.slice(0, separador).trim();
    const valor = limpa.slice(separador + 1).trim().replace(/^["']|["']$/g, '');
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

carregarArquivoEnv();

export const env = {
  porta: Number(process.env.PORT ?? 3000),
  produtoApiUrl: (process.env.PRODUTO_API_URL ?? 'http://localhost:8080').replace(/\/+$/, ''),
  arquivoBanco: process.env.DATABASE_FILE ?? 'pedidos.db',
  timeoutProdutoApi: Number(process.env.PRODUTO_API_TIMEOUT_MS ?? 8000),
};
