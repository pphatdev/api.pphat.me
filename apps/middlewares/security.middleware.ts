import { secureHeaders } from 'hono/secure-headers';
import type { MiddlewareHandler } from 'hono';

/**
 * @description Security middleware that applies standard security headers
 */
export const securityMiddleware: MiddlewareHandler = secureHeaders({
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        // No 'unsafe-inline' on scripts (#28). This is a JSON API — nothing
        // it serves ever needs to execute an inline <script>. If a future
        // handler starts rendering HTML with inline JS, nonce it instead of
        // widening this back.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
    },
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'no-referrer',
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
});
