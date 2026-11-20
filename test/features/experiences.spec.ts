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

async function createExperience(overrides: Record<string, unknown> = {}): Promise<number> {
	const res = await SELF.fetch("http://example.com/v1/api/experiences", {
		method: "POST",
		headers: adminHeaders,
		body: JSON.stringify({
			title: "Senior Engineer",
			company: "Acme Co",
			description: "Built things.",
			start_date: "2023-01-01",
			end_date: "2024-06-01",
			location: "Remote",
			employment_type: "full-time",
			...overrides,
		}),
	});
	const body = await res.json() as { id: number };
	return body.id;
}

describe("Experiences API", () => {
	it("GET /v1/api/experiences without auth returns 401", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences");
		expect(res.status).toBe(401);
	});

	it("GET /v1/api/experiences returns paginated list", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences?page=1&limit=10", { headers: authHeaders });
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toHaveProperty("data");
		expect(Array.isArray(body.data)).toBe(true);
		expect(body).toHaveProperty("pagination");
	});

	it("POST /v1/api/experiences as non-admin returns 403", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: authHeaders,
			body: JSON.stringify({ title: "no", company: "no", start_date: "2024-01-01" }),
		});
		expect(res.status).toBe(403);
	});

	it("POST /v1/api/experiences with valid body creates (201) — admin", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				title: "Software Engineer",
				company: "Initech",
				description: "Printer whisperer.",
				start_date: "2019-05-01",
				end_date: "2022-12-31",
				location: "Austin, TX",
				employment_type: "full-time",
				company_url: "https://example.com",
				logo_url: "https://example.com/logo.png",
				cover: "https://example.com/cover.png",
				status: 1,
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toMatchObject({
			title: "Software Engineer",
			company: "Initech",
			startDate: "2019-05-01",
			endDate: "2022-12-31",
			employmentType: "full-time",
			companyUrl: "https://example.com",
			logoUrl: "https://example.com/logo.png",
			cover: "https://example.com/cover.png",
			status: 1,
		});
	});

	it("POST accepts camelCase aliases (startDate / endDate / employmentType / companyUrl / logoUrl)", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				title: "Dev",
				company: "Camel Corp",
				startDate: "2021-01-01",
				endDate: null,
				employmentType: "contract",
				companyUrl: "https://camel.example",
				logoUrl: "https://camel.example/logo.png",
			}),
		});
		expect(res.status).toBe(201);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toMatchObject({
			startDate: "2021-01-01",
			endDate: null,
			employmentType: "contract",
			companyUrl: "https://camel.example",
			logoUrl: "https://camel.example/logo.png",
		});
	});

	it("POST allows null end_date for current role", async () => {
		const id = await createExperience({ title: "Current Role", end_date: null });
		const res = await SELF.fetch(`http://example.com/v1/api/experiences/${id}`);
		const body = await res.json() as Record<string, unknown>;
		expect(body.endDate).toBeNull();
	});

	it("POST missing title returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ company: "X", start_date: "2024-01-01" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST missing company returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ title: "X", start_date: "2024-01-01" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST missing start_date returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ title: "X", company: "Y" }),
		});
		expect(res.status).toBe(422);
	});

	it("POST with invalid employment_type returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				title: "X", company: "Y", start_date: "2024-01-01", employment_type: "volunteer",
			}),
		});
		expect(res.status).toBe(422);
	});

	it("POST with invalid status returns 422", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ title: "X", company: "Y", start_date: "2024-01-01", status: 7 }),
		});
		expect(res.status).toBe(422);
	});

	it("GET /:id returns a single experience", async () => {
		const id = await createExperience({ title: "Single Lookup", company: "Lookup Inc" });
		const res = await SELF.fetch(`http://example.com/v1/api/experiences/${id}`);
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toMatchObject({ id, title: "Single Lookup", company: "Lookup Inc" });
	});

	it("GET /9999 returns 404", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences/9999");
		expect(res.status).toBe(404);
	});

	it("GET /not-a-number returns 400", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/experiences/not-a-number");
		expect(res.status).toBe(400);
	});

	it("PATCH /:id updates partially (admin)", async () => {
		const id = await createExperience({ title: "Pre-update", description: "Old." });
		const res = await SELF.fetch(`http://example.com/v1/api/experiences/${id}`, {
			method: "PATCH",
			headers: adminHeaders,
			body: JSON.stringify({ description: "New.", end_date: null }),
		});
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body).toMatchObject({ id, title: "Pre-update", description: "New.", endDate: null });
	});

	it("PATCH as non-admin returns 403", async () => {
		const id = await createExperience();
		const res = await SELF.fetch(`http://example.com/v1/api/experiences/${id}`, {
			method: "PATCH",
			headers: authHeaders,
			body: JSON.stringify({ description: "nope" }),
		});
		expect(res.status).toBe(403);
	});

	it("DELETE /:id (admin) returns 204 then 404 on refetch", async () => {
		const id = await createExperience({ title: "Ephemeral" });

		const delRes = await SELF.fetch(`http://example.com/v1/api/experiences/${id}`, {
			method: "DELETE",
			headers: adminHeaders,
		});
		expect(delRes.status).toBe(204);

		const getRes = await SELF.fetch(`http://example.com/v1/api/experiences/${id}`);
		expect(getRes.status).toBe(404);
	});

	it("DELETE as non-admin returns 403", async () => {
		const id = await createExperience();
		const res = await SELF.fetch(`http://example.com/v1/api/experiences/${id}`, {
			method: "DELETE",
			headers: authHeaders,
		});
		expect(res.status).toBe(403);
	});

	it("GET /timeline groups by company with period object + skills via junction", async () => {
		// Create a tech stack to link as a skill.
		const tsRes = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({
				name: "Figma",
				logo_url: "devicon-figma-plain",
				url: "https://www.figma.com",
			}),
		});
		const techStack = await tsRes.json() as { id: number };

		// Two roles at the same company — ongoing + past — verifies grouping
		// and that the ongoing role sorts first within the company bucket.
		const ongoingId = await createExperience({
			title: "Senior Frontend Developer",
			company: "TURBOTECH CO., LTD",
			start_date: "2022-10-01",
			end_date: null,
			company_url: "https://turbotech.com.kh",
			logo_url: "/images/companies/turbotech.png",
		});
		await createExperience({
			title: "Frontend Developer",
			company: "TURBOTECH CO., LTD",
			start_date: "2021-01-01",
			end_date: "2022-09-30",
			company_url: "https://turbotech.com.kh",
			logo_url: "/images/companies/turbotech.png",
		});

		// Link the Figma tech stack to the ongoing role.
		const attachRes = await SELF.fetch(
			`http://example.com/v1/api/experiences/${ongoingId}/skills/${techStack.id}`,
			{ method: "POST", headers: adminHeaders },
		);
		expect(attachRes.status).toBe(200);
		expect(await attachRes.json()).toMatchObject({ attached: true });

		// Fetch the timeline.
		const res = await SELF.fetch("http://example.com/v1/api/experiences/timeline");
		expect(res.status).toBe(200);
		const body = await res.json() as { data: any[]; pagination: any };
		expect(body).toHaveProperty("data");
		expect(body).toHaveProperty("pagination");
		expect(body.pagination).toMatchObject({
			page: expect.any(Number),
			limit: expect.any(Number),
			total: expect.any(Number),
			totalPages: expect.any(Number),
		});
		const turbo = body.data.find((c: any) => c.company === "TURBOTECH CO., LTD");
		expect(turbo).toBeDefined();
		expect(turbo).toMatchObject({
			company: "TURBOTECH CO., LTD",
			url: "https://turbotech.com.kh",
			logo: "/images/companies/turbotech.png",
		});
		expect(Array.isArray(turbo.roles)).toBe(true);
		expect(turbo.roles.length).toBe(2);

		// Ongoing role (Senior Frontend Developer) must be first within the
		// company bucket and carry the attached skill + isCurrent period.
		const senior = turbo.roles[0];
		expect(senior.title).toBe("Senior Frontend Developer");
		expect(senior.period).toMatchObject({
			from: "2022, Oct",
			isCurrent: true,
		});
		// `to` is today's "YYYY, Mmm" when isCurrent — just assert the shape.
		expect(typeof senior.period.to).toBe("string");
		expect(senior.period.to).toMatch(/^\d{4}, [A-Z][a-z]{2}$/);

		expect(senior.skills).toEqual([
			{ name: "Figma", icon: "devicon-figma-plain", url: "https://www.figma.com" },
		]);

		// Past role should show as not current and have a formatted `to`.
		const past = turbo.roles[1];
		expect(past.title).toBe("Frontend Developer");
		expect(past.period).toMatchObject({
			from: "2021, Jan",
			isCurrent: false,
			to: "2022, Sep",
		});
	});

	it("POST /:id/skills/:techStackId is idempotent (second call returns attached=false)", async () => {
		const tsRes = await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ name: "React" }),
		});
		const ts = await tsRes.json() as { id: number };
		const expId = await createExperience({ title: "Idempotency Test" });

		const first = await SELF.fetch(
			`http://example.com/v1/api/experiences/${expId}/skills/${ts.id}`,
			{ method: "POST", headers: adminHeaders },
		);
		expect(await first.json()).toMatchObject({ attached: true });

		const second = await SELF.fetch(
			`http://example.com/v1/api/experiences/${expId}/skills/${ts.id}`,
			{ method: "POST", headers: adminHeaders },
		);
		expect(await second.json()).toMatchObject({ attached: false });
	});

	it("PUT /:id/skills replaces the full skill set", async () => {
		const tsA = await (await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "SkillA" }),
		})).json() as { id: number };
		const tsB = await (await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "SkillB" }),
		})).json() as { id: number };
		const expId = await createExperience({ title: "PUT skills" });

		// Seed with just A.
		await SELF.fetch(`http://example.com/v1/api/experiences/${expId}/skills/${tsA.id}`, {
			method: "POST", headers: adminHeaders,
		});

		// Replace with just B via PUT.
		const putRes = await SELF.fetch(`http://example.com/v1/api/experiences/${expId}/skills`, {
			method: "PUT",
			headers: adminHeaders,
			body: JSON.stringify({ tech_stack_ids: [tsB.id] }),
		});
		expect(putRes.status).toBe(204);

		// Timeline response should now show only SkillB on that experience.
		const timelineRes = await SELF.fetch("http://example.com/v1/api/experiences/timeline?limit=100");
		const timeline = await timelineRes.json() as { data: any[] };
		const role = timeline.data.flatMap((c) => c.roles).find((r: any) => r.title === "PUT skills");
		expect(role.skills.map((s: any) => s.name)).toEqual(["SkillB"]);
	});

	it("GET /timeline respects ?page= + ?limit= paginating by company", async () => {
		// Seed at least two distinct companies.
		await createExperience({ title: "P1", company: "Pagination Co A", start_date: "2024-01-01", end_date: null });
		await createExperience({ title: "P2", company: "Pagination Co B", start_date: "2024-02-01", end_date: null });

		const page1 = await (await SELF.fetch("http://example.com/v1/api/experiences/timeline?page=1&limit=1")).json() as { data: any[]; pagination: any };
		expect(page1.pagination).toMatchObject({ page: 1, limit: 1 });
		expect(page1.pagination.total).toBeGreaterThanOrEqual(2);
		expect(page1.data.length).toBe(1);

		const page2 = await (await SELF.fetch("http://example.com/v1/api/experiences/timeline?page=2&limit=1")).json() as { data: any[] };
		expect(page2.data.length).toBe(1);
		// Different company on page 2
		expect(page2.data[0].company).not.toBe(page1.data[0].company);
	});

	it("DELETE /:id/skills/:techStackId removes the link (204) then 404 on repeat", async () => {
		const ts = await (await SELF.fetch("http://example.com/v1/api/tech-stacks", {
			method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "ToRemove" }),
		})).json() as { id: number };
		const expId = await createExperience({ title: "Detach test" });

		await SELF.fetch(`http://example.com/v1/api/experiences/${expId}/skills/${ts.id}`, {
			method: "POST", headers: adminHeaders,
		});

		const del1 = await SELF.fetch(`http://example.com/v1/api/experiences/${expId}/skills/${ts.id}`, {
			method: "DELETE", headers: adminHeaders,
		});
		expect(del1.status).toBe(204);

		const del2 = await SELF.fetch(`http://example.com/v1/api/experiences/${expId}/skills/${ts.id}`, {
			method: "DELETE", headers: adminHeaders,
		});
		expect(del2.status).toBe(404);
	});

	it("timeline order: current (end_date NULL) comes before past entries", async () => {
		// Explicitly create two rows: one ongoing, one that ended earlier.
		await createExperience({ title: "Z Past Role", company: "Past Co", start_date: "2010-01-01", end_date: "2011-01-01" });
		const currentId = await createExperience({ title: "A Current Role", company: "Now Co", start_date: "2024-01-01", end_date: null });

		const res = await SELF.fetch("http://example.com/v1/api/experiences?limit=100", { headers: authHeaders });
		const body = await res.json() as { data: { id: number; endDate: string | null }[] };
		const currentIdx = body.data.findIndex((e) => e.id === currentId);
		const pastIdx = body.data.findIndex((e) => e.endDate === "2011-01-01");
		// The ongoing role must come before any role that ended in the past.
		expect(currentIdx).toBeGreaterThanOrEqual(0);
		expect(pastIdx).toBeGreaterThan(currentIdx);
	});
});
