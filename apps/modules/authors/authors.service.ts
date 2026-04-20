import type { IAuthorRepository, CreateAuthorDto, UpdateAuthorDto, Author } from "./authors.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class AuthorService {
	constructor(private readonly repo: IAuthorRepository) {}

	list(params: PaginationParams): Promise<PaginatedResult<Author>> {
		return this.repo.findAll(params);
	}

	getById(id: number): Promise<Author | null> {
		return this.repo.findById(id);
	}

	create(dto: CreateAuthorDto): Promise<Author> {
		return this.repo.create(dto);
	}

	update(id: number, dto: UpdateAuthorDto): Promise<Author | null> {
		return this.repo.update(id, dto);
	}

	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
