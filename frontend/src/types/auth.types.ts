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
    token: string;
    refreshToken: string;
  }
  
  export interface RefreshTokenResponse {
    token: string;
  }