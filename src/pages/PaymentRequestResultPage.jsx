import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '../components/ui/ActionButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import GlobalTable from '../components/ui/GlobalTable.jsx';
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
    total: 'Total de seleccionados',
    created: 'Creadas',
    duplicates: 'Duplicadas',
  },
  table: {
    columns: {
      type: 'Tipo',
      fullName: 'Nombre del alumno',
      studentId: 'ID del alumno',
    },
    createdLabel: 'Creado',
    duplicateLabel: 'Duplicado',
  },
};

const buildSummary = (result) => {
  if (!result || typeof result !== 'object') {
    return { total: 0, created: 0, duplicates: 0 };
  }

  const createdCount = Number(result.created_count ?? result.created?.length ?? 0) || 0;
  const duplicateCount = Number(result.duplicate_count ?? result.duplicates?.length ?? 0) || 0;
  const total = Number(result.mass_upload ?? createdCount + duplicateCount) || createdCount + duplicateCount;

  return { total, created: createdCount, duplicates: duplicateCount };
};

const normalizeEntry = (entry) => {
  if (!entry) {
    return { fullName: '', studentId: '' };
  }

  if (typeof entry === 'string') {
    return { fullName: entry, studentId: '' };
  }

  return {
    fullName: entry.full_name ?? entry.name ?? '',
    studentId: entry.student_id ?? entry.studentId ?? '',
  };
};

const PaymentRequestResultPage = ({ language = 'es', strings = {}, onNavigateBack }) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
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

  const summary = useMemo(() => buildSummary(result), [result]);

  const createdEntries = useMemo(() => {
    if (!Array.isArray(result?.created)) {
      return [];
    }

    return result.created.map((entry, index) => ({
      ...normalizeEntry(entry),
      _key: `created-${index}`,
      _type: 'created',
    }));
  }, [result?.created]);

  const duplicateEntries = useMemo(() => {
    if (!Array.isArray(result?.duplicates)) {
      return [];
    }

    return result.duplicates.map((entry, index) => ({
      ...normalizeEntry(entry),
      _key: `duplicate-${index}`,
      _type: 'duplicate',
    }));
  }, [result?.duplicates]);

  const hasContent = createdEntries.length > 0 || duplicateEntries.length > 0;

  const handleDownload = useCallback(() => {
    const allEntries = [...createdEntries, ...duplicateEntries];

    if (allEntries.length === 0) {
      return;
    }

    const header = [
      mergedStrings.table.columns.type,
      mergedStrings.table.columns.fullName,
      mergedStrings.table.columns.studentId,
    ];

    const rows = allEntries.map((entry) => {
      const typeLabel =
        entry._type === 'created'
          ? mergedStrings.table.createdLabel
          : mergedStrings.table.duplicateLabel;
      return [typeLabel, entry.fullName ?? '', entry.studentId ?? ''];
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
  }, [createdEntries, duplicateEntries, mergedStrings.table.columns, mergedStrings.table.createdLabel, mergedStrings.table.duplicateLabel]);

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
                    {mergedStrings.summary.total}
                  </span>
                  <strong>{summary.total}</strong>
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
                    { key: 'type', header: mergedStrings.table.columns.type },
                    { key: 'fullName', header: mergedStrings.table.columns.fullName },
                    { key: 'studentId', header: mergedStrings.table.columns.studentId },
                  ]}
                  data={createdEntries}
                  getRowId={(row) => row._key}
                  renderRow={(row) => (
                    <tr key={row._key}>
                      <td data-title={mergedStrings.table.columns.type}>{mergedStrings.table.createdLabel}</td>
                      <td data-title={mergedStrings.table.columns.fullName}>{row.fullName || '—'}</td>
                      <td data-title={mergedStrings.table.columns.studentId}>{row.studentId || '—'}</td>
                    </tr>
                  )}
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
                    { key: 'type', header: mergedStrings.table.columns.type },
                    { key: 'fullName', header: mergedStrings.table.columns.fullName },
                    { key: 'studentId', header: mergedStrings.table.columns.studentId },
                  ]}
                  data={duplicateEntries}
                  getRowId={(row) => row._key}
                  renderRow={(row) => (
                    <tr key={row._key}>
                      <td data-title={mergedStrings.table.columns.type}>{mergedStrings.table.duplicateLabel}</td>
                      <td data-title={mergedStrings.table.columns.fullName}>{row.fullName || '—'}</td>
                      <td data-title={mergedStrings.table.columns.studentId}>{row.studentId || '—'}</td>
                    </tr>
                  )}
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
