/**
 * Menu de terminal da PedidoAPI.
 *
 * Ele NAO acessa o banco direto: fala com a propria API por HTTP, do mesmo
 * jeito que o REST Client do VS Code. Assim tudo que voce faz aqui exercita
 * exatamente os endpoints que estamos testando.
 *
 *   npm run menu
 */
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { env } from '../config/env';

const API = `http://localhost:${env.porta}`;

const cor = {
  reset: '\x1b[0m',
  negrito: '\x1b[1m',
  fraco: '\x1b[2m',
  vermelho: '\x1b[31m',
  verde: '\x1b[32m',
  amarelo: '\x1b[33m',
  azul: '\x1b[36m',
};

const rl = readline.createInterface({ input: stdin, output: stdout });

let entradaEncerrada = false;
rl.on('close', () => {
  entradaEncerrada = true;
});

/**
 * Pergunta ao usuario. Devolve null quando a entrada acabou (Ctrl+C, Ctrl+D ou
 * quando o menu e alimentado por um pipe), para o programa sair sem estourar.
 */
async function perguntar(texto: string): Promise<string | null> {
  if (entradaEncerrada) return null;
  try {
    return (await rl.question(texto)).trim();
  } catch {
    entradaEncerrada = true;
    return null;
  }
}

/** Pergunta sim/nao. Enter em branco (ou entrada encerrada) conta como "nao". */
async function confirmar(texto: string): Promise<boolean> {
  const resposta = (await perguntar(texto))?.toLowerCase();
  return resposta === 's' || resposta === 'sim';
}

const dinheiro = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function titulo(texto: string): void {
  console.log(`\n${cor.negrito}${cor.azul}${texto}${cor.reset}`);
  console.log(cor.fraco + '-'.repeat(texto.length) + cor.reset);
}

function ok(texto: string): void {
  console.log(`${cor.verde}${texto}${cor.reset}`);
}

function falha(texto: string): void {
  console.log(`${cor.vermelho}${texto}${cor.reset}`);
}

