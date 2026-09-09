import { criarApp } from './app';
import { env } from './config/env';
import { produtoClient } from './clients/produtoClient';
import './db/database'; // cria/abre o banco e as tabelas ao subir

const app = criarApp();

app.listen(env.porta, async () => {
  console.log('');
  console.log('  PedidoAPI no ar');
  console.log(`  -> http://localhost:${env.porta}`);
  console.log(`  -> API de Produtos: ${env.produtoApiUrl}`);
  console.log(`  -> banco de pedidos: ${env.arquivoBanco}`);

  const noAr = await produtoClient.estaNoAr();
  console.log(
    noAr
      ? '  -> conexao com a API de Produtos: OK'
      : '  -> ATENCAO: a API de Produtos nao respondeu. Suba o Spring Boot antes de criar pedidos.',
  );
  console.log('');
});
