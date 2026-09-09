# ---------- etapa 1: compila o jar ----------
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

# baixa as dependencias primeiro: essa camada so refaz quando o pom muda
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src
RUN mvn -B clean package -DskipTests

# ---------- etapa 2: imagem final, so com o runtime ----------
FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar

# A hospedagem informa a porta pela variavel PORT; 8080 e o padrao local.
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT} -jar app.jar"]
