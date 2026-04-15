import type { IAuthorRepository, CreateAuthorDto, UpdateAuthorDto, Author } from "./authors.interface";

export class ListAuthors {
	constructor(private readonly repo: IAuthorRepository) {}
	execute(): Promise<Author[]> {
		return this.repo.findAll();
	}
}

export class GetAuthorById {
	constructor(private readonly repo: IAuthorRepository) {}
	execute(id: number): Promise<Author | null> {
		return this.repo.findById(id);
	}
}

export class CreateAuthor {
	constructor(private readonly repo: IAuthorRepository) {}
	execute(dto: CreateAuthorDto): Promise<Author> {
		return this.repo.create(dto);
	}
}

export class UpdateAuthor {
	constructor(private readonly repo: IAuthorRepository) {}
	execute(id: number, dto: UpdateAuthorDto): Promise<Author | null> {
		return this.repo.update(id, dto);
	}
}

export class DeleteAuthor {
	constructor(private readonly repo: IAuthorRepository) {}
	execute(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
