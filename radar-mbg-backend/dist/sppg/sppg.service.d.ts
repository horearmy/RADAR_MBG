export interface Sppg {
    id: string;
    code: string;
    name: string;
    region: string;
    address: string;
    lat: number;
    lon: number;
    status: 'Aktif' | 'Perlu Perhatian' | 'Nonaktif';
    pic: string;
    drivers: number;
    vehicles: number;
    distributionToday: number;
    updatedAt: string;
}
export declare class SppgService {
    private sppgs;
    list(): Sppg[];
    create(s: Omit<Sppg, 'id' | 'updatedAt'>): {
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
    kpi(): {
        total: number;
        active: number;
        attention: number;
        inactive: number;
        distributionToday: number;
    };
}
