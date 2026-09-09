package com.aula.AulaAPI.service;

import com.aula.AulaAPI.dto.ProdutoRequest;
import com.aula.AulaAPI.dto.ProdutoResponse;
import com.aula.AulaAPI.entity.Produto;
import com.aula.AulaAPI.exception.RecursoNaoEncontradoException;
import com.aula.AulaAPI.exception.RegraDeNegocioException;
import com.aula.AulaAPI.repository.ProdutoRepository;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class ProdutoService {

    private final ProdutoRepository repository;

    public ProdutoService(ProdutoRepository repository) {
        this.repository = repository;
    }

    public List<ProdutoResponse> listar(String nome) {
        List<Produto> produtos = StringUtils.hasText(nome)
                ? repository.findByNomeContainingIgnoreCaseOrderByNomeAsc(nome.trim())
                : repository.findAll(Sort.by(Sort.Direction.ASC, "nome"));

        return produtos.stream().map(ProdutoResponse::de).toList();
    }

    public ProdutoResponse buscarPorId(Long id) {
        return ProdutoResponse.de(buscarEntidade(id));
    }

    @Transactional
    public ProdutoResponse criar(ProdutoRequest request) {
        String nome = request.nome().trim();
        if (repository.existsByNomeIgnoreCase(nome)) {
            throw new RegraDeNegocioException("ja existe um produto com o nome '" + nome + "'");
        }

        Produto produto = new Produto(nome, normalizar(request.descricao()), request.preco(), request.quantidade());
        return ProdutoResponse.de(repository.save(produto));
    }

    @Transactional
    public ProdutoResponse atualizar(Long id, ProdutoRequest request) {
        Produto produto = buscarEntidade(id);

        String nome = request.nome().trim();
        if (repository.existsByNomeIgnoreCaseAndIdNot(nome, id)) {
            throw new RegraDeNegocioException("ja existe outro produto com o nome '" + nome + "'");
        }

        produto.setNome(nome);
        produto.setDescricao(normalizar(request.descricao()));
        produto.setPreco(request.preco());
        produto.setQuantidade(request.quantidade());

        // saveAndFlush garante que o @PreUpdate rode antes de montarmos a resposta,
        // para que "atualizadoEm" volte com o valor novo.
        return ProdutoResponse.de(repository.saveAndFlush(produto));
    }

    @Transactional
    public void remover(Long id) {
        repository.delete(buscarEntidade(id));
    }

    private Produto buscarEntidade(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("produto nao encontrado para o id " + id));
    }

    private String normalizar(String texto) {
        return StringUtils.hasText(texto) ? texto.trim() : null;
    }
}
