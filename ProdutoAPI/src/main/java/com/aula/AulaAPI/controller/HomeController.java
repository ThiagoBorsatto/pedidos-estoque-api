package com.aula.AulaAPI.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping("/ola")
    public Map<String, String> ola() {
        return Map.of(
                "mensagem", "ola mundo",
                "produtos", "/api/produtos");
    }
}