/** Chama a PedidoAPI e ja mostra o erro formatado quando algo da errado. */
async function api<T>(caminho: string, init?: RequestInit): Promise<T | null> {
  let resposta: Response;

  try {
    resposta = await fetch(`${API}${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    falha(`\nNao consegui falar com a PedidoAPI em ${API}. Ela esta rodando? (npm run dev)`);
    return null;
  }

  const corpo = resposta.status === 204 ? null : await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const erro = corpo as { titulo?: string; detalhe?: string; erros?: unknown } | null;
    falha(`\n[${resposta.status}] ${erro?.titulo ?? 'erro'}: ${erro?.detalhe ?? 'sem detalhes'}`);
    if (erro?.erros) console.log(cor.fraco + JSON.stringify(erro.erros, null, 2) + cor.reset);
    return null;
  }

  return corpo as T;
}

interface ItemEstoque {
  id: number;
  nome: string;
  preco: number;
  quantidade: number;
  situacao: string;
  reservadoEmPedidos: number;
}

interface Pedido {
  id: number;
  cliente: string;
  status: string;
  total: number;
  criadoEm: string;
  itens: Array<{ produtoId: number; produtoNome: string; quantidade: number; precoUnitario: number; subtotal: number }>;
}

function tabelaEstoque(itens: ItemEstoque[]): void {
  if (itens.length === 0) {
    console.log(cor.fraco + '  (nenhum produto cadastrado na API de Produtos)' + cor.reset);
    return;
  }

  console.log(
    `${cor.fraco}  ${'ID'.padEnd(5)}${'PRODUTO'.padEnd(28)}${'PRECO'.padStart(12)}${'QTD'.padStart(6)}${'RESERV.'.padStart(9)}   SITUACAO${cor.reset}`,
  );

  for (const item of itens) {
    const marcador =
      item.situacao === 'ESGOTADO' ? cor.vermelho : item.situacao === 'ESTOQUE_BAIXO' ? cor.amarelo : cor.verde;

    console.log(
      `  ${String(item.id).padEnd(5)}${item.nome.slice(0, 27).padEnd(28)}${dinheiro(item.preco).padStart(12)}` +
        `${String(item.quantidade).padStart(6)}${String(item.reservadoEmPedidos).padStart(9)}   ${marcador}${item.situacao}${cor.reset}`,
    );
  }
}

function mostrarPedido(pedido: Pedido): void {
  const marcador = pedido.status === 'CANCELADO' ? cor.amarelo : cor.verde;
  console.log(
    `\n  ${cor.negrito}Pedido #${pedido.id}${cor.reset} - ${pedido.cliente}  ${marcador}[${pedido.status}]${cor.reset}` +
      `  ${cor.fraco}${new Date(pedido.criadoEm).toLocaleString('pt-BR')}${cor.reset}`,
  );

  for (const item of pedido.itens) {
    console.log(
      `    ${String(item.quantidade).padStart(3)}x ${item.produtoNome.padEnd(26)} ${dinheiro(item.precoUnitario).padStart(11)} = ${dinheiro(item.subtotal)}`,
    );
  }

  console.log(`    ${cor.negrito}TOTAL: ${dinheiro(pedido.total)}${cor.reset}`);
}

// ------------------------------------------------------------------ acoes ---

async function verEstoque(apenasDisponiveis = false): Promise<ItemEstoque[]> {
  const resposta = await api<{ itens: ItemEstoque[]; unidadesEmEstoque: number; valorTotalEmEstoque: number }>(
    `/api/estoque${apenasDisponiveis ? '?disponiveis=true' : ''}`,
  );
  if (!resposta) return [];

  titulo(apenasDisponiveis ? 'Produtos disponiveis' : 'Estoque completo');
  tabelaEstoque(resposta.itens);
  console.log(
    `${cor.fraco}  ${resposta.unidadesEmEstoque} unidades - valor total ${dinheiro(resposta.valorTotalEmEstoque)}${cor.reset}`,
  );

  return resposta.itens;
}

async function criarPedido(): Promise<void> {
  const disponiveis = await verEstoque(true);
  if (disponiveis.length === 0) return;

  const cliente = await perguntar('\nNome do cliente: ');
  if (!cliente || cliente.length < 2) return falha('nome do cliente muito curto.');

  const itens: Array<{ produtoId: number; quantidade: number }> = [];

  console.log(cor.fraco + 'Adicione os itens do pedido.' + cor.reset);

  for (;;) {
    const idTexto = await perguntar('  ID do produto: ');
    if (idTexto === null) return; // entrada encerrada
    if (!idTexto) {
      falha('  informe o ID de um produto da lista acima.');
      continue;
    }

    const produtoId = Number(idTexto);
    const produto = disponiveis.find((p) => p.id === produtoId);
    if (!produto) {
      falha('  produto nao esta na lista de disponiveis.');
      continue;
    }

    const quantidade = Number(await perguntar(`  Quantidade de '${produto.nome}' (max ${produto.quantidade}): `));
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      falha('  quantidade invalida.');
      continue;
    }

    itens.push({ produtoId, quantidade });
    ok(`  + ${quantidade}x ${produto.nome}`);

    if (!(await confirmar('  Adicionar outro item? (s/N) '))) break;
  }

  if (itens.length === 0) return falha('pedido sem itens, nada foi criado.');

  titulo('Itens do pedido');
  for (const item of itens) {
    const produto = disponiveis.find((p) => p.id === item.produtoId)!;
    console.log(`  ${String(item.quantidade).padStart(3)}x ${produto.nome}`);
  }

  const observacao = await perguntar('Observacao (opcional): ');

  const resposta = await api<{ mensagem: string; pedido: Pedido }>('/api/pedidos', {
    method: 'POST',
    body: JSON.stringify({ cliente, observacao: observacao || null, itens }),
  });

  if (resposta) {
    ok(`\n${resposta.mensagem}`);
    mostrarPedido(resposta.pedido);
  }
}

async function listarPedidos(): Promise<void> {
  const resposta = await api<{ total: number; pedidos: Pedido[] }>('/api/pedidos');
  if (!resposta) return;

  titulo(`Pedidos (${resposta.total})`);
  if (resposta.total === 0) {
    console.log(cor.fraco + '  (nenhum pedido ainda)' + cor.reset);
    return;
  }

  resposta.pedidos.forEach(mostrarPedido);
}

