import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { userStorage } from '@/utils/storage';

interface AuthContextType {
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
  checkAuthStatus: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const checkAuthStatus = React.useCallback(() => {
    const isUserLoggedIn = userStorage.isLoggedIn();
    setIsLoggedIn(isUserLoggedIn);
  }, []);

  const login = React.useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  const logout = React.useCallback(() => {
    setIsLoggedIn(false);
  }, []);

  // 初始检查登录状态
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const value: AuthContextType = {
    isLoggedIn,
    login,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
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
