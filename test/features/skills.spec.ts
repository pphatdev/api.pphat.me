import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, getAuthHeaders, getAdminHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

async function createTechStack(name: string, overrides: Record<string, unknown> = {}): Promise<number> {
	const res = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
		method: "POST",
		headers: adminHeaders,
		body: JSON.stringify({
			name,
			logo_url: "devicon-figma-plain",
			url: "https://example.com",
			cover: null,
			...overrides,
		}),
	});
	const body = await res.json() as { id: number };
	return body.id;
}

async function createSkill(overrides: Record<string, unknown> = {}, tsName = `TS-${Math.random().toString(36).slice(2, 8)}`): Promise<number> {
	const tsId = await createTechStack(tsName);
	const res = await SELF.fetch("http://example.com/v1/api/skills", {
		method: "POST",
		headers: adminHeaders,
		body: JSON.stringify({ tech_stack_id: tsId, ...overrides }),
	});
	const body = await res.json() as { id: number };
	return body.id;
}

describe("Skills API", () => {
	it("GET /v1/api/skills without auth returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/skills");
		expect(res.status).toBe(401);
	});

	it("GET /v1/api/skills returns paginated list", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/skills?page=1&limit=10", { headers: authHeaders });
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("data");
		expect(body).toHaveProperty("pagination");
	});

	it("POST /v1/api/skills as non-admin returns 403", async () => {
		const tsId = await createTechStack("Non-Admin Test TS");
		const res = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ tech_stack_id: tsId }),
		});
		expect(res.status).toBe(403);
	});

	it("POST /v1/api/skills with valid body creates (201) and embeds tech stack", async () => {
		const tsId = await createTechStack("React", {
			logo_url: "devicon-react-original",
			url: "https://react.dev",
			cover: "https://react.dev/cover.png",
		});
		const res = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				tech_stack_id: tsId,
				level: "advanced",
				years_of_experience: 3.5,
				description: "SSR + RSC heavy.",
				sort_order: 10,
				status: 1,
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as any;
		expect(body).toMatchObject({
			level: "advanced",
			yearsOfExperience: 3.5,
			description: "SSR + RSC heavy.",
			sortOrder: 10,
			status: 1,
			techStack: {
				id: tsId,
				name: "React",
				icon: "devicon-react-original",
				image: "https://react.dev/cover.png",
				url: "https://react.dev",
			},
		});
	});

	it("POST accepts camelCase aliases (techStackId / yearsOfExperience / sortOrder)", async () => {
		const tsId = await createTechStack("Camel TS");
		const res = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				techStackId: tsId,
				yearsOfExperience: 2,
				sortOrder: 5,
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as any;
		expect(body).toMatchObject({
			yearsOfExperience: 2,
			sortOrder: 5,
			techStack: { id: tsId },
		});
	});

	it("POST missing tech_stack_id returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ level: "advanced" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST with invalid level returns 422", async () => {
		const tsId = await createTechStack("Bad Level TS");
		const res = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ tech_stack_id: tsId, level: "god-tier" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST with non-existent tech_stack_id returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ tech_stack_id: 999999 }),
		});
		expect(res.status).toBe(422);
	});

	it("POST duplicate tech_stack_id returns 409", async () => {
		const tsId = await createTechStack("Only Once TS");
		const first = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ tech_stack_id: tsId }),
		});
		expect(first.status).toBe(201);
		const second = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ tech_stack_id: tsId }),
		});
		expect(second.status).toBe(409);
	});

	it("GET /:id returns a single skill with hydrated tech stack", async () => {
		const id = await createSkill({ level: "expert" });
		const res = await SELF.fetch(`http://example.com/v1/api/skills/${id}`);
		expect(res.status).toBe(200);
		const body = await res.json() as any;
		expect(body.id).toBe(id);
		expect(body.level).toBe("expert");
		expect(body.techStack).toHaveProperty("name");
		expect(body.techStack).toHaveProperty("icon");
	});

	it("GET /9999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/skills/9999");
		expect(res.status).toBe(404);
	});

	it("GET /not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/skills/not-a-number");
		expect(res.status).toBe(400);
	});

	it("PATCH /:id updates partially (admin)", async () => {
		const id = await createSkill({ level: "beginner", description: "Old" });
		const res = await SELF.fetch(`http://example.com/v1/api/skills/${id}`, {
			method: "PATCH",
			headers: adminHeaders,
			body: JSON.stringify({ level: "advanced", description: "New" }),
		});
		expect(res.status).toBe(200);
		const body = await res.json() as any;
		expect(body).toMatchObject({ id, level: "advanced", description: "New" });
	});

	it("PATCH as non-admin returns 403", async () => {
		const id = await createSkill();
		const res = await SELF.fetch(`http://example.com/v1/api/skills/${id}`, {
			method: "PATCH",
			headers: authHeaders,
			body: JSON.stringify({ description: "nope" }),
		});
		expect(res.status).toBe(403);
	});

	it("DELETE /:id (admin) returns 204 then 404 on refetch", async () => {
		const id = await createSkill();
		const del = await SELF.fetch(`http://example.com/v1/api/skills/${id}`, {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(del.status).toBe(204);
		const get = await SELF.fetch(`http://example.com/v1/api/skills/${id}`);
		expect(get.status).toBe(404);
	});

	it("DELETE as non-admin returns 403", async () => {
		const id = await createSkill();
		const res = await SELF.fetch(`http://example.com/v1/api/skills/${id}`, {
			method: "DELETE",
			headers: authHeaders,
		});
		expect(res.status).toBe(403);
	});

	it("DELETE /9999 (admin) returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/skills/9999", {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(res.status).toBe(404);
	});

	it("deleting the referenced tech_stack cascades skill deletion", async () => {
		const tsId = await createTechStack("Cascade TS");
		const skillRes = await SELF.fetch("http://example.com/v1/api/skills", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ tech_stack_id: tsId }),
		});
		const skill = await skillRes.json() as { id: number };

		const delTs = await SELF.fetch(`http://example.com/v1/api/tech-stacks/${tsId}`, {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(delTs.status).toBe(204);

		const getSkill = await SELF.fetch(`http://example.com/v1/api/skills/${skill.id}`);
		expect(getSkill.status).toBe(404);
	});
});
