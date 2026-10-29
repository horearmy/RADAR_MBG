import { TripsService } from './trips.service.js';
export declare class TripsController {
    private readonly service;
    constructor(service: TripsService);
    create(body: any): import("./trips.service.js").Trip;
    findAll(): import("./trips.service.js").Trip[];
    findOne(id: string): import("./trips.service.js").Trip;
    start(id: string, body: any): import("./trips.service.js").Trip;
    transition(id: string, body: any): import("./trips.service.js").Trip;
}
