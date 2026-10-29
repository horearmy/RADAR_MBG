export interface Vehicle {
    id: string;
    plate: string;
    type: string;
    sppgId: string;
    status: 'Tersedia' | 'Bertugas' | 'Perawatan' | 'Nonaktif';
    driver: string | null;
}
export declare class VehiclesService {
    private vehicles;
    list(): Vehicle[];
}
