package com.aula.AulaAPI.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Traduz as excecoes da aplicacao para respostas HTTP no formato RFC 7807
 * (application/problem+json), em vez de devolver o stacktrace padrao.
 */
@RestControllerAdvice
public class ManipuladorGlobalDeErros {

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public ProblemDetail tratarNaoEncontrado(RecursoNaoEncontradoException ex) {
        return montar(HttpStatus.NOT_FOUND, "Recurso nao encontrado", ex.getMessage());
    }

    @ExceptionHandler(RegraDeNegocioException.class)
    public ProblemDetail tratarRegraDeNegocio(RegraDeNegocioException ex) {
        return montar(HttpStatus.CONFLICT, "Conflito de regra de negocio", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail tratarValidacao(MethodArgumentNotValidException ex) {
        Map<String, String> erros = new LinkedHashMap<>();
        for (FieldError erro : ex.getBindingResult().getFieldErrors()) {
            erros.merge(erro.getField(), erro.getDefaultMessage(), (a, b) -> a + "; " + b);
        }

        ProblemDetail problema = montar(HttpStatus.BAD_REQUEST, "Dados invalidos",
                "um ou mais campos nao passaram na validacao");
        problema.setProperty("erros", erros);
        return problema;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail tratarCorpoInvalido(HttpMessageNotReadableException ex) {
        return montar(HttpStatus.BAD_REQUEST, "Corpo da requisicao invalido",
                "nao foi possivel ler o JSON enviado");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail tratarTipoInvalido(MethodArgumentTypeMismatchException ex) {
        return montar(HttpStatus.BAD_REQUEST, "Parametro invalido",
                "o valor '" + ex.getValue() + "' nao e valido para o parametro '" + ex.getName() + "'");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail tratarRotaInexistente(NoResourceFoundException ex) {
        return montar(HttpStatus.NOT_FOUND, "Rota nao encontrada",
                "nenhum endpoint mapeado para " + ex.getResourcePath());
    }

    private ProblemDetail montar(HttpStatus status, String titulo, String detalhe) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setTitle(titulo);
        problema.setProperty("timestamp", LocalDateTime.now());
        return problema;
    }
}
