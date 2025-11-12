import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '../components/ui/ActionButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import StudentInfo from '../components/ui/StudentInfo.jsx';
import { API_BASE_URL } from '../config.js';
import { handleExpiredToken } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import './PaymentRequestDetailPage.css';

const DEFAULT_STRINGS = {
  breadcrumbFallback: 'Detalle de solicitud',
  back: 'Volver a solicitudes',
  loading: 'Cargando solicitud de pago...',
  error: 'No fue posible cargar la solicitud de pago.',
  retry: 'Reintentar',
  generalTitle: 'Información de la solicitud',
  studentTitle: 'Información del alumno',
  fields: {
    id: 'ID de solicitud',
    concept: 'Concepto',
    amount: 'Monto solicitado',
    status: 'Estatus',
    dueDate: 'Fecha límite de pago',
    createdAt: 'Fecha de creación',
    level: 'Nivel académico',
    generation: 'Generación',
    gradeGroup: 'Grado y grupo',
    lateFee: 'Recargo',
    frequency: 'Frecuencia de recargo',
    feeType: 'Tipo de recargo',
    paymentMonth: 'Mes de pago',
  },
  viewStudent: 'Ver detalle del alumno',
};

const formatDate = (value, language) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

const formatCurrency = (value, language) => {
  if (value == null || value === '') {
    return '';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(numeric);
};

const PaymentRequestDetailPage = ({
  requestId,
  language = 'es',
  strings = {},
  onBreadcrumbChange,
  onNavigateBack,
  onStudentDetail,
}) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const { token, logout } = useAuth();
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const safeRequestId = requestId ? String(requestId) : '';

  const loadRequest = useCallback(async () => {
    if (!safeRequestId) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        lang: language ?? 'es',
        offset: '0',
        limit: '1',
        export_all: 'false',
        payment_request_id: safeRequestId,
      });

      const response = await fetch(`${API_BASE_URL}/reports/paymentrequests?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error(mergedStrings.error);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];
      const requestData = content[0] ?? null;
      setRequest(requestData);

      const breadcrumbLabel =
        requestData?.student_full_name ?? requestData?.student ?? mergedStrings.breadcrumbFallback;
      onBreadcrumbChange?.(breadcrumbLabel);
    } catch (requestError) {
      console.error('Payment request detail error', requestError);
      const message =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : mergedStrings.error;
      setError(message);
      setRequest(null);
    } finally {
      setIsLoading(false);
    }
  }, [language, logout, mergedStrings.breadcrumbFallback, mergedStrings.error, onBreadcrumbChange, safeRequestId, token]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const generalInformation = useMemo(() => {
    if (!request) {
      return [];
    }

    return [
      { label: mergedStrings.fields.id, value: request.payment_request_id },
      { label: mergedStrings.fields.concept, value: request.pt_name ?? request.concept },
      { label: mergedStrings.fields.amount, value: formatCurrency(request.pr_amount, language) },
      { label: mergedStrings.fields.status, value: request.ps_pr_name ?? request.status },
      { label: mergedStrings.fields.dueDate, value: formatDate(request.pr_pay_by, language) },
      { label: mergedStrings.fields.createdAt, value: formatDate(request.pr_created_at, language) },
      { label: mergedStrings.fields.level, value: request.scholar_level_name ?? request.scholar_level },
      { label: mergedStrings.fields.generation, value: request.generation },
      { label: mergedStrings.fields.gradeGroup, value: request.grade_group },
      { label: mergedStrings.fields.lateFee, value: formatCurrency(request.late_fee, language) },
      { label: mergedStrings.fields.frequency, value: request.late_fee_frequency },
      { label: mergedStrings.fields.feeType, value: request.fee_type },
      { label: mergedStrings.fields.paymentMonth, value: request.payment_month },
    ].filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
  }, [language, mergedStrings.fields, request]);

  const handleViewStudent = useCallback(() => {
    if (!request?.student_id) {
      return;
    }

    onStudentDetail?.({
      id: request.student_id,
      name: request.student_full_name ?? request.student,
      registerId: request.payment_reference,
    });
  }, [onStudentDetail, request]);

  return (
    <div className="page">
      <header className="page__header">
        <ActionButton type="button" variant="text" onClick={onNavigateBack}>
          {mergedStrings.back}
        </ActionButton>
      </header>

      <div className="page__layout">
        <section className="page__content payment-request-detail">
          {isLoading ? (
            <div className="page__empty-state">{mergedStrings.loading}</div>
          ) : error ? (
            <UiCard className="payment-request-detail__card">
              <p className="text-danger mb-3">{error}</p>
              <ActionButton type="button" onClick={loadRequest}>
                {mergedStrings.retry}
              </ActionButton>
            </UiCard>
          ) : !request ? (
            <div className="page__empty-state">{mergedStrings.empty ?? mergedStrings.error}</div>
          ) : (
            <>
              <UiCard className="payment-request-detail__card">
                <h1 className="payment-request-detail__title">{mergedStrings.generalTitle}</h1>
                <dl className="payment-request-detail__list">
                  {generalInformation.map((item) => (
                    <div key={item.label} className="payment-request-detail__list-item">
                      <dt>{item.label}</dt>
                      <dd>{item.value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </UiCard>

              <UiCard className="payment-request-detail__card">
                <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                  <h2 className="payment-request-detail__title mb-0">{mergedStrings.studentTitle}</h2>
                  <ActionButton
                    type="button"
                    variant="secondary"
                    onClick={handleViewStudent}
                    disabled={!request?.student_id}
                  >
                    {mergedStrings.viewStudent}
                  </ActionButton>
                </div>
                <StudentInfo
                  name={request.student_full_name ?? request.student}
                  fallbackName="—"
                  metaLabel={mergedStrings.fields.id}
                  metaValue={request.payment_reference}
                />
              </UiCard>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default PaymentRequestDetailPage;
