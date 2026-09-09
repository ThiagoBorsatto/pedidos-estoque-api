/** Erro de negocio com status HTTP proprio. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly titulo: string,
    message: string,
    public readonly detalhes?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static naoEncontrado(mensagem: string): AppError {
    return new AppError(404, 'Recurso nao encontrado', mensagem);
  }

  static regraDeNegocio(mensagem: string, detalhes?: unknown): AppError {
    return new AppError(409, 'Conflito de regra de negocio', mensagem, detalhes);
  }

  static dadosInvalidos(mensagem: string, detalhes?: unknown): AppError {
    return new AppError(400, 'Dados invalidos', mensagem, detalhes);
  }

  /** A API de Produtos esta fora do ar ou respondeu algo inesperado. */
  static apiDeProdutos(mensagem: string, detalhes?: unknown): AppError {
    return new AppError(502, 'Falha ao falar com a API de Produtos', mensagem, detalhes);
  }
}
