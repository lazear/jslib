import { ConstantsService } from './constants.service';

import { CipherService } from '../abstractions/cipher.service';
import { CollectionService } from '../abstractions/collection.service';
import { CryptoService } from '../abstractions/crypto.service';
import { FolderService } from '../abstractions/folder.service';
import { LogoutService as LogoutServiceAbstraction } from '../abstractions/logout.service';
import { MessagingService } from '../abstractions/messaging.service';
import { PlatformUtilsService } from '../abstractions/platformUtils.service';
import { SearchService } from '../abstractions/search.service';
import { StorageService } from '../abstractions/storage.service';
import { UserService } from '../abstractions/user.service';

import { CipherString } from '../models/domain/cipherString';

export class LogoutService implements LogoutServiceAbstraction {
    pinProtectedKey: CipherString = null;

    private inited = false;

    constructor(private cipherService: CipherService, private folderService: FolderService,
        private collectionService: CollectionService, private cryptoService: CryptoService,
        private platformUtilsService: PlatformUtilsService, private storageService: StorageService,
        private messagingService: MessagingService, private searchService: SearchService,
        private userService: UserService, private lockedCallback: () => Promise<void> = null, private logoutCallback: () => Promise<void> = null) {
    }

    init(checkOnInterval: boolean) {
        if (this.inited) {
            return;
        }

        this.inited = true;
        if (checkOnInterval) {
            this.checkLock();
            setInterval(() => this.checkLock(), 10 * 1000); // check every 10 seconds
        }
    }

    async isLocked(): Promise<boolean> {
        const hasKey = await this.cryptoService.hasKey();
        return !hasKey;
    }

    async checkLock(): Promise<void> {
        if (await this.platformUtilsService.isViewOpen()) {
            // Do not lock
            return;
        }

        const authed = await this.userService.isAuthenticated();
        if (!authed) {
            return;
        }

        if (await this.isLocked()) {
            return;
        }

        let logoutOption = this.platformUtilsService.lockTimeout();
        if (logoutOption == null) {
            logoutOption = await this.storageService.get<number>(ConstantsService.logoutOptionKey);
        }
        if (logoutOption == null || logoutOption < 0) {
            return;
        }

        const lastActive = await this.storageService.get<number>(ConstantsService.lastActiveKey);
        if (lastActive == null) {
            return;
        }

        const logoutOptionSeconds = logoutOption * 60;
        const diffSeconds = ((new Date()).getTime() - lastActive) / 1000;
        if (diffSeconds >= logoutOptionSeconds) {
            // need to lock now
            await this.logout();
        }
    }

    async logout(): Promise<void> {
        const authed = await this.userService.isAuthenticated();
        if (!authed) {
            return;
        }
        await this.logoutCallback();
    }

    async setLogoutOption(logoutOption: number): Promise<void> {
        await this.storageService.save(ConstantsService.logoutOptionKey, logoutOption);
        await this.cryptoService.toggleKey();
    }

    clear(): Promise<any> {
        this.pinProtectedKey = null;
        return this.storageService.remove(ConstantsService.protectedPin);
    }
}
