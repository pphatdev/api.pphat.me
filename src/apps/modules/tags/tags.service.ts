import type { ITagRepository, CreateTagDto, UpdateTagDto, Tag } from "./tags.interface";

export class ListTags {
	constructor(private readonly repo: ITagRepository) {}
	execute(): Promise<Tag[]> {
		return this.repo.findAll();
	}
}

export class GetTagById {
	constructor(private readonly repo: ITagRepository) {}
	execute(id: number): Promise<Tag | null> {
		return this.repo.findById(id);
	}
}

export class CreateTag {
	constructor(private readonly repo: ITagRepository) {}
	execute(dto: CreateTagDto): Promise<Tag> {
		return this.repo.create(dto);
	}
}

export class UpdateTag {
	constructor(private readonly repo: ITagRepository) {}
	execute(id: number, dto: UpdateTagDto): Promise<Tag | null> {
		return this.repo.update(id, dto);
	}
}

export class DeleteTag {
	constructor(private readonly repo: ITagRepository) {}
	execute(id: number): Promise<boolean> {
		return this.repo.delete(id);
	}
}
