import { TokenPair } from '@auth/services/token.service';
import { AccountUser } from '../mock/mock-directory';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  tokens: TokenPair;
  user: AccountUser;
}
