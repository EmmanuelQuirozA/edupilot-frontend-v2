const base64Decode = (input) => {
  if (typeof atob === 'function') {
    return atob(input);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'base64').toString('binary');
  }

  throw new Error('Base64 decoding is not supported in this environment.');
};

const base64UrlDecode = (segment) => {
  if (!segment || typeof segment !== 'string') {
    return null;
  }

  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);

  try {
    const decoded = base64Decode(`${normalized}${padding}`);
    return decoded;
  } catch (error) {
    console.warn('Failed to decode JWT segment', error);
    return null;
  }
};

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const payload = base64UrlDecode(parts[1]);
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    console.warn('Failed to parse JWT payload', error);
    return null;
  }
};

export const getRoleIdFromToken = (token) => {
  const claims = decodeJwtPayload(token);
  const roleId = claims?.role_id ?? claims?.roleId ?? claims?.role?.id;
  const numericRoleId = Number(roleId);

  return Number.isFinite(numericRoleId) ? numericRoleId : null;
};

export const getRoleNameFromToken = (token) => {
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return null;
  }

  if (typeof claims.role === 'string' && claims.role.trim()) {
    return claims.role;
  }

  return claims.role_name ?? claims.roleName ?? claims.role?.name ?? null;
};
