import { useEffect, useMemo, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import StudentInfo from '../components/ui/StudentInfo.jsx';
import { API_BASE_URL } from '../config.js';
import { handleExpiredToken } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import './PaymentRequestScheduleDetailPage.css';

const DEFAULT_STRINGS = {
  breadcrumbFallback: 'Detalle de programación',
  back: 'Volver a programaciones',
  loading: 'Cargando programación...',
  error: 'No fue posible cargar la programación.',
  logsError: 'No fue posible cargar el historial.',
  retry: 'Reintentar',
  generalTitle: 'Resumen de la programación',
  executionTitle: 'Ejecución',
  targetTitle: 'Dirigido a',
  logsTitle: 'Historial de ejecuciones',
  emptyLogs: 'Aún no hay ejecuciones registradas para esta programación.',
  emptyTarget: 'No se encontró información del destino.',
  studentLabel: 'Alumno',
  groupLabel: 'Grupo',
  schoolLabel: 'Escuela',
  viewStudent: 'Ver alumno',
  viewRequest: 'Ver solicitud',
  statusActive: 'Activo',
  statusInactive: 'Inactivo',
  fields: {
    amount: 'Monto',
    lateFee: 'Recargo',
    lateFeeFrequency: 'Frecuencia de recargo',
    feeType: 'Tipo de recargo',
    intervalCount: 'Intervalo',
    paymentWindow: 'Ventana de pago (días)',
    startDate: 'Fecha de inicio',
    nextExecutionDate: 'Próxima ejecución',
    periodName: 'Periodo de tiempo',
    status: 'Estatus',
    createdAt: 'Creado',
    updatedAt: 'Actualizado',
    studentIdLabel: 'Matrícula',
  },
  logLabels: {
    referenceDate: 'Fecha de referencia',
    massUpload: 'Carga masiva',
    created: 'Creadas',
    duplicates: 'Duplicadas',
    schedule: 'Programación',
    concept: 'Concepto',
    nextExecutionDate: 'Próxima ejecución',
    amount: 'Monto',
    typeSuccess: 'Éxito',
    typeWarning: 'Advertencia',
    typeNeutral: 'Sin estado',
    open: 'Ver detalle',
    collapse: 'Ocultar detalle',
    createdRequests: 'Solicitudes creadas',
    duplicatedRequests: 'Solicitudes duplicadas',
  },
};

const getInitials = (value) =>
  String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

const formatDate = (value, language) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatCurrency = (value, language) => {
  if (value == null || value === '') {
    return '';
  }

  const number = Number(value);
  if (Number.isNaN(number)) {
    return String(value);
  }

  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(number);
};

const normalizeLogType = (value) => {
  if (!value) {
    return 'neutral';
  }

  const normalized = String(value).toLowerCase();
  if (normalized === 'success') {
    return 'success';
  }

  if (normalized === 'warning') {
    return 'warning';
  }

  return 'neutral';
};

const tagClassName = {
  success: 'schedule-detail__tag schedule-detail__tag--success',
  warning: 'schedule-detail__tag schedule-detail__tag--warning',
  neutral: 'schedule-detail__tag schedule-detail__tag--neutral',
};

const PaymentRequestScheduleDetailPage = ({
  scheduleId,
  language = 'es',
  strings = {},
  onBreadcrumbChange,
  onNavigateBack,
  onStudentDetail,
  onPaymentRequestDetail,
}) => {
  const { token, logout } = useAuth();
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState(null);
  const [logsRefresh, setLogsRefresh] = useState(0);

  const mergedStrings = useMemo(
    () => ({
      ...DEFAULT_STRINGS,
      ...strings,
      fields: { ...DEFAULT_STRINGS.fields, ...(strings.fields ?? {}) },
      logLabels: { ...DEFAULT_STRINGS.logLabels, ...(strings.logLabels ?? {}) },
    }),
    [strings],
  );

  const logTypeLabels = useMemo(
    () => ({
      success: mergedStrings.logLabels.typeSuccess,
      warning: mergedStrings.logLabels.typeWarning,
      neutral: mergedStrings.logLabels.typeNeutral,
    }),
    [mergedStrings.logLabels],
  );

  useEffect(() => {
    if (!scheduleId) {
      return;
    }

    if (onBreadcrumbChange) {
      onBreadcrumbChange(`${mergedStrings.breadcrumbFallback} → ${scheduleId}`);
    }
  }, [mergedStrings.breadcrumbFallback, onBreadcrumbChange, scheduleId]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchDetail = async () => {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const url = new URL(`${API_BASE_URL}/payment-requests/schedule/details`);
        url.searchParams.set('payment_request_scheduled_id', scheduleId);

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error('Request failed');
        }

        const payload = await response.json();
        if (isMounted) {
          setDetail(payload ?? null);
          setDetailLoading(false);
        }
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        console.error('Unable to load schedule detail', error);
        setDetailError(error);
        setDetailLoading(false);
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [detailRefresh, logout, scheduleId, token]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);

      try {
        const url = new URL(`${API_BASE_URL}/logs/scheduled-jobs`);
        url.searchParams.set('lang', language);
        url.searchParams.set('payment_request_scheduled_id', scheduleId);

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error('Request failed');
        }

        const payload = await response.json();
        if (isMounted) {
          setLogs(Array.isArray(payload) ? payload : []);
          setLogsLoading(false);
        }
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        console.error('Unable to load schedule logs', error);
        setLogsError(error);
        setLogsLoading(false);
      }
    };

    fetchLogs();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [language, logsRefresh, logout, scheduleId, token]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const aDate = new Date(a?.reference_date ?? 0).getTime();
      const bDate = new Date(b?.reference_date ?? 0).getTime();
      return Number.isNaN(bDate) ? -1 : Number.isNaN(aDate) ? 1 : bDate - aDate;
    });
  }, [logs]);

  const renderTarget = () => {
    if (!detail) {
      return null;
    }

    const hasStudent = Boolean(detail.student_detail);
    const hasGroup = Boolean(detail.group_detail);
    const hasSchool = Boolean(detail.school_detail);

    if (!hasStudent && !hasGroup && !hasSchool) {
      return <p className="schedule-detail__entity-meta">{mergedStrings.emptyTarget}</p>;
    }

    return (
      <div className="schedule-detail__target">
        {hasStudent ? (
          <div className="schedule-detail__entity-box">
            <h3 className="schedule-detail__entity-title">{mergedStrings.studentLabel}</h3>
            <StudentInfo
              name={detail.student_detail?.full_name}
              metaLabel={mergedStrings.fields.studentIdLabel}
              metaValue={detail.student_detail?.register_id}
              onClick={detail.student_detail?.student_id ? () => onStudentDetail?.(detail.student_detail?.student_id) : undefined}
              avatarText={getInitials(detail.student_detail?.full_name)}
              nameButtonProps={{ 'aria-label': mergedStrings.viewStudent }}
            />
            <p className="schedule-detail__entity-meta">
              {detail.student_detail?.grade_group ?? ''}{' '}
              {detail.student_detail?.generation ? `· ${detail.student_detail.generation}` : ''}
            </p>
          </div>
        ) : null}

        {hasGroup ? (
          <div className="schedule-detail__entity-box">
            <h3 className="schedule-detail__entity-title">{mergedStrings.groupLabel}</h3>
            <p className="schedule-detail__entity-meta">
              {detail.group_detail?.grade ?? ''}
              {detail.group_detail?.group ? `-${detail.group_detail.group}` : ''}
              {detail.group_detail?.generation ? ` · ${detail.group_detail.generation}` : ''}
            </p>
          </div>
        ) : null}

        {hasSchool ? (
          <div className="schedule-detail__entity-box">
            <h3 className="schedule-detail__entity-title">{mergedStrings.schoolLabel}</h3>
            <p className="schedule-detail__entity-meta">
              {detail.school_detail?.commercial_name ?? detail.school_detail?.business_name}
            </p>
            <p className="schedule-detail__entity-meta">
              {[detail.school_detail?.locality, detail.school_detail?.state]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  const renderLogStudents = (title, list = []) => {
    if (!list || list.length === 0) {
      return null;
    }

    return (
      <div className="schedule-detail__log-section">
        <h4>{title}</h4>
        {list.map((student, index) => {
          const studentId = student?.student_id;
          const requestId = student?.payment_request_id;
          const meta = student?.grade_group ?? student?.register_id ?? '';
          const rowKey = `${title}-${requestId ?? studentId ?? index}`;

          return (
            <div key={rowKey} className="schedule-detail__student-row">
              <StudentInfo
                name={student?.full_name}
                metaValue={meta}
                onClick={studentId ? () => onStudentDetail?.(studentId) : undefined}
                avatarText={getInitials(student?.full_name)}
                nameButtonProps={{ 'aria-label': student?.full_name ?? mergedStrings.viewStudent }}
              />
              <ActionButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={requestId ? () => onPaymentRequestDetail?.(requestId) : undefined}
                disabled={!requestId}
                aria-label={mergedStrings.viewRequest}
              >
                {mergedStrings.viewRequest}
              </ActionButton>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLogs = () => {
    if (logsLoading) {
      return <p className="schedule-detail__subtitle">{mergedStrings.loading}</p>;
    }

    if (logsError) {
      return <p className="schedule-detail__subtitle">{mergedStrings.logsError}</p>;
    }

    if (!sortedLogs.length) {
      return <p className="schedule-detail__empty">{mergedStrings.emptyLogs}</p>;
    }

    return (
      <ul className="schedule-detail__logs-list">
        {sortedLogs.map((log, index) => {
          const logType = normalizeLogType(log?.type);
          const createdList = log?.rules?.[0]?.created ?? [];
          const duplicateList = log?.rules?.[0]?.Duplicated ?? [];
          const referenceDateLabel = formatDate(log?.reference_date, language);
          const summaryLabel = `${mergedStrings.logLabels.referenceDate}: ${referenceDateLabel || '—'}`;

          return (
            <li key={`${log.reference_date ?? 'log'}-${index}`} className="schedule-detail__log">
              <details>
                <summary>
                  <span className={tagClassName[logType]}>{logTypeLabels[logType]}</span>
                  <div>
                    <strong>{log?.title || mergedStrings.logsTitle}</strong>
                    <p className="mb-0 schedule-detail__subtitle">{log?.message || summaryLabel}</p>
                    <div className="schedule-detail__log-meta">
                      {referenceDateLabel ? (
                        <span>
                          {mergedStrings.logLabels.referenceDate}: <strong>{referenceDateLabel}</strong>
                        </span>
                      ) : null}
                      {log?.created_count != null ? (
                        <span>
                          {mergedStrings.logLabels.created}: <strong>{log.created_count}</strong>
                        </span>
                      ) : null}
                      {log?.duplicate_count != null ? (
                        <span>
                          {mergedStrings.logLabels.duplicates}: <strong>{log.duplicate_count}</strong>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="schedule-detail__log-chevron" aria-hidden="true">
                    ▶
                  </span>
                </summary>
                <div className="schedule-detail__log-body">
                  {log?.schedule ? (
                    <div className="schedule-detail__log-section">
                      <h4>{mergedStrings.logLabels.schedule}</h4>
                      <div className="schedule-detail__log-meta">
                        <span>
                          {mergedStrings.logLabels.concept}: <strong>{log.schedule?.concept ?? '—'}</strong>
                        </span>
                        <span>
                          {mergedStrings.logLabels.amount}:{' '}
                          <strong>{formatCurrency(log.schedule?.amount, language) || '—'}</strong>
                        </span>
                        {log.schedule?.next_execution_date ? (
                          <span>
                            {mergedStrings.logLabels.nextExecutionDate}:{' '}
                            <strong>
                              {formatDate(log.schedule.next_execution_date, language) || '—'}
                            </strong>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {renderLogStudents(mergedStrings.logLabels.createdRequests, createdList)}
                  {renderLogStudents(mergedStrings.logLabels.duplicatedRequests, duplicateList)}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="page__layout">
      <GlobalToast
        alert={detailError || logsError ? { type: 'danger', message: mergedStrings.error } : null}
        onClose={() => {
          setDetailError(null);
          setLogsError(null);
        }}
      />
      <section className="page__content">
        <div className="page__header">
          <div className="schedule-detail__header">
            {onNavigateBack ? (
              <ActionButton type="button" variant="secondary" onClick={onNavigateBack}>
                ← {mergedStrings.back}
              </ActionButton>
            ) : null}
            <div>
              <p className="schedule-detail__subtitle">{mergedStrings.generalTitle}</p>
              <h2 className="schedule-detail__title">
                {detail?.rule_name_es || detail?.rule_name_en || mergedStrings.breadcrumbFallback}
              </h2>
            </div>
          </div>
        </div>

        {detailLoading ? (
          <p className="schedule-detail__subtitle">{mergedStrings.loading}</p>
        ) : detailError ? (
          <div>
            <p className="schedule-detail__subtitle">{mergedStrings.error}</p>
            <ActionButton type="button" onClick={() => setDetailRefresh((value) => value + 1)}>
              {mergedStrings.retry}
            </ActionButton>
          </div>
        ) : detail ? (
          <div className="schedule-detail">
            <div className="schedule-detail__grid">
              <UiCard>
                <header className="card__header">
                  <p className="card__subtitle">{mergedStrings.generalTitle}</p>
                  <h3 className="card__title">#{detail.payment_request_scheduled_id ?? '—'}</h3>
                </header>
                <ul className="schedule-detail__list">
                  <li className="schedule-detail__item">
                    <span className="schedule-detail__item-label">{mergedStrings.fields.amount}</span>
                    <span>{formatCurrency(detail.amount, language) || '—'}</span>
                  </li>
                  <li className="schedule-detail__item">
                    <span className="schedule-detail__item-label">{mergedStrings.fields.lateFee}</span>
                    <span>
                      {formatCurrency(detail.late_fee, language) || '—'} {detail.fee_type ?? ''}
                    </span>
                  </li>
                  <li className="schedule-detail__item">
                    <span className="schedule-detail__item-label">{mergedStrings.fields.status}</span>
                    <span>{detail.active ? mergedStrings.statusActive : mergedStrings.statusInactive}</span>
                  </li>
                </ul>
              </UiCard>

              <UiCard>
                <header className="card__header">
                  <p className="card__subtitle">{mergedStrings.executionTitle}</p>
                </header>
                <ul className="schedule-detail__list">
                  <li className="schedule-detail__item">
                    <span className="schedule-detail__item-label">{mergedStrings.fields.startDate}</span>
                    <span>{formatDate(detail.start_date, language) || '—'}</span>
                  </li>
                  <li className="schedule-detail__item">
                    <span className="schedule-detail__item-label">{mergedStrings.fields.nextExecutionDate}</span>
                    <span>{formatDate(detail.next_execution_date, language) || '—'}</span>
                  </li>
                  <li className="schedule-detail__item">
                    <span className="schedule-detail__item-label">{mergedStrings.fields.paymentWindow}</span>
                    <span>{detail.payment_window ?? '—'}</span>
                  </li>
                  <li className="schedule-detail__item">
                    <span className="schedule-detail__item-label">{mergedStrings.fields.intervalCount}</span>
                    <span>{detail.interval_count ?? '—'}</span>
                  </li>
                </ul>
              </UiCard>

              <UiCard>
                <header className="card__header">
                  <p className="card__subtitle">{mergedStrings.targetTitle}</p>
                </header>
                {renderTarget()}
              </UiCard>
            </div>

            <UiCard>
              <header className="card__header d-flex align-items-center justify-content-between">
                <div>
                  <p className="card__subtitle">{mergedStrings.logsTitle}</p>
                  <h3 className="card__title mb-0">{mergedStrings.logLabels.open}</h3>
                </div>
                {logsError ? (
                  <ActionButton type="button" size="sm" variant="secondary" onClick={() => setLogsRefresh((value) => value + 1)}>
                    {mergedStrings.retry}
                  </ActionButton>
                ) : null}
              </header>
              {renderLogs()}
            </UiCard>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default PaymentRequestScheduleDetailPage;
