import { VehiclesService } from './vehicles.service.js';
export declare class VehiclesController {
    private svc;
    constructor(svc: VehiclesService);
    list(): import("./vehicles.service.js").Vehicle[];
}
