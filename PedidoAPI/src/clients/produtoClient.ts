import { env } from '../config/env';
import { AppError } from '../errors/AppError';

/** Espelha o ProdutoResponse devolvido pela API Spring Boot. */
export interface Produto {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  quantidade: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** Corpo aceito pelo PUT /api/produtos/{id} da API de Produtos. */
interface ProdutoRequest {
  nome: string;
  descricao: string | null;
  preco: number;
  quantidade: number;
}

const BASE = `${env.produtoApiUrl}/api/produtos`;

async function chamar<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  let resposta: Response;

  try {
    resposta = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(env.timeoutProdutoApi),
    });
  } catch (erro) {
    const causa = erro instanceof Error ? erro.message : String(erro);
    throw AppError.apiDeProdutos(
      `nao consegui falar com a API de Produtos em ${env.produtoApiUrl} (ela esta rodando?)`,
      causa,
    );
  }

  if (resposta.status === 204) return null;

  const texto = await resposta.text();
  const corpo = texto ? seguroJson(texto) : null;

  if (resposta.ok) return corpo as T;

  if (resposta.status === 404) {
    throw AppError.naoEncontrado(extrairDetalhe(corpo) ?? 'produto nao encontrado na API de Produtos');
  }

  throw AppError.apiDeProdutos(
    `a API de Produtos respondeu ${resposta.status}: ${extrairDetalhe(corpo) ?? resposta.statusText}`,
    corpo,
  );
}

function seguroJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/** As respostas de erro do Spring vem em RFC 7807 (campo "detail"). */
function extrairDetalhe(corpo: unknown): string | null {
  if (corpo && typeof corpo === 'object' && 'detail' in corpo) {
    return String((corpo as { detail: unknown }).detail);
  }
  return typeof corpo === 'string' && corpo ? corpo : null;
}

export const produtoClient = {
  async listar(nome?: string): Promise<Produto[]> {
    const url = nome ? `${BASE}?nome=${encodeURIComponent(nome)}` : BASE;
    return (await chamar<Produto[]>(url)) ?? [];
  },

  async buscarPorId(id: number): Promise<Produto> {
    const produto = await chamar<Produto>(`${BASE}/${id}`);
    if (!produto) throw AppError.naoEncontrado(`produto ${id} nao encontrado`);
    return produto;
  },

  async criar(dados: ProdutoRequest): Promise<Produto> {
    const criado = await chamar<Produto>(BASE, { method: 'POST', body: JSON.stringify(dados) });
    if (!criado) throw AppError.apiDeProdutos('a API de Produtos nao devolveu o produto criado');
    return criado;
  },

  /**
   * A API de Produtos so expoe PUT (substituicao completa), entao para mexer
   * apenas no estoque reenviamos os demais campos do jeito que estao.
   */
  async definirQuantidade(produto: Produto, novaQuantidade: number): Promise<Produto> {
    const atualizado = await chamar<Produto>(`${BASE}/${produto.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nome: produto.nome,
        descricao: produto.descricao,
        preco: produto.preco,
        quantidade: novaQuantidade,
      } satisfies ProdutoRequest),
    });

    if (!atualizado) throw AppError.apiDeProdutos('a API de Produtos nao devolveu o produto atualizado');
    return atualizado;
  },

  async remover(id: number): Promise<void> {
    await chamar<void>(`${BASE}/${id}`, { method: 'DELETE' });
  },

  /** Usado pelo /health e pelo menu do terminal. */
  async estaNoAr(): Promise<boolean> {
    try {
      await fetch(BASE, { signal: AbortSignal.timeout(2500) });
      return true;
    } catch {
      return false;
    }
  },
};
