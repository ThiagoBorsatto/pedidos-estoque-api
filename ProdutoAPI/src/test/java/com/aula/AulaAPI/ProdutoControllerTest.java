package com.aula.AulaAPI;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.aula.AulaAPI.repository.ProdutoRepository;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProdutoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProdutoRepository repository;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String JSON_VALIDO = """
            {"nome":"Cadeira gamer","descricao":"Reclinavel","preco":1299.90,"quantidade":3}
            """;

    @BeforeEach
    void limparBase() {
        repository.deleteAll();
    }

    @Test
    void deveCriarProdutoERetornar201ComLocation() throws Exception {
        mockMvc.perform(post("/api/produtos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON_VALIDO))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nome").value("Cadeira gamer"))
                .andExpect(jsonPath("$.quantidade").value(3));
    }

    @Test
    void deveListarProdutos() throws Exception {
        criarProduto();

        mockMvc.perform(get("/api/produtos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].nome").value("Cadeira gamer"));
    }

    @Test
    void deveFiltrarPorNome() throws Exception {
        criarProduto();

        mockMvc.perform(get("/api/produtos").param("nome", "cadeira"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get("/api/produtos").param("nome", "inexistente"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deveBuscarPorId() throws Exception {
        long id = criarProduto();

        mockMvc.perform(get("/api/produtos/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) id));
    }

    @Test
    void deveAtualizarProduto() throws Exception {
        long id = criarProduto();
        String criadoEm = mockMvc.perform(get("/api/produtos/{id}", id))
                .andReturn().getResponse().getContentAsString();
        criadoEm = objectMapper.readTree(criadoEm).get("atualizadoEm").asString();

        mockMvc.perform(put("/api/produtos/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Cadeira de escritorio","descricao":"Ergonomica","preco":999.00,"quantidade":7}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Cadeira de escritorio"))
                .andExpect(jsonPath("$.quantidade").value(7))
                // o carimbo de atualizacao precisa avancar em relacao ao de criacao
                .andExpect(jsonPath("$.atualizadoEm").value(not(equalTo(criadoEm))));
    }

    @Test
    void deveRemoverProduto() throws Exception {
        long id = criarProduto();

        mockMvc.perform(delete("/api/produtos/{id}", id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/produtos/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void deveRetornar404ParaIdInexistente() throws Exception {
        mockMvc.perform(get("/api/produtos/{id}", 9999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Recurso nao encontrado"));
    }

    @Test
    void deveRetornar400ParaDadosInvalidos() throws Exception {
        mockMvc.perform(post("/api/produtos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"","preco":-5,"quantidade":-1}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erros.nome").exists())
                .andExpect(jsonPath("$.erros.preco").exists())
                .andExpect(jsonPath("$.erros.quantidade").exists());
    }

    @Test
    void deveRetornar409ParaNomeDuplicado() throws Exception {
        criarProduto();

        mockMvc.perform(post("/api/produtos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON_VALIDO))
                .andExpect(status().isConflict());
    }

    private long criarProduto() throws Exception {
        String corpo = mockMvc.perform(post("/api/produtos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(JSON_VALIDO))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(corpo).get("id").asLong();
    }
}
