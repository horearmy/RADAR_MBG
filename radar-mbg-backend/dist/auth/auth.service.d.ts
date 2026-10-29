import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private jwt;
    private users;
    constructor(jwt: JwtService);
    login(username: string, password: string): Promise<{
        accessToken: any;
        user: {
            id: string;
            username: string;
            role: string;
            orgId: string;
        };
    }>;
    validate(payload: any): {
        userId: any;
        role: any;
        orgId: any;
    };
}
