import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError';

/**
 * O Express 4 nao captura erros de funcoes async sozinho: sem isso, uma promise
 * rejeitada derrubaria a requisicao em vez de cair no tratador abaixo.
 */
export function assincrono(handler: (req: Request, res: Response) => unknown): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function rotaNaoEncontrada(req: Request, res: Response): void {
  res.status(404).json({
    status: 404,
    titulo: 'Rota nao encontrada',
    detalhe: `nenhum endpoint mapeado para ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Traduz qualquer erro para um JSON no mesmo espirito do RFC 7807 usado pela
 * API de Produtos, para os dois lados responderem de forma parecida.
 */
export function tratadorDeErros(erro: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (erro instanceof AppError) {
    res.status(erro.status).json({
      status: erro.status,
      titulo: erro.titulo,
      detalhe: erro.message,
      erros: erro.detalhes,
      caminho: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (erro instanceof SyntaxError && 'body' in erro) {
    res.status(400).json({
      status: 400,
      titulo: 'Corpo da requisicao invalido',
      detalhe: 'nao foi possivel ler o JSON enviado',
      caminho: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  console.error('[erro nao tratado]', erro);

  res.status(500).json({
    status: 500,
    titulo: 'Erro interno',
    detalhe: erro instanceof Error ? erro.message : 'erro inesperado',
    caminho: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
}
