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

  // Hospedagens as vezes injetam so o nome interno do servico ("produto-api-r866"):
  // sem dominio nenhuma DNS resolve, e o erro que aparece e um "fetch failed" seco.
  const host = new URL(env.produtoApiUrl).hostname;
  if (!host.includes('.') && host !== 'localhost') {
    console.log(
      `  -> ATENCAO: "${host}" nao parece um endereco completo. Use a URL publica` +
        ' da API de Produtos (ex.: https://produto-api-xxxx.onrender.com).',
    );
  }

  const noAr = await produtoClient.estaNoAr();
  console.log(
    noAr
      ? '  -> conexao com a API de Produtos: OK'
      : '  -> ATENCAO: a API de Produtos nao respondeu. Suba o Spring Boot antes de criar pedidos.',
  );
  console.log('');
});
