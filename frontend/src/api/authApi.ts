import { apiClient } from './apiClient';
import { LoginCredentials, RegisterCredentials, AuthResponse, RefreshTokenResponse, User } from '../types/auth.types';

class AuthApi {
  /**
   * Register a new user
   */
  async register(userData: RegisterCredentials): Promise<User> {
    const response = await apiClient.post<User>('/auth/register', userData);
    return response.data;
  }

  /**
   * Login a user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh-token', { refreshToken });
    return response.data;
  }

  /**
   * Logout a user
   */
  async logout(refreshToken?: string): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken });
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  }

  /**
   * Validate the current token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const authApi = new AuthApi();