package com.dypcet.vayora;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * What the generated API documentation says about the API as a whole, and how to call it:
 * with the bearer token sign-in returns, which Swagger UI's "Authorize" button takes.
 */
@Configuration
public class ApiDocsConfig {

    static final String BEARER = "bearer";

    @Bean
    OpenAPI vayoraApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("VAYORA core-api")
                        .version("v1")
                        .description("Transactions and truth for VAYORA, intercity ride-sharing in India: "
                                + "accounts, rides, bookings, payments, trips and the event log. "
                                + "Sign in with POST /api/v1/auth/login, then authorize with the token it returns. "
                                + "Passengers pay their driver directly, in cash or by UPI: VAYORA moves no money.")
                        .license(new License().name("Final-year project, DYPCET Kolhapur")))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
