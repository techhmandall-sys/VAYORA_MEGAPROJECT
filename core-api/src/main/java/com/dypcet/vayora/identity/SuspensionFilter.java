package com.dypcet.vayora.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Refuses a suspended member's requests even while their token is still valid, and ends every
 * session of a deleted account. The account's standing is checked on every request, so it takes
 * effect at once on every device, whatever tokens are still out there.
 */
class SuspensionFilter extends OncePerRequestFilter {

    /** What a request from a deleted account is told: its session is over, as when a token expires. */
    static final String SESSION_ENDED = "Your session has ended. Sign in again.";

    private final JdbcTemplate jdbc;

    SuspensionFilter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token) {
            List<String> status = jdbc.queryForList("SELECT status FROM users WHERE id = ?", String.class,
                    Long.parseLong(token.getToken().getSubject()));
            if (status.contains("DELETED")) {
                refuse(response, HttpStatus.UNAUTHORIZED, SESSION_ENDED);
                return;
            }
            if (status.contains("SUSPENDED")) {
                refuse(response, HttpStatus.FORBIDDEN, IdentityService.SUSPENDED);
                return;
            }
        }
        chain.doFilter(request, response);
    }

    /** @param detail a fixed sentence the web app translates, never anything a caller sent */
    static void refuse(HttpServletResponse response, HttpStatus status, String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.getWriter().write("{\"title\":\"" + status.getReasonPhrase() + "\",\"status\":" + status.value()
                + ",\"detail\":\"" + detail + "\"}");
    }
}
