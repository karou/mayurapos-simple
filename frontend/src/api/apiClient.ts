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

class ApiClient {
  private instance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: { resolve: (value: unknown) => void; reject: (reason?: any) => void }[] = [];

  constructor() {
    this.instance = axios.create({
      baseURL: API_URLS[environment as keyof typeof API_URLS],
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
        const token = await storageService.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

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
              return Promise.reject(error);
            }

            const response = await this.instance.post('/auth/refresh-token', { refreshToken });
            
            if (response.data.token) {
              const newToken = response.data.token;
              await storageService.setItem('token', newToken);
              
              // Process queued requests with success
              this.processFailedQueue(true);
              
              // Update auth header and retry original request
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              
              return this.instance(originalRequest);
            } else {
              // No new token received
              this.processFailedQueue(false);
              return Promise.reject(error);
            }
          } catch (refreshError) {
            // Failed to refresh token
            this.processFailedQueue(false);
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // Handle network errors for offline support
        if (error.message === 'Network Error') {
          // Return a specific error for the sync service to handle
          return Promise.reject({
            isNetworkError: true,
            originalError: error,
            originalRequest,
          });
        }

        return Promise.reject(error);
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