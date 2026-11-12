package com.dypcet.vayora.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Refuses a token that was revoked by signing out or by deleting the account, with the same answer
 * as a token that has expired.
 */
class TokenRevocationFilter extends OncePerRequestFilter {

    private final TokenRevocationService revocations;

    TokenRevocationFilter(TokenRevocationService revocations) {
        this.revocations = revocations;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken token && revocations.isRevoked(token.getToken())) {
            SuspensionFilter.refuse(response, HttpStatus.UNAUTHORIZED, SuspensionFilter.SESSION_ENDED);
            return;
        }
        chain.doFilter(request, response);
    }
}
