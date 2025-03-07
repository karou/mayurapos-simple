// Updated auth.types.ts with more robust type definitions

export interface User {
    userId: string;
    username: string;
    email: string;
    roles: string[];
    lastLogin?: string;
  }
  
  export interface LoginCredentials {
    username: string;
    password: string;
  }
  
  export interface RegisterCredentials {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }
  
  export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
  }
  
  export interface RefreshTokenResponse {
    token: string;
    expiresIn?: number;
  }
  
  export interface AuthError {
    status?: number;
    code?: string;
    message: string;
    details?: Record<string, unknown>;
  }
  
  export enum AuthErrorCodes {
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    SERVER_ERROR = 'SERVER_ERROR',
    UNAUTHORIZED = 'UNAUTHORIZED',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    VALIDATION_ERROR = 'VALIDATION_ERROR'
  }