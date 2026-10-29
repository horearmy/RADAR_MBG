import { LocationsService } from './locations.service.js';
export declare class LocationsController {
    private svc;
    constructor(svc: LocationsService);
    list(): import("./locations.service.js").DeliveryLocation[];
}
