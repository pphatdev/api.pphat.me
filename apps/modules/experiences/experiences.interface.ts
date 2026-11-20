import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';

export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
	'full-time',
	'part-time',
	'contract',
	'internship',
	'freelance',
] as const;

export interface Experience {
	id: number;
	title: string;
	company: string;
	description: string;
	startDate: string;
	/** Null when the role is current / ongoing. */
	endDate: string | null;
	location: string;
	employmentType: EmploymentType;
	companyUrl: string;
	logoUrl: string;
	/** Optional cover image URL. Null when none was uploaded. */
	cover: string | null;
	/** 0 = inactive (hidden from the public timeline), 1 = active. */
	status: 0 | 1;
	createdAt: string;
	updatedAt: string;
}

export interface ExperienceRow {
	id: number;
	title: string;
	company: string;
	description: string;
	start_date: string;
	end_date: string | null;
	location: string;
	employment_type: EmploymentType;
	company_url: string;
	logo_url: string;
	cover: string | null;
	status: number;
	created_at: string;
	updated_at: string;
}

export interface CreateExperienceDto {
	title: string;
	company: string;
	description?: string;
	start_date: string;
	end_date?: string | null;
	location?: string;
	employment_type?: EmploymentType;
	company_url?: string;
	logo_url?: string;
	cover?: string | null;
	status?: 0 | 1;
}

export type UpdateExperienceDto = Partial<CreateExperienceDto>;

/**
 * Timeline shape — grouped by company. The resume timeline endpoint maps
 * each experience to a role under its company, and attaches the linked
 * tech stacks as `skills` (icon = tech_stacks.logo_url).
 */
export interface TimelineSkill {
	name: string;
	icon: string;
	url: string;
}

export interface TimelinePeriod {
	/** Start, formatted "YYYY, Mmm" (e.g. "2020, Nov"). */
	from: string;
	/** True when the role is ongoing (end_date IS NULL). */
	isCurrent: boolean;
	/** End, formatted "YYYY, Mmm". When `isCurrent` is true this holds today's "YYYY, Mmm" so the client can draw a live range. */
	to: string;
}

export interface TimelineRole {
	title: string;
	period: TimelinePeriod;
	skills: TimelineSkill[];
}

export interface TimelineCompany {
	company: string;
	url: string;
	logo: string;
	roles: TimelineRole[];
}

export interface IExperienceRepository {
	findAll(params: PaginationParams): Promise<PaginatedResult<Experience>>;
	findById(id: number): Promise<Experience | null>;
	create(dto: CreateExperienceDto): Promise<Experience>;
	update(id: number, dto: UpdateExperienceDto): Promise<Experience | null>;
	delete(id: number): Promise<boolean>;
	getTimeline(params: PaginationParams): Promise<PaginatedResult<TimelineCompany>>;
	setSkills(experienceId: number, techStackIds: number[]): Promise<void>;
	attachSkill(experienceId: number, techStackId: number): Promise<boolean>;
	detachSkill(experienceId: number, techStackId: number): Promise<boolean>;
}
