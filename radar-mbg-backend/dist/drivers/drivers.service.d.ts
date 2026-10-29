export interface Driver {
    id: string;
    name: string;
    username: string;
    sppgId: string;
    vehicle: string | null;
    status: 'Aktif' | 'Undangan' | 'Terkunci' | 'Nonaktif';
    availability: 'Siap' | 'Bertugas' | 'Tidak Tersedia';
}
export declare class DriversService {
    private drivers;
    list(): Driver[];
    create(d: Omit<Driver, 'id'>): {
        status: "Aktif" | "Undangan" | "Terkunci" | "Nonaktif";
        name: string;
        username: string;
        sppgId: string;
        vehicle: string | null;
        availability: "Siap" | "Bertugas" | "Tidak Tersedia";
        id: string;
    };
}
