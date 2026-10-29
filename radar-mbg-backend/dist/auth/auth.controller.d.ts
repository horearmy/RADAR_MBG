import { AuthService } from './auth.service.js';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    login(body: any): Promise<{
        accessToken: any;
        user: {
            id: string;
            username: string;
            role: string;
            orgId: string;
        };
    }>;
}
