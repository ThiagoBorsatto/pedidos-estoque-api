package com.aula.AulaAPI.config;

import com.aula.AulaAPI.entity.Produto;
import com.aula.AulaAPI.repository.ProdutoRepository;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Popula o banco em memoria com alguns produtos para facilitar os testes manuais.
 * Desativado no perfil "test".
 */
@Component
@Profile("!test")
public class CarregadorDeDados implements CommandLineRunner {

    private final ProdutoRepository repository;

    public CarregadorDeDados(ProdutoRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        if (repository.count() > 0) {
            return;
        }

        repository.saveAll(List.of(
                new Produto("Teclado mecanico", "Switch azul, ABNT2", new BigDecimal("249.90"), 10),
                new Produto("Mouse sem fio", "1600 DPI, bluetooth", new BigDecimal("89.90"), 25),
                new Produto("Monitor 24 polegadas", "IPS, 75Hz, Full HD", new BigDecimal("899.00"), 5)));
    }
}
