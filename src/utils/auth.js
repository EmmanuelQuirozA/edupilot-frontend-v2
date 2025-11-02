export const handleExpiredToken = (response, logout) => {
  if (!response || typeof response.status !== 'number') {
    return;
  }

  if (response.status !== 401) {
    return;
  }

  if (typeof logout === 'function') {
    logout();
  }

  const error = new Error('SESSION_EXPIRED');
  error.code = 'SESSION_EXPIRED';
  throw error;
};
