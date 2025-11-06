import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config.js';
import { handleExpiredToken } from '../../utils/auth.js';
import './StudentSearchSelect.css';

const STUDENT_SEARCH_DEBOUNCE = 350;

const DEFAULT_STRINGS = {
  togglePlaceholder: 'Selecciona un alumno',
  searchPlaceholder: 'Buscar alumno por nombre',
  noResults: 'No se encontraron alumnos.',
  loading: 'Buscando alumnos...',
  loadError: 'No fue posible cargar los alumnos.',
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
    payload.students,
    payload.content,
    payload.response,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeStudentOption = (item, index = 0) => {
  const id =
    item?.student_id ??
    item?.studentId ??
    item?.id ??
    item?.user_id ??
    item?.uuid ??
    item?.value ??
    index;

  const fullName =
    item?.full_name ??
    item?.fullName ??
    item?.student_full_name ??
    item?.name ??
    '';

  const gradeGroup = item?.grade_group ?? item?.group_name ?? item?.class_name ?? '';
  const generation = item?.generation ?? item?.generation_name ?? '';
  const scholarLevel = item?.scholar_level_name ?? item?.scholar_level ?? item?.level ?? '';
  const paymentReference = item?.payment_reference ?? item?.register_id ?? '';

  return {
    id: String(id),
    fullName: fullName || `Alumno ${index + 1}`,
    gradeGroup,
    generation,
    scholarLevel,
    paymentReference,
  };
};

const defaultRenderStudentMeta = (option) => {
  const metaParts = [option.gradeGroup, option.generation, option.scholarLevel]
    .map((value) => value && String(value).trim())
    .filter(Boolean);

  const reference = option.paymentReference ? `Matrícula: ${option.paymentReference}` : '';

  if (reference) {
    metaParts.unshift(reference);
  }

  if (metaParts.length === 0) {
    return '';
  }

  return metaParts.join(' • ');
};

const StudentSearchSelect = ({
  id,
  token,
  logout,
  language = 'es',
  selectedStudent,
  onSelect,
  strings = {},
  disabled = false,
  renderStudentMeta = defaultRenderStudentMeta,
}) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentOptions, setStudentOptions] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  const dropdownRef = useRef(null);
  const normalizedLanguage = language || 'es';

  const studentSummary = useMemo(() => {
    if (!selectedStudent) {
      return mergedStrings.togglePlaceholder;
    }

    return selectedStudent.fullName;
  }, [mergedStrings.togglePlaceholder, selectedStudent]);

  const handleToggle = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsDropdownOpen((prev) => !prev);
  }, [disabled]);

  const handleSelectStudent = useCallback(
    (option) => {
      onSelect?.(option);
      setIsDropdownOpen(false);
      setSearchTerm('');
    },
    [onSelect],
  );

  const handleStudentSearchChange = useCallback((event) => {
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
      setStudentOptions([]);
      setStudentsError('');
      setIsLoadingStudents(false);
      return undefined;
    }

    let isMounted = true;
    const controller = new AbortController();
    const searchValue = searchTerm.trim();

    setIsLoadingStudents(true);
    setStudentsError('');

    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          lang: normalizedLanguage,
          offset: '0',
          limit: '10',
          export_all: 'false',
        });

        if (searchValue) {
          params.set('full_name', searchValue);
        }

        const response = await fetch(`${API_BASE_URL}/students?${params.toString()}`, {
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
        const options = list.map((item, index) => normalizeStudentOption(item, index));
        setStudentOptions(options);
      } catch (error) {
        if (!isMounted && error.name === 'AbortError') {
          return;
        }

        if (error.name !== 'AbortError') {
          console.error('Student search error', error);
          if (isMounted) {
            setStudentsError(error instanceof Error && error.message ? error.message : mergedStrings.loadError);
            setStudentOptions([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingStudents(false);
        }
      }
    }, STUDENT_SEARCH_DEBOUNCE);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    isDropdownOpen,
    searchTerm,
    normalizedLanguage,
    token,
    logout,
    mergedStrings.loadError,
  ]);

  return (
    <div className="student-search" ref={dropdownRef}>
      <button
        type="button"
        id={id}
        className={`student-search__toggle ${selectedStudent ? '' : 'is-placeholder'}`}
        onClick={handleToggle}
        aria-expanded={isDropdownOpen}
        disabled={disabled}
      >
        {studentSummary}
      </button>
      {isDropdownOpen ? (
        <div className="student-search__dropdown">
          <div className="student-search__search">
            <input
              type="text"
              value={searchTerm}
              onChange={handleStudentSearchChange}
              placeholder={mergedStrings.searchPlaceholder}
              autoFocus
            />
          </div>
          <div className="student-search__options">
            {isLoadingStudents ? (
              <div className="student-search__status">{mergedStrings.loading}</div>
            ) : studentsError ? (
              <div className="student-search__status student-search__status--error">{studentsError}</div>
            ) : studentOptions.length === 0 ? (
              <div className="student-search__status">{mergedStrings.noResults}</div>
            ) : (
              studentOptions.map((option) => {
                const meta = renderStudentMeta(option);
                return (
                  <button
                    type="button"
                    key={option.id}
                    className="student-search__option"
                    onClick={() => handleSelectStudent(option)}
                  >
                    <span className="student-search__option-name">{option.fullName}</span>
                    {meta ? <span className="student-search__option-meta">{meta}</span> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
      {selectedStudent
        ? (() => {
            const meta = renderStudentMeta(selectedStudent);
            return meta ? <p className="student-search__selected-meta">{meta}</p> : null;
          })()
        : null}
    </div>
  );
};

export default StudentSearchSelect;
