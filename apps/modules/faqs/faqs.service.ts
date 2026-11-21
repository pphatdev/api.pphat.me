import type { IFaqRepository, CreateFaqDto, UpdateFaqDto, Faq, FaqListParams } from "./faqs.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class FaqService {
	constructor(private readonly repo: IFaqRepository) { }

	list(params: FaqListParams): Promise<PaginatedResult<Faq>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<Faq | null> {
		return this.repo.findById(id);
	}

	getBySlug(slug: string): Promise<Faq | null> {
		return this.repo.findBySlug(slug);
	}

	getByIdOrSlug(idOrSlug: string): Promise<Faq | null> {
		return this.repo.findByIdOrSlug(idOrSlug);
	}

	create(dto: CreateFaqDto): Promise<Faq> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateFaqDto): Promise<Faq | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
