import { useCallback, useEffect, useMemo, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import AddRecordButton from '../components/ui/buttons/AddRecordButton.jsx';
import ExportButton from '../components/ui/buttons/ExportButton.jsx';
import FilterButton from '../components/ui/buttons/FilterButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import { Table, TableContainer } from '../components/ui/DataTable.jsx';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import './PaymentsFinancePage.css';

const DEFAULT_LIMIT = 10;
const MONTH_KEY_REGEX = /^[A-Za-z]{3}-\d{2}$/;

const extractListFromPayload = (payload) => {
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
    payload.schools,
    payload.content,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeSelectOption = (item, index = 0) => {
  if (item == null) {
    return { value: '', label: '' };
  }

  if (typeof item !== 'object') {
    const stringValue = String(item);
    return { value: stringValue, label: stringValue };
  }

  const valueKeys = ['id', 'school_id', 'schoolId', 'value'];
  let value = '';

  for (const key of valueKeys) {
    const candidate = item[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      value = String(candidate);
      break;
    }
  }

  const labelKeys = ['name', 'label', 'title', 'description'];
  let label = '';

  for (const key of labelKeys) {
    const candidate = item[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      label = candidate;
      break;
    }
  }

  if (!label) {
    label = value || String(index + 1);
  }

  return { value, label };
};

const DEFAULT_PAYMENTS_STRINGS = {
  placeholder: 'Esta sección estará disponible próximamente.',
  tabs: {
    tuition: 'Colegiaturas',
    requests: 'Solicitudes de pago',
    payments: 'Pagos',
  },
  actions: {
    filter: 'Filtros',
    debtActive: 'Mostrando morosos',
    debtInactive: 'Alumnos con deuda',
    add: 'Agregar pago',
    export: 'Exportar CSV',
    exporting: 'Exportando…',
  },
  search: {
    placeholder: 'Buscar alumno por nombre',
  },
  dateRange: {
    start: 'Fecha inicio',
    end: 'Fecha fin',
  },
  table: {
    columns: {
      student: 'Alumno',
      class: 'Grupo',
      generation: 'Generación',
      scholarLevel: 'Nivel académico',
    },
    loading: 'Cargando información de pagos...',
    empty: 'No se encontraron registros con los filtros seleccionados.',
    error: 'No fue posible cargar los pagos.',
    unknownError: 'Error desconocido',
    studentFallback: 'Sin nombre',
    studentIdLabel: 'Matrícula',
    pagination: {
      summary: 'Mostrando {start} - {end} de {total} registros',
      page: 'Página {current} de {total}',
      previous: 'Anterior',
      next: 'Siguiente',
    },
  },
  filters: {
    title: 'Filtros',
    reset: 'Reiniciar',
    closeAria: 'Cerrar filtros',
    fields: {
      student: { label: 'Nombre del alumno', placeholder: 'Ej. FATIMA MONTSERRAT' },
      reference: { label: 'Matrícula', placeholder: 'Ej. 1376' },
      generation: { label: 'Generación', placeholder: 'Ej. 2024-2025' },
      gradeGroup: { label: 'Grado y grupo', placeholder: 'Ej. 6-A' },
      scholarLevel: { label: 'Nivel académico', placeholder: 'Ej. Primaria' },
      school: { label: 'Escuela' },
    },
    schoolOptions: { all: 'Todas' },
    toggles: {
      activeGroups: 'Sólo grupos activos',
      activeStudents: 'Sólo alumnos activos',
    },
  },
  toggles: {
    debtActive: 'Mostrando morosos',
    debtInactive: 'Alumnos con deuda',
  },
  toasts: {
    loadSchoolsError: 'No fue posible cargar las escuelas.',
    exportSuccess: 'Exportación generada correctamente.',
    exportEmpty: 'No hay información para exportar con los filtros actuales.',
    exportError: 'Error al exportar.',
  },
  errors: {
    loadSchools: 'No fue posible cargar las escuelas',
    export: 'No fue posible exportar la información.',
  },
  csv: {
    fileNamePrefix: 'reporte-pagos',
    headers: {
      student: 'Alumno',
      class: 'Grupo',
      generation: 'Generación',
      scholarLevel: 'Nivel académico',
    },
    studentIdLabel: 'Matrícula',
  },
};

const SUPPORTED_LANGUAGES = ['es', 'en'];

const getLocaleFromLanguage = (language) => (language === 'en' ? 'en-US' : 'es-MX');

const PaymentsFinancePage = ({
  title = 'Pagos y Finanzas',
  description = '',
  language = 'es',
  strings = {},
  onStudentDetail,
}) => {
  const { token } = useAuth();

  const normalizedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'es';
  const locale = getLocaleFromLanguage(normalizedLanguage);

  const tabStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.tabs, ...(strings.tabs ?? {}) }),
    [strings.tabs],
  );
  const actionStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.actions, ...(strings.actions ?? {}) }),
    [strings.actions],
  );
  const dateRangeStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.dateRange, ...(strings.dateRange ?? {}) }),
    [strings.dateRange],
  );
  const tableStrings = useMemo(() => {
    const tableOverrides = strings.table ?? {};
    const columns = {
      ...DEFAULT_PAYMENTS_STRINGS.table.columns,
      ...(tableOverrides.columns ?? {}),
    };
    const pagination = {
      ...DEFAULT_PAYMENTS_STRINGS.table.pagination,
      ...(tableOverrides.pagination ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.table,
      ...tableOverrides,
      columns,
      pagination,
    };
  }, [strings.table]);
  const filterStrings = useMemo(() => {
    const filterOverrides = strings.filters ?? {};
    const fieldDefaults = DEFAULT_PAYMENTS_STRINGS.filters.fields;
    const fieldOverrides = filterOverrides.fields ?? {};
    const fields = {
      student: { ...fieldDefaults.student, ...(fieldOverrides.student ?? {}) },
      reference: { ...fieldDefaults.reference, ...(fieldOverrides.reference ?? {}) },
      generation: { ...fieldDefaults.generation, ...(fieldOverrides.generation ?? {}) },
      gradeGroup: { ...fieldDefaults.gradeGroup, ...(fieldOverrides.gradeGroup ?? {}) },
      scholarLevel: { ...fieldDefaults.scholarLevel, ...(fieldOverrides.scholarLevel ?? {}) },
      school: { ...fieldDefaults.school, ...(fieldOverrides.school ?? {}) },
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.filters,
      ...filterOverrides,
      fields,
      schoolOptions: {
        ...DEFAULT_PAYMENTS_STRINGS.filters.schoolOptions,
        ...(filterOverrides.schoolOptions ?? {}),
      },
      toggles: {
        ...DEFAULT_PAYMENTS_STRINGS.filters.toggles,
        ...(filterOverrides.toggles ?? {}),
      },
    };
  }, [strings.filters]);
  const debtToggleStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.toggles, ...(strings.toggles ?? {}) }),
    [strings.toggles],
  );
  const toastStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.toasts, ...(strings.toasts ?? {}) }),
    [strings.toasts],
  );
  const errorStrings = useMemo(
    () => ({ ...DEFAULT_PAYMENTS_STRINGS.errors, ...(strings.errors ?? {}) }),
    [strings.errors],
  );
  const csvStrings = useMemo(() => {
    const csvOverrides = strings.csv ?? {};
    const headers = {
      ...DEFAULT_PAYMENTS_STRINGS.csv.headers,
      ...(csvOverrides.headers ?? {}),
    };

    return {
      ...DEFAULT_PAYMENTS_STRINGS.csv,
      ...csvOverrides,
      headers,
      studentIdLabel:
        csvOverrides.studentIdLabel ?? DEFAULT_PAYMENTS_STRINGS.csv.studentIdLabel,
    };
  }, [strings.csv]);
  const placeholderMessage = strings.placeholder ?? DEFAULT_PAYMENTS_STRINGS.placeholder;
  const searchPlaceholder =
    strings.search?.placeholder ?? DEFAULT_PAYMENTS_STRINGS.search.placeholder;

  const [activeTab, setActiveTab] = useState('tuition');
  const [filters, setFilters] = useState({
    group_status: '',
    user_status: '',
    student_full_name: '',
    payment_reference: '',
    generation: '',
    grade_group: '',
    scholar_level: '',
    school_id: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [showDebtOnly, setShowDebtOnly] = useState(false);

  const [orderBy, setOrderBy] = useState('');
  const [orderDir, setOrderDir] = useState('ASC');

  const [offset, setOffset] = useState(0);
  const [limit] = useState(DEFAULT_LIMIT);

  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [toast, setToast] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const tabs = useMemo(
    () => [
      { key: 'tuition', label: tabStrings.tuition },
      { key: 'requests', label: tabStrings.requests },
      { key: 'payments', label: tabStrings.payments },
    ],
    [tabStrings.payments, tabStrings.requests, tabStrings.tuition],
  );

  const isTuitionTab = activeTab === 'tuition';

  const columnLabels = tableStrings.columns;
  const displayedColumns = useMemo(
    () => [
      { key: 'student', label: columnLabels.student, sortable: true, orderKey: 'student' },
      { key: 'class', label: columnLabels.class, sortable: true, orderKey: 'class' },
      { key: 'generation', label: columnLabels.generation, sortable: false },
      { key: 'scholar_level_name', label: columnLabels.scholarLevel, sortable: false },
    ],
    [columnLabels.class, columnLabels.generation, columnLabels.scholarLevel, columnLabels.student],
  );

  const monthColumns = useMemo(() => {
    const columns = [];

    for (const row of rows) {
      if (!row || typeof row !== 'object') {
        continue;
      }

      for (const key of Object.keys(row)) {
        if (!MONTH_KEY_REGEX.test(key)) {
          continue;
        }

        if (!columns.includes(key)) {
          columns.push(key);
        }
      }
    }

    return columns;
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(totalElements / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  const appliedFilters = useMemo(() => {
    const params = new URLSearchParams();

    params.set('lang', normalizedLanguage);
    params.set('offset', String(offset));
    params.set('limit', String(limit));
    params.set('export_all', 'false');

    if (startMonth) {
      params.set('start_date', `${startMonth}-01`);
    }

    if (endMonth) {
      params.set('end_date', `${endMonth}-30`);
    }

    if (showDebtOnly) {
      params.set('show_debt_only', 'true');
    }

    if (orderBy) {
      params.set('order_by', orderBy);
      params.set('order_dir', orderDir === 'DESC' ? 'DESC' : 'ASC');
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) {
        continue;
      }

      const trimmed = typeof value === 'string' ? value.trim() : value;

      if (trimmed === '' || trimmed === false) {
        continue;
      }

      params.set(key, String(trimmed));
    }

    return params;
  }, [
    filters,
    offset,
    limit,
    orderBy,
    orderDir,
    startMonth,
    endMonth,
    showDebtOnly,
    normalizedLanguage,
  ]);

  const fetchPayments = useCallback(async () => {
    if (activeTab !== 'tuition') {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/reports/payments/report?${appliedFilters.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(tableStrings.error);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];
      setRows(content);
      setTotalElements(Number(payload?.totalElements) || content.length || 0);
    } catch (requestError) {
      console.error('Payments fetch error', requestError);
      const fallbackMessage =
        requestError instanceof Error && requestError.message
          ? requestError.message
          : tableStrings.unknownError;
      setError(fallbackMessage);
    } finally {
      setLoading(false);
    }
  }, [activeTab, appliedFilters, tableStrings.error, tableStrings.unknownError, token]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const fetchSchools = useCallback(async () => {
    setIsLoadingSchools(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/schools/list?lang=${normalizedLanguage}&status_filter=-1`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        throw new Error(errorStrings.loadSchools);
      }

      const payload = await response.json();
      const list = extractListFromPayload(payload);
      const options = list.map((item, index) => normalizeSelectOption(item, index));
      setSchoolOptions(options);
    } catch (schoolError) {
      console.error('Schools fetch error', schoolError);
      setToast({ type: 'error', message: toastStrings.loadSchoolsError });
      setSchoolOptions([]);
    } finally {
      setIsLoadingSchools(false);
    }
  }, [errorStrings.loadSchools, normalizedLanguage, toastStrings.loadSchoolsError, token]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setOffset(0);
  }, []);

  const handleStartMonthChange = useCallback((value) => {
    setStartMonth(value);
    setOffset(0);
  }, []);

  const handleEndMonthChange = useCallback((value) => {
    setEndMonth(value);
    setOffset(0);
  }, []);

  const handleToggleDebt = useCallback(() => {
    setShowDebtOnly((previous) => !previous);
    setOffset(0);
  }, []);

  const handleToggleFilters = useCallback(() => {
    setShowFilters((previous) => !previous);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      group_status: '',
      user_status: '',
      student_full_name: '',
      payment_reference: '',
      generation: '',
      grade_group: '',
      scholar_level: '',
      school_id: '',
    });
    setShowDebtOnly(false);
    setStartMonth('');
    setEndMonth('');
    setOrderBy('');
    setOrderDir('ASC');
    setOffset(0);
  }, []);

  const handleFiltersBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget || event.target.classList.contains('payments-filters__backdrop')) {
      setShowFilters(false);
    }
  }, []);

  const handleSort = useCallback(
    (orderKey) => {
      if (!orderKey) {
        return;
      }

      const isSameColumn = orderBy === orderKey;

      setOrderDir((previousDir) => {
        if (isSameColumn) {
          return previousDir === 'ASC' ? 'DESC' : 'ASC';
        }

        return 'ASC';
      });

      setOrderBy((previousOrderKey) => (previousOrderKey === orderKey ? previousOrderKey : orderKey));
      setOffset(0);
    },
    [orderBy],
  );

  const handleStudentDetailClick = useCallback(
    (row) => {
      const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;

      if (!studentId) {
        return;
      }

      const fullName = row?.student ?? '';
      const registerId = row?.payment_reference ?? row?.register_id ?? row?.registration_id ?? '';

      onStudentDetail?.({ id: studentId, name: fullName, registerId });
    },
    [onStudentDetail],
  );

  const handlePageChange = useCallback(
    (nextPage) => {
      const safePage = Math.min(Math.max(nextPage, 1), totalPages);
      setOffset((safePage - 1) * limit);
    },
    [limit, totalPages],
  );

  const buildCsvRow = useCallback(
    (row, headerKeys) =>
      headerKeys
        .map((key) => {
          if (key === 'student_combined') {
            const studentName = row?.student ?? '';
            const paymentReference = row?.payment_reference ?? '';
            const combined = paymentReference
              ? `${studentName} (${csvStrings.studentIdLabel}: ${paymentReference})`
              : studentName;
            return `"${String(combined ?? '').replace(/"/g, '""')}"`;
          }

          const value = row?.[key] ?? '';
          const normalized =
            value === null || value === undefined || value === '' ? '' : String(value);
          return `"${normalized.replace(/"/g, '""')}"`;
        })
        .join(','),
    [csvStrings.studentIdLabel],
  );

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams(appliedFilters.toString());
      params.set('offset', '0');
      params.set('export_all', 'true');

      const url = `${API_BASE_URL}/reports/payments/report?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(errorStrings.export);
      }

      const payload = await response.json();
      const content = Array.isArray(payload?.content) ? payload.content : [];

      if (content.length === 0) {
        setToast({ type: 'warning', message: toastStrings.exportEmpty });
        return;
      }

      const monthKeys = [];
      for (const row of content) {
        if (!row || typeof row !== 'object') {
          continue;
        }

        for (const key of Object.keys(row)) {
          if (MONTH_KEY_REGEX.test(key) && !monthKeys.includes(key)) {
            monthKeys.push(key);
          }
        }
      }

      const headerKeys = ['student_combined', 'class', 'generation', 'scholar_level_name', ...monthKeys];
      const headerLabels = [
        csvStrings.headers.student,
        csvStrings.headers.class,
        csvStrings.headers.generation,
        csvStrings.headers.scholarLevel,
        ...monthKeys,
      ];

      const csvRows = [
        headerLabels.map((label) => `"${label.replace(/"/g, '""')}"`).join(','),
        ...content.map((row) => buildCsvRow(row, headerKeys)),
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${csvStrings.fileNamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setToast({ type: 'success', message: toastStrings.exportSuccess });
    } catch (exportError) {
      console.error('Export error', exportError);
      const errorMessage =
        exportError instanceof Error && exportError.message
          ? exportError.message
          : toastStrings.exportError;
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsExporting(false);
    }
  }, [
    appliedFilters,
    buildCsvRow,
    csvStrings,
    errorStrings.export,
    toastStrings.exportEmpty,
    toastStrings.exportError,
    toastStrings.exportSuccess,
    token,
  ]);

  useEffect(() => {
    if (!isTuitionTab && showFilters) {
      setShowFilters(false);
    }
  }, [isTuitionTab, showFilters]);

  const renderSortIndicator = (orderKey) => {
    const isActive = orderBy === orderKey;
    const direction = isActive ? orderDir : null;
    const upColor = isActive && direction !== 'DESC' ? '#4338ca' : '#c7d2fe';
    const downColor = isActive && direction === 'DESC' ? '#4338ca' : '#c7d2fe';

    return (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M6 2l3 4H3l3-4Z" fill={upColor} />
        <path d="M6 10l3-4H3l3 4Z" fill={downColor} />
      </svg>
    );
  };

  const DebtIcon = (
    <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
      <path d="M4 5h12v2H4zm0 4h8v2H4zm0 4h5v2H4z" fill="currentColor" />
    </svg>
  );

  const renderTable = () => {
    if (loading) {
      return <div className="payments-page__empty-state">{tableStrings.loading}</div>;
    }

    if (error) {
      return <div className="payments-page__empty-state">{error || tableStrings.error}</div>;
    }

    if (!rows.length) {
      return <div className="payments-page__empty-state">{tableStrings.empty}</div>;
    }

    const studentIdLabel = tableStrings.studentIdLabel;
    const startRecord = totalElements === 0 ? 0 : offset + 1;
    const endRecord = totalElements === 0 ? 0 : Math.min(offset + limit, totalElements);
    const summaryText = tableStrings.pagination.summary
      .replace('{start}', startRecord.toLocaleString(locale))
      .replace('{end}', endRecord.toLocaleString(locale))
      .replace('{total}', totalElements.toLocaleString(locale));
    const pageText = tableStrings.pagination.page
      .replace('{current}', currentPage.toLocaleString(locale))
      .replace('{total}', totalPages.toLocaleString(locale));

    return (
      <UiCard className="payments-page__table-card">
        <TableContainer className="payments-page__table-wrapper">
          <Table className="payments-page__table">
            <thead>
              <tr>
                {displayedColumns.map((column) => (
                  <th key={column.key}>
                    {column.sortable ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="payments-page__sortable"
                        onClick={() => handleSort(column.orderKey)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleSort(column.orderKey);
                          }
                        }}
                      >
                        {column.label}
                        {renderSortIndicator(column.orderKey)}
                      </span>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
                {monthColumns.map((month) => (
                  <th key={month}>
                    <span
                      role="button"
                      tabIndex={0}
                      className="payments-page__sortable"
                      onClick={() => handleSort(month)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSort(month);
                        }
                      }}
                    >
                      {month}
                      {renderSortIndicator(month)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;
                const rowKey = studentId ?? row?.payment_reference ?? `${row?.student ?? 'row'}-${index}`;
                const canNavigateToStudent = Boolean(studentId);

                return (
                  <tr key={rowKey}>
                    <td>
                      <ActionButton
                        variant="text"
                        onClick={() => handleStudentDetailClick(row)}
                        disabled={!canNavigateToStudent}
                        className="payments-page__student-button"
                      >
                        {row.student ?? tableStrings.studentFallback}
                      </ActionButton>
                      {row.payment_reference ? (
                        <span className="payments-page__student-id">
                          {`${studentIdLabel}: ${row.payment_reference}`}
                        </span>
                      ) : null}
                    </td>
                    <td>{row.class ?? '--'}</td>
                    <td>{row.generation ?? '--'}</td>
                    <td>{row.scholar_level_name ?? '--'}</td>
                    {monthColumns.map((month) => {
                      const value = row?.[month];
                      const isNullish = value === null || value === undefined;
                      return (
                        <td key={`${rowKey}-${month}`} className={isNullish ? 'payments-page__amount-null' : ''}>
                          {isNullish || value === '' ? (
                            <span className="ui-table__empty-indicator">--</span>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableContainer>
        <div className="payments-page__pagination">
          <div>{summaryText}</div>
          <div className="payments-page__pagination-controls">
            <ActionButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              {tableStrings.pagination.previous}
            </ActionButton>
            <span>
              {pageText}
            </span>
            <ActionButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              {tableStrings.pagination.next}
            </ActionButton>
          </div>
        </div>
      </UiCard>
    );
  };

  const pageTitle = title || tabStrings.tuition;

  return (
    <div className="payments-page">
      <GlobalToast alert={toast} onClose={() => setToast(null)} />

      <div className="payments-page__header">
        <div className="payments-page__title-block">
          <h1 className="payments-page__title">{pageTitle}</h1>
          {description ? <p className="payments-page__description">{description}</p> : null}
        </div>
        <div className="payments-page__navigation">
          <div className="payments-page__tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`payments-page__tab ${activeTab === tab.key ? 'payments-page__tab--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {isTuitionTab ? (
            <div className="payments-page__actions">
              <FilterButton
                onClick={handleToggleFilters}
                aria-expanded={showFilters}
                aria-controls="payments-page-filters"
              >
                {actionStrings.filter}
              </FilterButton>
              <ActionButton
                variant="ghost"
                onClick={handleToggleDebt}
                icon={DebtIcon}
                className={`payments-page__debt-button ${showDebtOnly ? 'is-active' : ''}`}
              >
                {showDebtOnly ? debtToggleStrings.debtActive : debtToggleStrings.debtInactive}
              </ActionButton>
              <AddRecordButton type="button">
                {actionStrings.add}
              </AddRecordButton>
              <ExportButton type="button" onClick={handleExport} disabled={isExporting}>
                {isExporting ? actionStrings.exporting : actionStrings.export}
              </ExportButton>
            </div>
          ) : null}
        </div>
      </div>

      {isTuitionTab ? (
        <UiCard className="card-view">
          <div className="payments-page__toolbar">
            <div className="payments-page__search-wrapper">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="m14.5 13.1 3.4 3.4-1.4 1.4-3.4-3.4a7 7 0 1 1 1.4-1.4ZM8.5 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
                  fill="currentColor"
                />
              </svg>
              <input
                type="search"
                className="payments-page__search"
                placeholder={searchPlaceholder}
                value={filters.student_full_name}
                onChange={(event) => handleFilterChange('student_full_name', event.target.value)}
              />
            </div>
            <div className="payments-page__toolbar-controls">
              <label className="payments-page__month-input">
                {dateRangeStrings.start}
                <input
                  type="month"
                  value={startMonth}
                  onChange={(event) => handleStartMonthChange(event.target.value)}
                  max={endMonth || undefined}
                />
              </label>
              <label className="payments-page__month-input">
                {dateRangeStrings.end}
                <input
                  type="month"
                  value={endMonth}
                  onChange={(event) => handleEndMonthChange(event.target.value)}
                  min={startMonth || undefined}
                />
              </label>
            </div>
          </div>
        </UiCard>
      ) : null}

      <div className="payments-page__layout">
        <section className="payments-page__content">
          {isTuitionTab ? (
            renderTable()
          ) : (
            <div className="payments-page__empty-state">
              {placeholderMessage}
            </div>
          )}
        </section>
      </div>

      {showFilters && (
        <div
          className="payments-filters is-open"
          data-dismiss="payments-filters"
          onClick={handleFiltersBackdropClick}
        >
          <div className="payments-filters__backdrop" aria-hidden="true" />
          <aside
            id="payments-page-filters"
            className="payments-page__filters"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payments-page-filters-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="payments-page__filters-header">
              <div className="payments-page__filters-heading">
                <h2 id="payments-page-filters-title" className="payments-page__filters-title">
                  {filterStrings.title}
                </h2>
                <ActionButton
                  type="button"
                  variant="text"
                  onClick={handleResetFilters}
                  className="payments-page__filters-reset"
                >
                  {filterStrings.reset}
                </ActionButton>
              </div>
              <ActionButton
                type="button"
                variant="ghost"
                size="icon"
                className="payments-page__filters-close"
                onClick={() => setShowFilters(false)}
                aria-label={filterStrings.closeAria}
                icon={<span aria-hidden="true">×</span>}
              />
            </header>
            <div className="payments-page__filters-form">
              <div className="payments-page__field">
                <label htmlFor="filter-student" className="payments-page__label">
                  {filterStrings.fields.student.label}
                </label>
                <input
                  id="filter-student"
                  type="text"
                  className="payments-page__input"
                  value={filters.student_full_name}
                  onChange={(event) => handleFilterChange('student_full_name', event.target.value)}
                  placeholder={filterStrings.fields.student.placeholder}
                />
              </div>
              <div className="payments-page__field">
                <label htmlFor="filter-reference" className="payments-page__label">
                  {filterStrings.fields.reference.label}
                </label>
                <input
                  id="filter-reference"
                  type="text"
                  className="payments-page__input"
                  value={filters.payment_reference}
                  onChange={(event) => handleFilterChange('payment_reference', event.target.value)}
                  placeholder={filterStrings.fields.reference.placeholder}
                />
              </div>
              <div className="payments-page__field">
                <label htmlFor="filter-generation" className="payments-page__label">
                  {filterStrings.fields.generation.label}
                </label>
                <input
                  id="filter-generation"
                  type="text"
                  className="payments-page__input"
                  value={filters.generation}
                  onChange={(event) => handleFilterChange('generation', event.target.value)}
                  placeholder={filterStrings.fields.generation.placeholder}
                />
              </div>
              <div className="payments-page__field">
                <label htmlFor="filter-grade" className="payments-page__label">
                  {filterStrings.fields.gradeGroup.label}
                </label>
                <input
                  id="filter-grade"
                  type="text"
                  className="payments-page__input"
                  value={filters.grade_group}
                  onChange={(event) => handleFilterChange('grade_group', event.target.value)}
                  placeholder={filterStrings.fields.gradeGroup.placeholder}
                />
              </div>
              <div className="payments-page__field">
                <label htmlFor="filter-scholar" className="payments-page__label">
                  {filterStrings.fields.scholarLevel.label}
                </label>
                <input
                  id="filter-scholar"
                  type="text"
                  className="payments-page__input"
                  value={filters.scholar_level}
                  onChange={(event) => handleFilterChange('scholar_level', event.target.value)}
                  placeholder={filterStrings.fields.scholarLevel.placeholder}
                />
              </div>
              <div className="payments-page__field">
                <label htmlFor="filter-school" className="payments-page__label">
                  {filterStrings.fields.school.label}
                </label>
                <select
                  id="filter-school"
                  className="payments-page__select"
                  value={filters.school_id}
                  onChange={(event) => handleFilterChange('school_id', event.target.value)}
                  disabled={isLoadingSchools}
                >
                  <option value="">{filterStrings.schoolOptions.all}</option>
                  {schoolOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="payments-page__checkbox">
                <input
                  type="checkbox"
                  checked={filters.group_status === 'true'}
                  onChange={(event) => handleFilterChange('group_status', event.target.checked ? 'true' : '')}
                />
                {filterStrings.toggles.activeGroups}
              </label>
              <label className="payments-page__checkbox">
                <input
                  type="checkbox"
                  checked={filters.user_status === 'true'}
                  onChange={(event) => handleFilterChange('user_status', event.target.checked ? 'true' : '')}
                />
                {filterStrings.toggles.activeStudents}
              </label>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default PaymentsFinancePage;
