import { createContext, useContext, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

const getStoredAuth = () => {
  if (typeof window === 'undefined') {
    return { token: null, user: null };
  }

  try {
    const stored = window.localStorage.getItem('auth');
    if (!stored) {
      return { token: null, user: null };
    }

    const parsed = JSON.parse(stored);
    return {
      token: parsed?.token ?? null,
      user: parsed?.user ?? null,
    };
  } catch (error) {
    console.warn('Failed to parse stored auth state', error);
    return { token: null, user: null };
  }
};

const persistAuth = (payload) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!payload) {
    window.localStorage.removeItem('auth');
    return;
  }

  window.localStorage.setItem('auth', JSON.stringify(payload));
};

const deriveToken = (data) =>
  data?.token ?? data?.access_token ?? data?.jwt ?? data?.data?.token ?? null;

const deriveUser = (data) => {
  if (!data) {
    return null;
  }

  if (data.user) {
    return data.user;
  }

  if (data.profile) {
    return data.profile;
  }

  if (data.data?.user) {
    return data.data.user;
  }

  return null;
};

export const AuthProvider = ({ children }) => {
  const { token: storedToken, user: storedUser } = getStoredAuth();
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState(storedUser);
  const [loading, setLoading] = useState(false);

  const login = async (usernameOrEmail, password) => {
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      if (!response.ok) {
        let message = 'Unexpected error. Please try again later.';

        if (response.status === 401) {
          message = 'Invalid credentials. Please check your username and password.';
        } else if (response.status === 403) {
          message = 'This account is disabled. Please contact support.';
        }

        try {
          const errorPayload = await response.json();
          if (errorPayload?.message && typeof errorPayload.message === 'string') {
            message = errorPayload.message;
          }
        } catch (error) {
          // ignore json parsing errors
        }

        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();

      const resolvedToken = deriveToken(payload);
      const resolvedUser = deriveUser(payload) ?? payload;
      const role = resolvedUser?.role_name ?? payload?.role_name;

      if (!role) {
        const roleError = new Error('Unable to determine user role from the server response.');
        roleError.code = 'MISSING_ROLE';
        throw roleError;
      }

      const userWithRole = { ...resolvedUser, role };

      setToken(resolvedToken ?? null);
      setUser(userWithRole);
      persistAuth({ token: resolvedToken ?? null, user: userWithRole });

      return userWithRole;
    } catch (error) {
      if (error instanceof Error) {
        if (error.code === 'MISSING_ROLE' || error.status) {
          throw error;
        }

        const isNetworkError =
          error.name === 'TypeError' || /network|fetch/i.test(error.message ?? '');

        if (isNetworkError) {
          const networkError = new Error('Network error. Please try again later.');
          networkError.code = 'NETWORK_ERROR';
          throw networkError;
        }

        throw error;
      }

      const networkError = new Error('Network error. Please try again later.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    persistAuth(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      loading,
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
