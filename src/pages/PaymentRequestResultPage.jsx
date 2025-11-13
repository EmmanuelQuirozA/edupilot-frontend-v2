import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '../components/ui/ActionButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import GlobalTable from '../components/ui/GlobalTable.jsx';
import StudentInfo from '../components/ui/StudentInfo.jsx';
import './PaymentRequestResultPage.css';

export const PAYMENT_REQUEST_RESULT_STORAGE_KEY = 'paymentRequests:lastResult';

const DEFAULT_STRINGS = {
  title: 'Resultado de solicitudes de pago',
  description: 'Consulta el detalle de las solicitudes creadas y duplicadas.',
  empty: 'No hay información disponible para mostrar.',
  back: 'Volver a solicitudes',
  download: 'Descargar CSV',
  createdTitle: 'Solicitudes creadas',
  duplicatesTitle: 'Solicitudes duplicadas',
  summary: {
    massUpload: 'Carga masiva',
    created: 'Creadas',
    duplicates: 'Duplicadas',
  },
  table: {
    columns: {
      status: 'Resultado',
      student: 'Alumno',
      request: 'Solicitud',
    },
    createdLabel: 'Creado',
    duplicateLabel: 'Duplicado',
    studentFallback: 'Sin nombre',
    studentMetaLabel: 'Matrícula',
    studentLinkAria: 'Ver detalle del alumno',
    viewRequest: 'Ver solicitud',
    requestIdFallback: '—',
    studentIdLabel: 'ID del alumno',
    requestIdLabel: 'ID de solicitud',
  },
};

const parseCount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeRawEntries = (entries) => {
  if (!entries) {
    return [];
  }

  if (Array.isArray(entries)) {
    return entries;
  }

  if (typeof entries === 'object') {
    return Object.values(entries);
  }

  return [];
};

const normalizeEntry = (entry) => {
  if (!entry || typeof entry !== 'object') {
    if (typeof entry === 'string') {
      return { fullName: entry, studentId: '', registerId: '', paymentRequestId: '' };
    }

    return { fullName: '', studentId: '', registerId: '', paymentRequestId: '' };
  }

  const fullName = entry.full_name ?? entry.name ?? entry.fullName ?? '';
  const studentId = entry.student_id ?? entry.studentId ?? entry.student_uuid ?? '';
  const registerId = entry.register_id ?? entry.registerId ?? entry.payment_reference ?? '';
  const paymentRequestId = entry.payment_request_id ?? entry.paymentRequestId ?? entry.id ?? '';

  return {
    fullName,
    studentId,
    registerId,
    paymentRequestId,
  };
};

const buildSummary = (result, createdLength = 0, duplicateLength = 0) => {
  if (!result || typeof result !== 'object') {
    return { massUpload: '', created: 0, duplicates: 0 };
  }

  const createdCount = parseCount(result.created_count);
  const duplicateCount = parseCount(result.duplicate_count);
  const massUploadValue = result.mass_upload;

  return {
    massUpload:
      massUploadValue !== undefined && massUploadValue !== null && String(massUploadValue).trim() !== ''
        ? String(massUploadValue).trim()
        : '',
    created: createdCount ?? createdLength ?? 0,
    duplicates: duplicateCount ?? duplicateLength ?? 0,
  };
};

