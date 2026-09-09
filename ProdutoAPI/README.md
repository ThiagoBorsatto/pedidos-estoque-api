# AulaAPI

API REST de exemplo em Spring Boot 4 com CRUD completo de produtos.

## Stack

- Java 17 · Spring Boot 4.1.1 (Spring Framework 7)
- Spring Web MVC + Jackson 3
- Spring Data JPA + Hibernate 7
- Banco H2 em memoria
- Bean Validation (Jakarta)

## Como rodar

```bash
./mvnw spring-boot:run
```

A aplicacao sobe em `http://localhost:8080`.
O console do banco fica em `http://localhost:8080/h2-console`
(JDBC URL `jdbc:h2:mem:auladb`, usuario `sa`, senha em branco).

Ao iniciar, tres produtos de exemplo sao inseridos automaticamente.

## Testes

```bash
./mvnw test
```

## Endpoints

| Metodo | Rota                        | Descricao                          | Status de sucesso |
|--------|-----------------------------|------------------------------------|-------------------|
| GET    | `/ola`                      | Ping da aplicacao                  | 200               |
| GET    | `/api/produtos`             | Lista produtos (ordenados por nome)| 200               |
| GET    | `/api/produtos?nome=mouse`  | Filtra pelo nome (contem, sem case)| 200               |
| GET    | `/api/produtos/{id}`        | Busca um produto                   | 200               |
| POST   | `/api/produtos`             | Cria um produto                    | 201 + `Location`  |
| PUT    | `/api/produtos/{id}`        | Atualiza um produto inteiro        | 200               |
| DELETE | `/api/produtos/{id}`        | Remove um produto                  | 204               |

### Corpo da requisicao (POST e PUT)

```json
{
  "nome": "Teclado mecanico",
  "descricao": "Switch azul, ABNT2",
  "preco": 249.90,
  "quantidade": 10
}
```

Regras de validacao:

| Campo        | Regra                                              |
|--------------|----------------------------------------------------|
| `nome`       | obrigatorio, ate 120 caracteres, unico             |
| `descricao`  | opcional, ate 500 caracteres                       |
| `preco`      | obrigatorio, maior que zero, ate 2 casas decimais  |
| `quantidade` | obrigatoria, maior ou igual a zero                 |

### Exemplos

```bash
# criar
curl -i -X POST http://localhost:8080/api/produtos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Webcam HD","descricao":"1080p","preco":199.90,"quantidade":8}'

# listar / filtrar
curl http://localhost:8080/api/produtos
curl "http://localhost:8080/api/produtos?nome=web"

# buscar, atualizar e remover
curl http://localhost:8080/api/produtos/1
curl -X PUT http://localhost:8080/api/produtos/1 \
  -H "Content-Type: application/json" \
  -d '{"nome":"Webcam 4K","descricao":"2160p","preco":499.90,"quantidade":4}'
curl -i -X DELETE http://localhost:8080/api/produtos/1
```

## Respostas de erro

Todos os erros seguem o formato RFC 7807 (`application/problem+json`):

| Situacao                        | Status |
|---------------------------------|--------|
| Validacao de campo falhou       | 400    |
| JSON malformado                 | 400    |
| Parametro de tipo invalido      | 400    |
| Produto inexistente             | 404    |
| Nome de produto duplicado       | 409    |

```json
{
  "status": 400,
  "title": "Dados invalidos",
  "detail": "um ou mais campos nao passaram na validacao",
  "instance": "/api/produtos",
  "timestamp": "2026-09-01T20:39:11.708",
  "erros": {
    "nome": "o nome e obrigatorio",
    "preco": "o preco deve ser maior que zero"
  }
}
```

## Estrutura

```
com.aula.AulaAPI
├── AulaApiApplication.java
├── config/CarregadorDeDados.java        # dados de exemplo (fora do perfil "test")
├── controller/                          # entrada HTTP e validacao
├── dto/                                 # contratos de entrada e saida
├── entity/Produto.java                  # mapeamento JPA
├── exception/                           # excecoes + tratador global
├── repository/ProdutoRepository.java    # acesso ao banco
└── service/ProdutoService.java          # regras de negocio
```
