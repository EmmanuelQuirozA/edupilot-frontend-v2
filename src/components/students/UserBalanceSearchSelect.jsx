import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config.js';
import { handleExpiredToken } from '../../utils/auth.js';
import './StudentSearchSelect.css';

const USER_SEARCH_DEBOUNCE = 350;

const DEFAULT_STRINGS = {
  togglePlaceholder: 'Selecciona un usuario',
  searchPlaceholder: 'Buscar por nombre',
  noResults: 'No se encontraron usuarios.',
  loading: 'Buscando usuarios...',
  loadError: 'No fue posible cargar los usuarios.',
};

const extractArrayFromPayload = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.data,
    payload.results,
    payload.items,
    payload.list,
    payload.content,
    payload.response,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const formatCurrency = (value) => {
  if (value == null || value === '') {
    return '';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

const normalizeUserOption = (item, index = 0) => {
  const id =
    item?.user_id ?? item?.id ?? item?.uuid ?? item?.value ?? item?.student_id ?? item?.studentId ?? index;

  const fullName = item?.full_name ?? item?.name ?? '';
  const role = item?.role_name ?? item?.role ?? '';
  const balance = Number(item?.balance ?? 0) || 0;

  return {
    id: String(id),
    fullName: fullName || `Usuario ${index + 1}`,
    role,
    balance,
  };
};

const UserBalanceSearchSelect = ({
  id,
  token,
  logout,
  language = 'es',
  selectedUser,
  onSelect,
  strings = {},
  disabled = false,
}) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userOptions, setUserOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  const dropdownRef = useRef(null);
  const normalizedLanguage = language || 'es';

  const userSummary = useMemo(() => {
    if (!selectedUser) {
      return mergedStrings.togglePlaceholder;
    }

    return selectedUser.fullName;
  }, [mergedStrings.togglePlaceholder, selectedUser]);

  const handleToggle = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsDropdownOpen((prev) => !prev);
  }, [disabled]);

  const handleSelectUser = useCallback(
    (option) => {
      onSelect?.(option);
      setIsDropdownOpen(false);
      setSearchTerm('');
    },
    [onSelect],
  );

  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) {
      setSearchTerm('');
      setUserOptions([]);
      setUsersError('');
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;
    const controller = new AbortController();
    const searchValue = searchTerm.trim();

    setIsLoading(true);
    setUsersError('');

    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          lang: normalizedLanguage,
        });

        params.set('full_name', searchValue);

        const response = await fetch(`${API_BASE_URL}/users/balances?${params.toString()}`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error(mergedStrings.loadError);
        }

        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        const list = extractArrayFromPayload(payload);
        const options = list.map((item, index) => normalizeUserOption(item, index));
        setUserOptions(options);
      } catch (error) {
        if (!isMounted && error.name === 'AbortError') {
          return;
        }

        if (error.name !== 'AbortError') {
          console.error('User balance search error', error);
          if (isMounted) {
            setUsersError(error instanceof Error && error.message ? error.message : mergedStrings.loadError);
            setUserOptions([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, USER_SEARCH_DEBOUNCE);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isDropdownOpen, searchTerm, normalizedLanguage, token, logout, mergedStrings.loadError]);

  return (
    <div className="student-search" ref={dropdownRef}>
      <button
        type="button"
        id={id}
        className={`student-search__toggle ${selectedUser ? '' : 'is-placeholder'}`}
        onClick={handleToggle}
        aria-expanded={isDropdownOpen}
        disabled={disabled}
      >
        {userSummary}
      </button>
      {isDropdownOpen ? (
        <div className="student-search__dropdown">
          <div className="student-search__search">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={mergedStrings.searchPlaceholder}
              autoFocus
            />
          </div>
          <div className="student-search__options">
            {isLoading ? (
              <div className="student-search__status">{mergedStrings.loading}</div>
            ) : usersError ? (
              <div className="student-search__status student-search__status--error">{usersError}</div>
            ) : userOptions.length === 0 ? (
              <div className="student-search__status">{mergedStrings.noResults}</div>
            ) : (
              userOptions.map((option) => {
                const metaParts = [option.role, option.balance != null ? formatCurrency(option.balance) : null]
                  .filter(Boolean)
                  .join(' • ');
                return (
                  <button
                    type="button"
                    key={option.id}
                    className="student-search__option"
                    onClick={() => handleSelectUser(option)}
                  >
                    <span className="student-search__option-name">{option.fullName}</span>
                    {metaParts ? <span className="student-search__option-meta">{metaParts}</span> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
      {selectedUser ? (
        <p className="student-search__selected-meta">
          {[selectedUser.role, selectedUser.balance != null ? formatCurrency(selectedUser.balance) : '']
            .filter(Boolean)
            .join(' • ')}
        </p>
      ) : null}
    </div>
  );
};

export default UserBalanceSearchSelect;
