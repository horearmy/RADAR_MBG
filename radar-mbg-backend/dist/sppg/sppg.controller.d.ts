import { SppgService } from './sppg.service.js';
export declare class SppgController {
    private svc;
    constructor(svc: SppgService);
    list(): import("./sppg.service.js").Sppg[];
    kpi(): {
        total: number;
        active: number;
        attention: number;
        inactive: number;
        distributionToday: number;
    };
    create(b: any): {
        updatedAt: string;
        status: "Aktif" | "Perlu Perhatian" | "Nonaktif";
        name: string;
        lat: number;
        lon: number;
        code: string;
        region: string;
        address: string;
        pic: string;
        drivers: number;
        vehicles: number;
        distributionToday: number;
        id: string;
    };
}
