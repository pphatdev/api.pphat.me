# Security Policy

## Supported Versions

The following versions of the API are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| v0.9.x  | :white_check_mark: |
| < v0.9  | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to **security@pphat.me**. All security vulnerabilities will be promptly addressed.

Please include the following information in your report:

- **Type of issue** (e.g., SQL injection, XSS, Buffer overflow)
- **Component/Location** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** if exploited

We appreciate your help in keeping this project secure.

## Security Practices

We follow industry best practices to ensure the security of our users and data:

- **JWT Authentication**: All sensitive endpoints require valid JWT tokens.
- **Rate Limiting**: Protection against brute-force and DDoS attacks.
- **Environment Isolation**: Secrets are managed via Cloudflare Secrets and never committed to version control.
- **Dependency Audits**: Regular monitoring of dependencies for known vulnerabilities.
- **SQL Injection Prevention**: All database queries are parameterized using Cloudflare D1's binding system.

---
© 2026 PPhat Dev. All rights reserved.
