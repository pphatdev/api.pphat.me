import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { getAdminHeaders, getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
    await seedDatabase(env.DB);
    authHeaders = await getAuthHeaders(env.JWT_SECRET);
    adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("Contact API", () => {
    describe("POST /v1/api/contact", () => {
        it("should submit a contact message successfully", async () => {
            const res = await SELF.fetch("http://example.com/v1/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "John Doe",
                    email: "john@example.com",
                    subject: "Test Subject",
                    message: "This is a test message that is long enough."
                }),
            });
            expect(res.status).toBe(201);
            const body = await res.json() as any;
            expect(body.message).toBe("Message sent successfully");
        });

        it("should return 422 for invalid email", async () => {
            const res = await SELF.fetch("http://example.com/v1/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "John Doe",
                    email: "invalid-email",
                    message: "This is a test message that is long enough."
                }),
            });
            expect(res.status).toBe(422);
        });

        it("should return 422 for short message", async () => {
            const res = await SELF.fetch("http://example.com/v1/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "John Doe",
                    email: "john@example.com",
                    message: "Too short"
                }),
            });
            expect(res.status).toBe(422);
        });
    });

    describe("Admin Reporting", () => {
        it("GET /v1/api/contact should be forbidden for normal users", async () => {
            const res = await SELF.fetch("http://example.com/v1/api/contact", {
                headers: authHeaders
            });
            expect(res.status).toBe(403);
        });

        it("GET /v1/api/contact should return messages for admin", async () => {
            const res = await SELF.fetch("http://example.com/v1/api/contact", {
                headers: adminHeaders
            });
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.pagination).toBeDefined();
        });

        it("GET /v1/api/contact/:id should return a specific message for admin", async () => {
            // First submit one to get an ID
            const submitRes = await SELF.fetch("http://example.com/v1/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Jane Doe",
                    email: "jane@example.com",
                    message: "Another test message for retrieval test."
                }),
            });
            const listRes = await SELF.fetch("http://example.com/v1/api/contact", {
                headers: adminHeaders
            });

            const listBody = await listRes.json() as any;
            const messageId = listBody.data[0].id;

            const res = await SELF.fetch(`http://example.com/v1/api/contact/${messageId}`, {
                headers: adminHeaders
            });
            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.id).toBe(messageId);
            expect(body.name).toBe("Jane Doe");
        });
    });
});
