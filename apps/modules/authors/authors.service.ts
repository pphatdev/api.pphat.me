import type { IAuthorRepository, CreateAuthorDto, UpdateAuthorDto, Author } from "./authors.interface";
import { PaginatedResult, PaginationParams } from "../../shared/interfaces";

export class AuthorService {
	constructor(private readonly repo: IAuthorRepository) {}

	/**
	 * @description List all authors
	 * @param { PaginationParams } params Pagination parameters
	 * @returns { Promise<PaginatedResult<Author>> } Paginated authors
	 */
	list(params: PaginationParams): Promise<PaginatedResult<Author>> {
		return this.repo.findAll(params);
	}

	/**
	 * @description Get an author by ID
	 * @param { number } id The author ID
	 * @returns { Promise<Author | null> } The author or null
	 */
	getById(id: number): Promise<Author | null> {
		return this.repo.findById(id);
	}

	/**
	 * @description Create a new author
	 * @param { CreateAuthorDto } dto Author data
	 * @returns { Promise<Author> } The created author
	 */
	create(dto: CreateAuthorDto): Promise<Author> {
		return this.repo.create(dto);
	}

	/**
	 * @description Update an existing author
	 * @param { number } id The author ID
	 * @param { UpdateAuthorDto } dto Update data
	 * @returns { Promise<Author | null> } The updated author or null
	 */
	update(id: number, dto: UpdateAuthorDto): Promise<Author | null> {
		return this.repo.update(id, dto);
	}

	/**
	 * @description Delete an author
	 * @param { number } id The author ID
	 * @returns { Promise<boolean> } True if deleted
	 */
	delete(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
