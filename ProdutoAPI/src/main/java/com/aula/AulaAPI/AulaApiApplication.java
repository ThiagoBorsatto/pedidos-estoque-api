package com.aula.AulaAPI;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/*
    Fluxo da requisicao:
    Controller -> recebe a requisicao HTTP e valida a entrada
    Service    -> aplica as regras de negocio
    Repository -> conversa com o banco de dados
*/
@SpringBootApplication
public class AulaApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(AulaApiApplication.class, args);
	}

}
