export interface QrToken {
    id: string;
    locationId: string;
    tripId?: string;
    issuedAt: string;
    expiresAt: string;
    usedAt?: string;
    status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
}
export declare class QrService {
    private tokens;
    issue(locationId: string, tripId?: string, ttlSec?: number): QrToken;
    verify(tokenId: string, locationId: string, tripId?: string): {
        ok: boolean;
        reason?: string;
        token?: QrToken;
    };
}
