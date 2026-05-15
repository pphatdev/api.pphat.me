import { IDashboardRepository, DashboardData } from "./dashboard.interface";

export class DashboardService {
	constructor(private readonly repo: IDashboardRepository) {}

	/**
	 * @description Get initial dashboard data
	 * @returns { Promise<DashboardData> } Dashboard data
	 */
	async getDashboardInitData(): Promise<DashboardData> {
		return this.repo.getDashboardData();
	}
}
