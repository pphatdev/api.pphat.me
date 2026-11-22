import type {
	IGalleryRepository,
	CreateGalleryItemDto,
	UpdateGalleryItemDto,
	GalleryItem,
	GalleryListParams,
	GalleryStats,
	GalleryOrderSequenceItem,
} from "./gallery.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class GalleryService {
	constructor(private readonly repo: IGalleryRepository) { }

	list(params: GalleryListParams): Promise<PaginatedResult<GalleryItem>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<GalleryItem | null> {
		return this.repo.findById(id);
	}

	getFeatured(): Promise<GalleryItem[]> {
		return this.repo.findFeatured();
	}

	getStats(): Promise<GalleryStats> {
		return this.repo.getStats();
	}

	create(dto: CreateGalleryItemDto): Promise<GalleryItem> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateGalleryItemDto): Promise<GalleryItem | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}

	getOrderSequence(): Promise<GalleryOrderSequenceItem[]> {
		return this.repo.getOrderSequence();
	}

	updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number> {
		return this.repo.updateOrderSequence(items);
	}

	reorder(orderedIds: (number | string)[]): Promise<number> {
		return this.repo.reorder(orderedIds);
	}
}
