import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './StudentDetailPage.css';

const extractStudentDetail = (payload) => {
  const candidates = [
    payload?.data,
    payload?.result,
    payload?.student,
    payload?.details,
    payload?.response,
    payload,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate)) ?? null;
};

const StudentDetailPage = ({
  studentId,
  language = 'es',
  strings = {},
  onBreadcrumbChange,
  onNavigateToStudents,
}) => {
  const { token } = useAuth();
  const [status, setStatus] = useState('idle');
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');

  const {
    breadcrumbFallback = 'Detalle de alumno',
    loading: loadingLabel = 'Cargando información...',
    error: errorLabel = 'No fue posible cargar la información del alumno.',
    placeholderTitle = 'Vista previa en construcción',
    placeholderDescription = 'Muy pronto podrás consultar la información completa del alumno aquí.',
    registerLabel = 'Matrícula',
    backToStudents = 'Volver a alumnos',
  } = strings ?? {};

  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      setStatus('idle');
      setError('');
      onBreadcrumbChange?.(breadcrumbFallback);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadStudent = async () => {
      try {
        setStatus('loading');
        setError('');
        onBreadcrumbChange?.(breadcrumbFallback);

        const response = await fetch(
          `${API_BASE_URL}/students/student-details/${encodeURIComponent(studentId)}?lang=${language ?? 'es'}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error('Failed to load student detail');
        }

        const payload = await response.json();
        const detail = extractStudentDetail(payload);

        if (!detail) {
          throw new Error('Missing student detail');
        }

        if (isCancelled) {
          return;
        }

        setStudent(detail);
        setStatus('success');

        const displayName = [
          detail.full_name,
          [detail.first_name, detail.last_name_father, detail.last_name_mother]
            .filter(Boolean)
            .join(' '),
        ]
          .find((name) => typeof name === 'string' && name.trim().length > 0);

        onBreadcrumbChange?.(displayName?.trim() || breadcrumbFallback);
      } catch (requestError) {
        if (isCancelled || requestError.name === 'AbortError') {
          return;
        }

        console.error('Failed to load student detail', requestError);
        setStudent(null);
        setStatus('error');
        setError(errorLabel);
        onBreadcrumbChange?.(breadcrumbFallback);
      }
    };

    loadStudent();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [breadcrumbFallback, errorLabel, language, onBreadcrumbChange, studentId, token]);

  const initials = useMemo(() => {
    if (!student) {
      return '';
    }

    const source =
      student.full_name ||
      [student.first_name, student.last_name_father, student.last_name_mother].filter(Boolean).join(' ');

    return source
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }, [student]);

  const registerId = useMemo(() => {
    if (!student) {
      return '';
    }
    return student.register_id ?? student.registration_id ?? '';
  }, [student]);

  const stateMessage =
    status === 'loading' ? loadingLabel : status === 'error' ? error || errorLabel : '';

  return (
    <section className="student-detail-page">
      <header className="student-detail-page__header">
        <div className="student-detail-page__identity">
          <span className="student-detail-page__avatar" aria-hidden="true">
            {initials || '??'}
          </span>
          <div>
            <h2>{student?.full_name || breadcrumbFallback}</h2>
            <p>
              {registerId ? (
                <>
                  {registerLabel}: <strong>{registerId}</strong>
                </>
              ) : (
                placeholderDescription
              )}
            </p>
          </div>
        </div>
        {onNavigateToStudents ? (
          <button
            type="button"
            className="btn btn-outline-primary rounded-pill fw-semibold"
            onClick={onNavigateToStudents}
          >
            {backToStudents}
          </button>
        ) : null}
      </header>

      <div className="student-detail-page__body">
        <div className="student-detail-page__placeholder">
          <div className="student-detail-page__icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img">
              <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 36V12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v24" />
                <path d="M16 16h16" />
                <path d="M16 24h10" />
                <path d="M16 32h8" />
              </g>
            </svg>
          </div>
          <h3>{placeholderTitle}</h3>
          <p>{placeholderDescription}</p>
        </div>
        {stateMessage ? (
          <p
            className={`student-detail-page__state student-detail-page__state--${status}`}
            role={status === 'error' ? 'alert' : undefined}
          >
            {stateMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default StudentDetailPage;
