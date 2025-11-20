import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { decodeJwtPayload, getRoleIdFromToken, getRoleNameFromToken } from '../utils/jwt';

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

const deriveUserFromToken = (token, user) => {
  if (!token) {
    return user ?? null;
  }

  const claims = decodeJwtPayload(token) ?? {};
  const roleFromUser = user?.role ?? user?.role_name ?? user?.roleName;
  const tokenRole = getRoleNameFromToken(token);
  const role = typeof roleFromUser === 'string' && roleFromUser.trim() ? roleFromUser : tokenRole;

  const roleIdFromUser = user?.role_id ?? user?.roleId;
  const roleId = Number.isFinite(Number(roleIdFromUser)) ? Number(roleIdFromUser) : getRoleIdFromToken(token);

  const username = user?.username ?? user?.user_name ?? claims.sub ?? null;
  const schoolId = user?.school_id ?? user?.schoolId ?? claims.school_id ?? claims.schoolId ?? null;
  const userId = user?.id ?? user?.user_id ?? user?.userId ?? claims.user_id ?? claims.userId ?? null;

  const mergedUser = {
    ...(user ?? {}),
    ...(role ? { role, role_name: role } : {}),
    ...(Number.isFinite(roleId) ? { role_id: roleId } : {}),
  };

  if (username) {
    mergedUser.username = username;
  }

  if (schoolId !== null && schoolId !== undefined) {
    mergedUser.school_id = schoolId;
  }

  if (userId !== null && userId !== undefined) {
    mergedUser.user_id = userId;
  }

  return Object.keys(mergedUser).length > 0 ? mergedUser : null;
};

export const AuthProvider = ({ children }) => {
  const { token: storedToken, user: storedUser } = getStoredAuth();
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState(() => deriveUserFromToken(storedToken, storedUser));
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
        } catch {
          // ignore json parsing errors
        }

        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();

      const resolvedToken = deriveToken(payload);
      const resolvedUser = deriveUser(payload) ?? payload;
      const roleId = resolvedUser?.role_id ?? resolvedUser?.roleId ?? getRoleIdFromToken(resolvedToken);
      const role = resolvedUser?.role_name ?? payload?.role_name ?? getRoleNameFromToken(resolvedToken);

      if (!role) {
        const roleError = new Error('Unable to determine user role from the server response.');
        roleError.code = 'MISSING_ROLE';
        throw roleError;
      }

      const userWithRole = { ...resolvedUser, role, role_id: roleId ?? resolvedUser?.role_id ?? null };
      const enrichedUser = deriveUserFromToken(resolvedToken, userWithRole);

      setToken(resolvedToken ?? null);
      setUser(enrichedUser);
      persistAuth({ token: resolvedToken ?? null, user: enrichedUser });

      return enrichedUser;
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

  const normalizedUser = useMemo(() => deriveUserFromToken(token, user), [token, user]);

  useEffect(() => {
    if (!token) {
      persistAuth(null);
      return;
    }

    persistAuth({ token, user: normalizedUser ?? null });
  }, [token, normalizedUser]);

  const value = useMemo(
    () => ({
      token,
      user: normalizedUser,
      login,
      logout,
      loading,
    }),
    [token, normalizedUser, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