const PaymentRequestResultPage = ({
  strings = {},
  onNavigateBack,
  onStudentDetail,
  onPaymentRequestDetail,
}) => {
  const mergedStrings = useMemo(() => {
    const summary = { ...DEFAULT_STRINGS.summary, ...(strings.summary ?? {}) };
    const tableOverrides = strings.table ?? {};
    const tableColumns = { ...DEFAULT_STRINGS.table.columns, ...(tableOverrides.columns ?? {}) };
    const table = {
      ...DEFAULT_STRINGS.table,
      ...tableOverrides,
      columns: tableColumns,
    };

    return {
      ...DEFAULT_STRINGS,
      ...strings,
      summary,
      table,
    };
  }, [strings]);
  const [result, setResult] = useState(null);

  const loadResult = useCallback(() => {
    if (typeof window === 'undefined') {
      setResult(null);
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(PAYMENT_REQUEST_RESULT_STORAGE_KEY);
      if (!raw) {
        setResult(null);
        return;
      }

      const parsed = JSON.parse(raw);
      setResult(parsed && typeof parsed === 'object' ? parsed : null);
    } catch (error) {
      console.error('Unable to parse payment request result', error);
      setResult(null);
    }
  }, []);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  const createdEntries = useMemo(() => {
    const rawEntries = normalizeRawEntries(result?.created);

    return rawEntries.map((entry, index) => ({
      ...normalizeEntry(entry),
      _key: `created-${index}`,
      _type: 'created',
    }));
  }, [result]);

  const duplicateEntries = useMemo(() => {
    const rawEntries = normalizeRawEntries(result?.duplicates);

    return rawEntries.map((entry, index) => ({
      ...normalizeEntry(entry),
      _key: `duplicate-${index}`,
      _type: 'duplicate',
    }));
  }, [result]);

  const summary = useMemo(
    () => buildSummary(result, createdEntries.length, duplicateEntries.length),
    [createdEntries.length, duplicateEntries.length, result],
  );

  const hasContent = createdEntries.length > 0 || duplicateEntries.length > 0;

  const handleDownload = useCallback(() => {
    const allEntries = [...createdEntries, ...duplicateEntries];

    if (allEntries.length === 0) {
      return;
    }

    const header = [
      mergedStrings.table.columns.status,
      mergedStrings.table.columns.student,
      mergedStrings.table.studentMetaLabel,
      mergedStrings.table.requestIdLabel ?? mergedStrings.table.columns.request,
      mergedStrings.table.studentIdLabel,
    ];

    const rows = allEntries.map((entry) => {
      const typeLabel =
        entry._type === 'created'
          ? mergedStrings.table.createdLabel
          : mergedStrings.table.duplicateLabel;
      return [
        typeLabel,
        entry.fullName ?? '',
        entry.registerId ?? '',
        entry.paymentRequestId ?? '',
        entry.studentId ?? '',
      ];
    });

    const csvContent = [header, ...rows]
      .map((columns) =>
        columns.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','),
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `payment-request-result-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    createdEntries,
    duplicateEntries,
    mergedStrings.table.columns,
    mergedStrings.table.createdLabel,
    mergedStrings.table.duplicateLabel,
    mergedStrings.table.requestIdLabel,
    mergedStrings.table.studentIdLabel,
    mergedStrings.table.studentMetaLabel,
  ]);

  const handleStudentDetailEntry = useCallback(
    (entry) => {
      if (!onStudentDetail) {
        return;
      }

      const studentId = entry?.studentId;
      if (!studentId) {
        return;
      }

      onStudentDetail({
        id: studentId,
        name: entry?.fullName ?? '',
        registerId: entry?.registerId ?? '',
      });
    },
    [onStudentDetail],
  );

  const handleRequestDetailEntry = useCallback(
    (entry) => {
      const requestId = entry?.paymentRequestId;
      if (!requestId) {
        return;
      }

      onPaymentRequestDetail?.(String(requestId));
    },
    [onPaymentRequestDetail],
  );

  const renderEntryRow = useCallback(
    (row) => {
      const statusLabel =
        row._type === 'created'
          ? mergedStrings.table.createdLabel
          : mergedStrings.table.duplicateLabel;
      const studentFallback = mergedStrings.table.studentFallback ?? '—';
      const studentMetaLabel = row.registerId ? mergedStrings.table.studentMetaLabel : undefined;
      const studentName = row.fullName && row.fullName.trim() !== '' ? row.fullName : studentFallback;
      const baseStudentAria = mergedStrings.table.studentLinkAria ?? 'Ver detalle del alumno';
      const studentAriaLabel = studentName
        ? `${baseStudentAria} ${studentName}`.trim()
        : baseStudentAria;
      const requestId = row.paymentRequestId != null && row.paymentRequestId !== ''
        ? String(row.paymentRequestId)
        : '';
      const canOpenRequest = Boolean(onPaymentRequestDetail && requestId);
      const canOpenStudent = Boolean(onStudentDetail && row.studentId);
      const requestIdDisplay = requestId || mergedStrings.table.requestIdFallback;

      return (
        <tr key={row._key}>
          <td data-title={mergedStrings.table.columns.status}>{statusLabel}</td>
          <td data-title={mergedStrings.table.columns.student}>
            <StudentInfo
              name={row.fullName}
              fallbackName={studentFallback}
              metaLabel={studentMetaLabel}
              metaValue={row.registerId}
              onClick={canOpenStudent ? () => handleStudentDetailEntry(row) : undefined}
              disabled={!canOpenStudent}
              nameButtonProps={{ 'aria-label': studentAriaLabel }}
            />
          </td>
          <td data-title={mergedStrings.table.columns.request}>
            <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
              <span>{requestIdDisplay}</span>
              <ActionButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleRequestDetailEntry(row)}
                disabled={!canOpenRequest}
              >
                {mergedStrings.table.viewRequest}
              </ActionButton>
            </div>
          </td>
        </tr>
      );
    },
    [
      handleRequestDetailEntry,
      handleStudentDetailEntry,
      mergedStrings.table.columns.request,
      mergedStrings.table.columns.status,
      mergedStrings.table.columns.student,
      mergedStrings.table.requestIdFallback,
      mergedStrings.table.studentFallback,
      mergedStrings.table.studentLinkAria,
      mergedStrings.table.studentMetaLabel,
      mergedStrings.table.viewRequest,
      onPaymentRequestDetail,
      onStudentDetail,
    ],
  );

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">{mergedStrings.title}</h1>
          <p className="page__description">{mergedStrings.description}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <ActionButton type="button" variant="secondary" onClick={handleDownload} disabled={!hasContent}>
            {mergedStrings.download}
          </ActionButton>
          <ActionButton type="button" variant="text" onClick={onNavigateBack}>
            {mergedStrings.back}
          </ActionButton>
        </div>
      </header>

      {!hasContent ? (
        <div className="page__empty-state">{mergedStrings.empty}</div>
      ) : (
        <div className="page__layout">
          <section className="page__content payment-request-result">
            <UiCard>
              <div className="payment-request-result__summary">
                <div>
                  <span className="payment-request-result__summary-label">
                    {mergedStrings.summary.massUpload}
                  </span>
                  <strong>{summary.massUpload !== '' ? summary.massUpload : '—'}</strong>
                </div>
                <div>
                  <span className="payment-request-result__summary-label">
                    {mergedStrings.summary.created}
                  </span>
                  <strong>{summary.created}</strong>
                </div>
                <div>
                  <span className="payment-request-result__summary-label">
                    {mergedStrings.summary.duplicates}
                  </span>
                  <strong>{summary.duplicates}</strong>
                </div>
              </div>
            </UiCard>

            {createdEntries.length > 0 && (
              <UiCard>
                <h2 className="payment-request-result__section-title">
                  {mergedStrings.createdTitle}
                </h2>
                <GlobalTable
                  tableClassName="table mb-0"
                  columns={[
                    { key: 'status', header: mergedStrings.table.columns.status },
                    { key: 'student', header: mergedStrings.table.columns.student },
                    { key: 'request', header: mergedStrings.table.columns.request },
                  ]}
                  data={createdEntries}
                  getRowId={(row) => row._key}
                  renderRow={renderEntryRow}
                  pagination={null}
                />
              </UiCard>
            )}

            {duplicateEntries.length > 0 && (
              <UiCard>
                <h2 className="payment-request-result__section-title">
                  {mergedStrings.duplicatesTitle}
                </h2>
                <GlobalTable
                  tableClassName="table mb-0"
                  columns={[
                    { key: 'status', header: mergedStrings.table.columns.status },
                    { key: 'student', header: mergedStrings.table.columns.student },
                    { key: 'request', header: mergedStrings.table.columns.request },
                  ]}
                  data={duplicateEntries}
                  getRowId={(row) => row._key}
                  renderRow={renderEntryRow}
                  pagination={null}
                />
              </UiCard>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default PaymentRequestResultPage;
