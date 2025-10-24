import { useCallback, useEffect, useMemo, useState } from 'react';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import AddRecordButton from '../components/ui/buttons/AddRecordButton.jsx';
import ExportButton from '../components/ui/buttons/ExportButton.jsx';
import FilterButton from '../components/ui/buttons/FilterButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import GlobalTable from '../components/ui/GlobalTable.jsx';
import SidebarModal from '../components/ui/SidebarModal.jsx';
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

  const renderSortIndicator = useCallback(
    (orderKey) => {
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
    },
    [orderBy, orderDir],
  );

  const paymentColumns = useMemo(() => {
    const sortableHeader = (label, key) => (
      <button
        type="button"
        className="payments-page__sortable"
        onClick={() => handleSort(key)}
      >
        <span>{label}</span>
        {renderSortIndicator(key)}
      </button>
    );

    const baseColumns = displayedColumns.map((column) => ({
      key: column.key,
      header: column.sortable ? sortableHeader(column.label, column.orderKey) : column.label,
    }));

    const dynamicMonths = monthColumns.map((month) => ({
      key: month,
      header: sortableHeader(month, month),
    }));

    return [...baseColumns, ...dynamicMonths];
  }, [displayedColumns, handleSort, monthColumns, renderSortIndicator]);

  const paymentSummary = useCallback(
    ({ from, to, total }) => {
      const template = tableStrings.pagination?.summary;
      const startLabel = from.toLocaleString(locale);
      const endLabel = to.toLocaleString(locale);
      const totalLabel = total.toLocaleString(locale);

      if (typeof template === 'string') {
        return template
          .replace('{start}', startLabel)
          .replace('{end}', endLabel)
          .replace('{total}', totalLabel);
      }

      return `Mostrando ${startLabel}-${endLabel} de ${totalLabel}`;
    },
    [locale, tableStrings.pagination],
  );

  const paymentPageLabel = useCallback(
    ({ page, totalPages }) => {
      const template = tableStrings.pagination?.page;
      const currentLabel = page.toLocaleString(locale);
      const totalLabel = totalPages.toLocaleString(locale);

      if (typeof template === 'string') {
        return template
          .replace('{current}', currentLabel)
          .replace('{total}', totalLabel);
      }

      return `${currentLabel} / ${totalLabel}`;
    },
    [locale, tableStrings.pagination],
  );

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

  const DebtIcon = (
    <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
      <path d="M4 5h12v2H4zm0 4h8v2H4zm0 4h5v2H4z" fill="currentColor" />
    </svg>
  );


  return (
    <div className="payments-page">
      <GlobalToast alert={toast} onClose={() => setToast(null)} />

      <div className="payments-page__header">
        <div className="payments-page__title-block">
          {description ? <p className="payments-page__description">{description}</p> : null}
        </div>
        <div className="payments-page__navigation">
          <Tabs
            tabs={tabs}
            activeKey={activeTab}
            onSelect={setActiveTab}
            className="payments-page__tabs-container"
            navClassName="payments-page__tabs"
            actionsClassName="payments-page__actions"
            renderActions={({ activeKey }) =>
              activeKey === 'tuition' ? (
                <>
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
                </>
              ) : null
            }
          />
        </div>
      </div>

      {isTuitionTab ? (
        <UiCard className="card-view">
          <div className="payments-page__toolbar">
            <SearchInput
              value={filters.student_full_name}
              onChange={(event) => handleFilterChange('student_full_name', event.target.value)}
              placeholder={searchPlaceholder}
              className="payments-page__search-wrapper"
              wrapperProps={{ role: 'search' }}
            />
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
            <UiCard className="payments-page__table-card">
              <GlobalTable
                className="payments-page__table-wrapper"
                tableClassName="payments-page__table mb-0"
                columns={paymentColumns}
                data={rows}
                getRowId={(row, index) => {
                  const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;
                  return studentId ?? row?.payment_reference ?? `${row?.student ?? 'row'}-${index}`;
                }}
                renderRow={(row, index) => {
                  const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;
                  const rowKey = studentId ?? row?.payment_reference ?? `${row?.student ?? 'row'}-${index}`;
                  const canNavigateToStudent = Boolean(studentId);
                  const studentIdLabel = tableStrings.studentIdLabel;

                  return (
                    <tr key={rowKey}>
                      <td
                        data-title={tableStrings.columns.student}
                        className="payments-page__student-cell"
                      >
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
                      <td data-title={tableStrings.columns.class}>{row.class ?? '--'}</td>
                      <td data-title={tableStrings.columns.generation}>{row.generation ?? '--'}</td>
                      <td data-title={tableStrings.columns.scholarLevel}>{row.scholar_level_name ?? '--'}</td>
                      {monthColumns.map((month) => {
                        const value = row?.[month];
                        const isNullish = value === null || value === undefined || value === '';
                        return (
                          <td
                            key={`${rowKey}-${month}`}
                            data-title={month}
                            className={isNullish ? 'payments-page__amount-null' : ''}
                          >
                            {isNullish ? <span className="ui-table__empty-indicator">--</span> : value}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }}
                loading={loading}
                loadingMessage={tableStrings.loading}
                error={error || null}
                emptyMessage={tableStrings.empty}
                pagination={{
                  currentPage,
                  pageSize: limit,
                  totalItems: totalElements,
                  onPageChange: handlePageChange,
                  previousLabel: tableStrings.pagination.previous ?? '←',
                  nextLabel: tableStrings.pagination.next ?? '→',
                  summary: paymentSummary,
                  pageLabel: paymentPageLabel,
                }}
              />
            </UiCard>
          ) : (
            <div className="payments-page__empty-state">
              {placeholderMessage}
            </div>
          )}
        </section>
      </div>

      <SidebarModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title={filterStrings.title}
        description={filterStrings.subtitle}
        id="payments-page-filters"
        resetAction={{ label: filterStrings.reset, onClick: handleResetFilters }}
        bodyClassName="payments-page__filters-body"
      >
        <form className="payments-page__filters-form">
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
        </form>
      </SidebarModal>
    </div>
  );
};

export default PaymentsFinancePage;
