import type { IamUser, IUserRepository, RoleChangeResult, UserListParams, UserRole } from "./users.interface";
import type { PaginatedResult } from "../../shared/interfaces";

export class UserService {
	constructor(private readonly repo: IUserRepository) { }

	list(params: UserListParams): Promise<PaginatedResult<IamUser>> {
		return this.repo.findAll(params);
	}

	getById(id: string): Promise<IamUser | null> {
		return this.repo.findById(id);
	}

	updateRole(id: string, role: UserRole): Promise<RoleChangeResult> {
		return this.repo.updateRole(id, role);
	}
}
