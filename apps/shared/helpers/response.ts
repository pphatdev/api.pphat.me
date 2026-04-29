import * as success from "./responses/success";
import * as error from "./responses/error";

export const Res = {
	...success,
	...error,
};

export * from "./responses/success";
export * from "./responses/error";
