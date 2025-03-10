// Updated AuthContext.tsx with improved error handling

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';
import { User, LoginCredentials, RegisterCredentials } from '../types/auth.types';
import { safeJsonParse, safeToString } from '../utils/type-safety';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Export the context so hooks can import it
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      try {
        const storedUser = await storageService.getItem('user');
        const storedToken = await storageService.getItem('token');
        
        if (storedUser && storedToken) {
          // Safely parse user data with default fallback
          const parsedUser = safeJsonParse<User | null>(storedUser, null);
          
          // Ensure parsed user has required properties
          if (parsedUser && 
              typeof parsedUser === 'object' && 
              'userId' in parsedUser &&
              'username' in parsedUser) {
            setUser(parsedUser);
            
            // Validate token or refresh if needed
            try {
              await authService.validateToken();
            } catch (error) {
              // Token is invalid, log the user out
              await logout();
            }
          } else {
            // Invalid user data, clear it
            await storageService.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth(); // Explicitly mark as void to handle the floating promise
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate credentials
      if (!credentials || 
          typeof credentials !== 'object' || 
          !credentials.username || 
          !credentials.password) {
        throw new Error('Invalid login credentials');
      }
      
      const { user, accessToken, refreshToken } = await authService.login(credentials);
      
      if (!user || !accessToken || !refreshToken) {
        throw new Error('Authentication failed: Missing user data or tokens');
      }
      
      // Store auth data
      await storageService.setItem('user', JSON.stringify(user));
      await storageService.setItem('token', accessToken);
      await storageService.setItem('refreshToken', refreshToken);
      
      setUser(user);
    } catch (error) {
      setError(safeToString(error));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate user data
      if (!userData || 
          typeof userData !== 'object' || 
          !userData.username || 
          !userData.email || 
          !userData.password || 
          !userData.confirmPassword) {
        throw new Error('Invalid registration data');
      }
      
      await authService.register(userData);
      // Auto login after registration
      await login({
        username: userData.username,
        password: userData.password
      });
    } catch (error) {
      setError(safeToString(error));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Clear local storage and state regardless of API success
      await storageService.removeItem('user');
      await storageService.removeItem('token');
      await storageService.removeItem('refreshToken');
      setUser(null);
      setIsLoading(false);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};