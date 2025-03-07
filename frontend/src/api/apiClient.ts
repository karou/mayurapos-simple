// Updated apiClient.ts with improved error handling

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { storageService } from '../services/storageService';

// Define base URLs for different environments
const API_URLS = {
  development: 'http://localhost:8000',
  test: 'http://test-api.mayurapos.com',
  production: 'https://api.mayurapos.com',
};

// Get the current environment
const environment = process.env.NODE_ENV || 'development';

// Define a proper interface for the refresh token response
interface RefreshTokenResponse {
  token: string;
}

class ApiClient {
  private instance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: { resolve: (value: unknown) => void; reject: (reason?: any) => void }[] = [];

  constructor() {
    this.instance = axios.create({
      baseURL: API_URLS[environment],
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to attach auth token
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          const token = await storageService.getItem('token');
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        } catch (error) {
          console.error('Error attaching auth token:', error);
          return config;
        }
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        
        // Check if error is due to network issues
        if (!error.response) {
          console.error('Network error or server not reachable:', error.message);
          return Promise.reject({
            isNetworkError: true,
            message: 'Network error or server not reachable',
            originalError: error,
          });
        }

        // If 401 error and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, add to queue
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then(() => {
                // Retry the original request after token refresh
                return this.instance(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          // Start refreshing token
          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            // Try to refresh the token
            const refreshToken = await storageService.getItem('refreshToken');
            if (!refreshToken) {
              // No refresh token, must login again
              this.processFailedQueue(false);
              return Promise.reject(new Error('Authentication required. Please log in again.'));
            }

            const response = await this.instance.post<RefreshTokenResponse>('/auth/refresh-token', { refreshToken });
            
            // Check if response is valid
            if (!response.data || !response.data.token) {
              throw new Error('Invalid response from refresh token endpoint');
            }
            
            const newToken = response.data.token;
            await storageService.setItem('token', newToken);
            
            // Process queued requests with success
            this.processFailedQueue(true);
            
            // Update auth header and retry original request
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            } else {
              originalRequest.headers = { Authorization: `Bearer ${newToken}` };
            }
            
            return this.instance(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            
            // Clear auth tokens on refresh failure
            await storageService.removeItem('token');
            await storageService.removeItem('refreshToken');
            await storageService.removeItem('user');
            
            // Fail all queued requests
            this.processFailedQueue(false);
            
            // Return a more specific error
            return Promise.reject(new Error('Session expired. Please log in again.'));
          } finally {
            this.isRefreshing = false;
          }
        }

        // Format the error message for better debugging
        let errorMessage = 'An error occurred';
        
        if (error.response?.data) {
          // Try to extract error message from response data
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (typeof error.response.data === 'object') {
            errorMessage = Object(error.response.data).message || 
            Object(error.response.data).error || 
                           error.response.statusText || 
                           `Error ${error.response.status}`;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        // Create a better error object
        const enhancedError = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: errorMessage,
          originalError: error,
          data: error.response?.data,
        };

        return Promise.reject(enhancedError);
      }
    );
  }

  private processFailedQueue(shouldProceed: boolean): void {
    this.failedQueue.forEach((prom) => {
      if (shouldProceed) {
        prom.resolve(true);
      } else {
        prom.reject('Authentication failed');
      }
    });
    this.failedQueue = [];
  }

  // GET request
  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get<T>(url, config);
  }

  // POST request
  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post<T>(url, data, config);
  }

  // PUT request
  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put<T>(url, data, config);
  }

  // DELETE request
  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete<T>(url, config);
  }

  // Function to check API health 
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await this.instance.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Get the Axios instance if needed
  public getAxiosInstance(): AxiosInstance {
    return this.instance;
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();