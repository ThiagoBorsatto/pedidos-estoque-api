package com.aula.AulaAPI.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Dados aceitos na criacao (POST) e atualizacao (PUT) de um produto. */
public record ProdutoRequest(

        @NotBlank(message = "o nome e obrigatorio")
        @Size(max = 120, message = "o nome deve ter no maximo 120 caracteres")
        String nome,

        @Size(max = 500, message = "a descricao deve ter no maximo 500 caracteres")
        String descricao,

        @NotNull(message = "o preco e obrigatorio")
        @DecimalMin(value = "0.0", inclusive = false, message = "o preco deve ser maior que zero")
        @Digits(integer = 10, fraction = 2, message = "o preco aceita no maximo 2 casas decimais")
        BigDecimal preco,

        @NotNull(message = "a quantidade e obrigatoria")
        @Min(value = 0, message = "a quantidade nao pode ser negativa")
        Integer quantidade) {
}
