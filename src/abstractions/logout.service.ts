
export abstract class LogoutService {
    logout: () => Promise<void>;
    setLogoutOption: (LogoutOption: number) => Promise<void>;
    clear: () => Promise<any>;
}