async function detalharPedido(): Promise<void> {
  const id = await perguntar('\nID do pedido: ');
  const pedido = await api<Pedido>(`/api/pedidos/${id}`);
  if (pedido) mostrarPedido(pedido);
}

async function excluirPedido(): Promise<void> {
  await listarPedidos();

  const id = await perguntar('\nID do pedido a excluir: ');
  if (!id) return;

  if (!(await confirmar(`Confirma excluir o pedido #${id} e devolver o estoque? (s/N) `))) {
    return console.log('operacao cancelada.');
  }

  const resposta = await api<{
    mensagem: string;
    devolucoes: Array<{ produtoNome: string; devolvido: number; saldoAntes: number; saldoDepois: number }>;
  }>(`/api/pedidos/${id}`, { method: 'DELETE' });

  if (!resposta) return;

  ok(`\n${resposta.mensagem}`);
  titulo('Estoque devolvido');
  for (const d of resposta.devolucoes) {
    console.log(`  ${d.produtoNome}: +${d.devolvido}  (${d.saldoAntes} -> ${d.saldoDepois})`);
  }
}

async function cancelarPedido(): Promise<void> {
  const id = await perguntar('\nID do pedido a cancelar: ');
  if (!id) return;

  const resposta = await api<{ mensagem: string; pedido: Pedido }>(`/api/pedidos/${id}/cancelamento`, {
    method: 'POST',
  });

  if (resposta) {
    ok(`\n${resposta.mensagem}`);
    mostrarPedido(resposta.pedido);
  }
}

async function atualizarEstoque(): Promise<void> {
  await verEstoque();

  const produtoId = await perguntar('\nID do produto: ');
  if (!produtoId) return;

  console.log('  1) definir a quantidade final    2) somar/subtrair uma quantidade');
  const modo = await perguntar('  Escolha: ');

  const valor = Number(await perguntar(modo === '2' ? '  Ajuste (ex: 10 ou -3): ' : '  Nova quantidade: '));
  if (!Number.isInteger(valor)) return falha('valor invalido.');

  const motivo = await perguntar('  Motivo (opcional): ');

  const corpo = modo === '2' ? { ajuste: valor, motivo: motivo || undefined } : { quantidade: valor, motivo: motivo || undefined };

  const resposta = await api<{ mensagem: string }>(`/api/estoque/${produtoId}`, {
    method: 'PATCH',
    body: JSON.stringify(corpo),
  });

  if (resposta) ok(`\n${resposta.mensagem}`);
}

async function cadastrarProduto(): Promise<void> {
  titulo('Novo produto na API de Produtos');

  const nome = await perguntar('  Nome: ');
  const descricao = await perguntar('  Descricao: ');
  const preco = Number((await perguntar('  Preco (ex: 149.90): '))?.replace(',', '.'));
  const quantidade = Number(await perguntar('  Quantidade inicial: '));

  if (!nome || !Number.isFinite(preco) || !Number.isInteger(quantidade)) {
    return falha('dados invalidos, produto nao cadastrado.');
  }

  const resposta = await api<{ mensagem: string }>('/api/estoque/produtos', {
    method: 'POST',
    body: JSON.stringify({ nome, descricao: descricao || null, preco, quantidade }),
  });

  if (resposta) ok(`\n${resposta.mensagem}`);
}

async function verMovimentacoes(): Promise<void> {
  const resposta = await api<{
    movimentacoes: Array<{
      produtoId: number;
      pedidoId: number | null;
      tipo: string;
      quantidade: number;
      saldoAntes: number;
      saldoDepois: number;
      motivo: string | null;
      criadoEm: string;
    }>;
  }>('/api/estoque/movimentacoes?limite=20');

  if (!resposta) return;

  titulo('Ultimas movimentacoes de estoque');
  if (resposta.movimentacoes.length === 0) {
    console.log(cor.fraco + '  (nenhuma movimentacao registrada)' + cor.reset);
    return;
  }

  for (const m of resposta.movimentacoes) {
    const sinal = m.quantidade >= 0 ? `+${m.quantidade}` : String(m.quantidade);
    const marcador = m.quantidade >= 0 ? cor.verde : cor.amarelo;

    console.log(
      `  ${cor.fraco}${new Date(m.criadoEm).toLocaleString('pt-BR')}${cor.reset}  ` +
        `${marcador}${m.tipo.padEnd(10)}${sinal.padStart(5)}${cor.reset}  produto ${m.produtoId}  ` +
        `(${m.saldoAntes} -> ${m.saldoDepois})  ${cor.fraco}${m.motivo ?? ''}${cor.reset}`,
    );
  }
}

