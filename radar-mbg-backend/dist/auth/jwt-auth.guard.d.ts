import { AuthService } from './auth.service.js';
declare const JwtStrategy_base: any;
export declare class JwtStrategy extends JwtStrategy_base {
    private auth;
    constructor(auth: AuthService);
    validate(payload: any): Promise<{
        userId: any;
        role: any;
        orgId: any;
    }>;
}
declare const JwtAuthGuard_base: any;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
}
export {};
