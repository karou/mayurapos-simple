// Updated authApi.ts with improved error handling

import { apiClient } from './apiClient';
import { LoginCredentials, RegisterCredentials, AuthResponse, RefreshTokenResponse, User } from '../types/auth.types';

class AuthApi {
  /**
   * Register a new user
   */
  async register(userData: RegisterCredentials): Promise<User> {
    try {
      const response = await apiClient.post<User>('/auth/register', userData);
      return response.data;
    } catch (error: any) {
      // Enhanced error handling with specific messages
      if (error.status === 409) {
        throw new Error('Username or email already exists');
      } else if (error.status === 400) {
        throw new Error('Invalid registration data: ' + (String(error.message) || 'Please check your input'));
      } else {
        throw new Error(error.message || 'Registration failed. Please try again later.');
      }
    }
  }

  /**
   * Login a user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      
      // Validate response structure
      if (!response.data || !response.data.accessToken || !response.data.user) {
        throw new Error('Invalid response from authentication server');
      }
      
      return response.data;
    } catch (error: any) {
      // Check for network errors
      if (error.isNetworkError) {
        throw new Error('Unable to connect to the authentication server. Please check your connection.');
      }
      
      // Check for specific status codes
      if (error.status === 401) {
        throw new Error('Invalid username or password');
      } else if (error.status === 404) {
        throw new Error('Authentication service not found. Please contact support.');
      } else if (error.status === 500) {
        throw new Error('Authentication server error. Please try again later.');
      }
      
      // Use provided message or fallback
      throw new Error(error.message || 'Login failed. Please try again.');
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh-token', { refreshToken });
      
      // Validate response
      if (!response.data || !response.data.token) {
        throw new Error('Invalid refresh token response');
      }
      
      return response.data;
    } catch (error: any) {
      // Map error responses to user-friendly messages
      if (error.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      } else {
        throw new Error(error.message || 'Failed to refresh authentication. Please log in again.');
      }
    }
  }

  /**
   * Logout a user
   */
  async logout(refreshToken?: string): Promise<void> {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } catch (error: any) {
      // Even if server logout fails, we'll still clear local state
      console.warn('Logout API call failed:', error);
      // Don't rethrow since we don't want to prevent local logout
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get<User>('/auth/me');
      return response.data;
    } catch (error: any) {
      if (error.status === 401) {
        throw new Error('Authentication required');
      } else {
        throw new Error(error.message || 'Failed to get user information');
      }
    }
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