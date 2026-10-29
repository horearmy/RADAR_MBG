import { DriversService } from './drivers.service.js';
export declare class DriversController {
    private svc;
    constructor(svc: DriversService);
    list(): import("./drivers.service.js").Driver[];
    create(b: any): {
        status: "Aktif" | "Undangan" | "Terkunci" | "Nonaktif";
        name: string;
        username: string;
        sppgId: string;
        vehicle: string | null;
        availability: "Siap" | "Bertugas" | "Tidak Tersedia";
        id: string;
    };
}
