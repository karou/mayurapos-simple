// Updated authService.ts with improved error handling

import { authApi } from '../api/authApi';
import { storageService } from './storageService';
import { LoginCredentials, RegisterCredentials, User, AuthResponse } from '../types/auth.types';

/**
 * Service for handling authentication-related operations
 */
class AuthService {
  /**
   * Login a user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate input to prevent 'length' property errors
      if (!credentials || typeof credentials !== 'object') {
        throw new Error('Invalid credentials format');
      }
      
      if (!credentials.username || typeof credentials.username !== 'string') {
        throw new Error('Username is required');
      }
      
      if (!credentials.password || typeof credentials.password !== 'string') {
        throw new Error('Password is required');
      }
      
      // Call API to login
      const response = await authApi.login(credentials);
      
      // Validate response
      if (!response || !response.accessToken || !response.user) {
        throw new Error('Invalid response from authentication server');
      }
      
      return response;
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.status === 401) {
        throw new Error('Invalid username or password');
      }
      
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    }
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterCredentials): Promise<User> {
    try {
      // Validate input
      if (!userData || typeof userData !== 'object') {
        throw new Error('Invalid user data format');
      }
      
      // Validate password match
      if (!userData.password || !userData.confirmPassword) {
        throw new Error('Password fields cannot be empty');
      }
      
      if (userData.password !== userData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Call API to register
      const response = await authApi.register(userData);
      return response;
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.status === 409) {
        throw new Error('Username or email already exists');
      }
      
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    }
  }

  /**
   * Logout a user
   */
  async logout(): Promise<void> {
    // Get refresh token from storage
    const refreshToken = await storageService.getItem('refreshToken');
    
    try {
      // Call API to logout (revoke refresh token)
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // We still continue with local logout even if API fails
    }

    // Clear local storage
    await storageService.removeItem('token');
    await storageService.removeItem('refreshToken');
    await storageService.removeItem('user');
  }

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<string | null> {
    // Get refresh token from storage
    const refreshToken = await storageService.getItem('refreshToken');
    
    if (!refreshToken) {
      return null;
    }

    try {
      // Call API to refresh the token
      const response = await authApi.refreshToken(refreshToken);
      
      // Validate response
      if (!response || !response.token) {
        throw new Error('Invalid token refresh response');
      }
      
      // Store new token
      await storageService.setItem('token', response.token);
      
      return response.token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      
      // Clear storage on refresh failure
      await storageService.removeItem('token');
      await storageService.removeItem('refreshToken');
      await storageService.removeItem('user');
      
      return null;
    }
  }

  /**
   * Validate if the current token is valid
   */
  async validateToken(): Promise<boolean> {
    try {
      return await authApi.validateToken();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await authApi.getCurrentUser();
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await storageService.getItem('token');
    
    if (!token) {
      return false;
    }
    
    // Validate token by making a request to the API
    try {
      return await this.validateToken();
    } catch (error) {
      return false;
    }
  }
}

export const authService = new AuthService();