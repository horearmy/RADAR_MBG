import { QrService } from './qr.service.js';
export declare class QrController {
    private svc;
    constructor(svc: QrService);
    issue(b: any): import("./qr.service.js").QrToken;
    verify(b: any): {
        ok: boolean;
        reason?: string;
        token?: import("./qr.service.js").QrToken;
    };
}
