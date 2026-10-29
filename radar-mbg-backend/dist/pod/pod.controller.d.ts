import { PodService } from './pod.service.js';
export declare class PodController {
    private svc;
    constructor(svc: PodService);
    submit(id: string, b: any): import("./pod.service.js").Pod;
    list(id: string): import("./pod.service.js").Pod[];
}
export declare class PodReviewController {
    private svc;
    constructor(svc: PodService);
    review(id: string, b: any): import("./pod.service.js").Pod;
}
