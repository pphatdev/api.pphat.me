import type {
	IServicesRepository,
	CreateServiceDto,
	UpdateServiceDto,
	UpdateServiceSectionDto,
	ServiceItem,
	ServiceSection,
	ServicesOverview,
	ServiceListParams,
	ServiceOrderSequenceItem,
} from "./services.interface";
import { PaginatedResult } from "../../shared/interfaces";

export class ServicesService {
	constructor(private readonly repo: IServicesRepository) { }

	list(params: ServiceListParams): Promise<PaginatedResult<ServiceItem>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<ServiceItem | null> {
		return this.repo.findById(id);
	}

	create(dto: CreateServiceDto): Promise<ServiceItem> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateServiceDto): Promise<ServiceItem | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}

	getSection(): Promise<ServiceSection | null> {
		return this.repo.getSection();
	}

	updateSection(dto: UpdateServiceSectionDto): Promise<ServiceSection> {
		return this.repo.updateSection(dto);
	}

	getOverview(): Promise<ServicesOverview> {
		return this.repo.getOverview();
	}

	getOrderSequence(): Promise<ServiceOrderSequenceItem[]> {
		return this.repo.getOrderSequence();
	}

	updateOrderSequence(items: { id: number | string; sequence: number }[]): Promise<number> {
		return this.repo.updateOrderSequence(items);
	}

	reorder(orderedIds: (number | string)[]): Promise<number> {
		return this.repo.reorder(orderedIds);
	}
}
