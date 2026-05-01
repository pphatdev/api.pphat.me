import { IDashboardRepository, DashboardData } from "./dashboard.interface";

export class DashboardService {
	constructor(private readonly repo: IDashboardRepository) {}

	async getDashboardInitData(): Promise<DashboardData> {
		return this.repo.getDashboardData();
	}
}
