package com.aula.AulaAPI.dto;

import com.aula.AulaAPI.entity.Produto;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Representacao devolvida pela API. Evita expor a entidade diretamente. */
public record ProdutoResponse(
        Long id,
        String nome,
        String descricao,
        BigDecimal preco,
        Integer quantidade,
        LocalDateTime criadoEm,
        LocalDateTime atualizadoEm) {

    public static ProdutoResponse de(Produto produto) {
        return new ProdutoResponse(
                produto.getId(),
                produto.getNome(),
                produto.getDescricao(),
                produto.getPreco(),
                produto.getQuantidade(),
                produto.getCriadoEm(),
                produto.getAtualizadoEm());
    }
}
