import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const SKILL_LEVELS: readonly SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

/**
 * Embedded tech-stack reference. `icon` = tech_stacks.logo_url (devicon class
 * or URL); `image` = tech_stacks.cover (optional). Pulling branding from the
 * catalog keeps a skill row from going stale when a tech-stack's logo changes.
 */
export interface SkillTechStackRef {
	id: number;
	name: string;
	icon: string;
	image: string | null;
	url: string;
}

export interface Skill {
	id: number;
	techStack: SkillTechStackRef;
	level: SkillLevel;
	yearsOfExperience: number | null;
	description: string;
	sortOrder: number;
	status: 0 | 1;
	createdAt: string;
	updatedAt: string;
}

export interface SkillJoinedRow {
	id: number;
	tech_stack_id: number;
	level: SkillLevel;
	years_of_experience: number | null;
	description: string;
	sort_order: number;
	status: number;
	created_at: string;
	updated_at: string;
	// Pulled from tech_stacks via JOIN
	ts_name: string;
	ts_logo_url: string;
	ts_cover: string | null;
	ts_url: string;
}

export interface CreateSkillDto {
	tech_stack_id: number;
	level?: SkillLevel;
	years_of_experience?: number | null;
	description?: string;
	sort_order?: number;
	status?: 0 | 1;
}

export type UpdateSkillDto = Partial<CreateSkillDto>;

export interface ISkillRepository {
	findAll(params: PaginationParams): Promise<PaginatedResult<Skill>>;
	findById(id: number): Promise<Skill | null>;
	create(dto: CreateSkillDto): Promise<Skill>;
	update(id: number, dto: UpdateSkillDto): Promise<Skill | null>;
	delete(id: number): Promise<boolean>;
}