async function verResumo(): Promise<void> {
  const resumo = await api<{
    pedidos: number;
    ativos: number;
    cancelados: number;
    itensReservados: number;
    valorEmPedidosAtivos: number;
  }>('/api/pedidos/resumo');

  if (!resumo) return;

  titulo('Resumo');
  console.log(`  Pedidos criados ....... ${resumo.pedidos}`);
  console.log(`  Ativos ................ ${resumo.ativos}`);
  console.log(`  Cancelados ............ ${resumo.cancelados}`);
  console.log(`  Itens reservados ...... ${resumo.itensReservados}`);
  console.log(`  Valor em pedidos ativos ${dinheiro(resumo.valorEmPedidosAtivos)}`);
}

async function verSaude(): Promise<void> {
  const saude = await api<{ status: string; apiDeProdutos: { url: string; disponivel: boolean } }>('/health');
  if (!saude) return;

  titulo('Saude das APIs');
  console.log(`  PedidoAPI ........ ${cor.verde}no ar${cor.reset} (${API})`);
  console.log(
    `  API de Produtos .. ${saude.apiDeProdutos.disponivel ? cor.verde + 'no ar' : cor.vermelho + 'fora do ar'}${cor.reset} (${saude.apiDeProdutos.url})`,
  );
}

// ------------------------------------------------------------------- menu ---

const MENU = `
${cor.negrito}${cor.azul}==============================================${cor.reset}
${cor.negrito}   PedidoAPI - painel de pedidos e estoque${cor.reset}
${cor.negrito}${cor.azul}==============================================${cor.reset}

  ${cor.negrito}Estoque${cor.reset}
   1) Ver estoque completo
   2) Ver apenas produtos disponiveis
   3) Atualizar estoque de um produto
   4) Cadastrar produto novo
   5) Historico de movimentacoes

  ${cor.negrito}Pedidos${cor.reset}
   6) Criar pedido
   7) Listar pedidos
   8) Detalhar um pedido
   9) Cancelar pedido (devolve o estoque)
  10) Excluir pedido (devolve o estoque)

  ${cor.negrito}Outros${cor.reset}
  11) Resumo
  12) Saude das APIs
   0) Sair
`;

const acoes: Record<string, () => Promise<void>> = {
  '1': async () => void (await verEstoque()),
  '2': async () => void (await verEstoque(true)),
  '3': atualizarEstoque,
  '4': cadastrarProduto,
  '5': verMovimentacoes,
  '6': criarPedido,
  '7': listarPedidos,
  '8': detalharPedido,
  '9': cancelarPedido,
  '10': excluirPedido,
  '11': verResumo,
  '12': verSaude,
};

async function principal(): Promise<void> {
  console.log(MENU);
  await verSaude();

  for (;;) {
    const opcao = (await perguntar(`\n${cor.negrito}Opcao (m = menu, 0 = sair): ${cor.reset}`))?.toLowerCase();

    // opcao === undefined -> a entrada acabou (Ctrl+D / pipe): encerramos
    if (opcao === undefined || opcao === '0' || opcao === 'sair') break;
    if (opcao === 'm' || opcao === '') {
      console.log(MENU);
      continue;
    }

    const acao = acoes[opcao];
    if (!acao) {
      falha('opcao invalida. Digite "m" para ver o menu.');
      continue;
    }

    try {
      await acao();
    } catch (erro) {
      falha(`erro inesperado: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }

  rl.close();
  console.log('\nate mais!\n');
}

principal();
