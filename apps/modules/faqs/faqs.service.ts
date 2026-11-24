import type { IFaqRepository, CreateFaqDto, UpdateFaqDto, Faq, FaqListParams, FaqOrderSequenceItem } from "./faqs.interface";
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

	reorder(orderedIds: (number | string)[]): Promise<number> {
		return this.repo.reorder(orderedIds);
	}

	updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number> {
		return this.repo.updateOrderSequence(items);
	}

	getOrderSequence(): Promise<FaqOrderSequenceItem[]> {
		return this.repo.getOrderSequence();
	}
}
