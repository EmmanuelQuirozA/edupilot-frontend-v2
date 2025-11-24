import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { handleExpiredToken } from '../utils/auth';
import ActionButton from '../components/ui/ActionButton.jsx';
import GlobalTable from '../components/ui/GlobalTable.jsx';
import './StudentDetailPage.css';

const REQUIRED_FIELDS = ['first_name', 'last_name_father', 'last_name_mother', 'school_id', 'group_id', 'register_id', 'email'];

const MONTH_KEY_REGEX = /^[A-Za-z]{3}-\d{2}$/;

const parseTuitionCellValue = (value) => {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (parseError) {
      console.warn('Unable to parse tuition cell value', parseError);
      return null;
    }
  }

  return null;
};

const normalizeAmount = (candidate) => {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();

    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const extractTuitionCellDetails = (value) => {
  const parsed = parseTuitionCellValue(value);
  if (!parsed) {
    return null;
  }

  const totalAmount = normalizeAmount(parsed.total_amount ?? parsed.totalAmount);
  const paymentMonth =
    typeof parsed.payment_month === 'string'
      ? parsed.payment_month
      : typeof parsed.paymentMonth === 'string'
      ? parsed.paymentMonth
      : null;
  const paymentRequestId = parsed.payment_request_id ?? parsed.paymentRequestId ?? null;
  const payments = Array.isArray(parsed.payments) ? parsed.payments : [];

  return {
    totalAmount,
    paymentMonth,
    paymentRequestId,
    payments,
  };
};

const extractStudentDetail = (payload) => {
  const candidates = [
    Array.isArray(payload) ? payload[0] : null,
    Array.isArray(payload?.data) ? payload.data[0] : payload?.data,
    Array.isArray(payload?.result) ? payload.result[0] : payload?.result,
    Array.isArray(payload?.student) ? payload.student[0] : payload?.student,
    Array.isArray(payload?.details) ? payload.details[0] : payload?.details,
    Array.isArray(payload?.response) ? payload.response[0] : payload?.response,
    payload,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate)) ?? null;
};

const buildFormStateFromStudent = (detail) => ({
  school_id: detail?.school_id ?? '',
  group_id: detail?.group_id ?? '',
  register_id: detail?.register_id ?? detail?.registration_id ?? '',
  payment_reference: detail?.payment_reference ?? '',
  first_name: detail?.first_name ?? '',
  last_name_father: detail?.last_name_father ?? '',
  last_name_mother: detail?.last_name_mother ?? '',
  birth_date: detail?.birth_date ? String(detail.birth_date).slice(0, 10) : '',
  phone_number: detail?.phone_number ?? '',
  tax_id: detail?.tax_id ?? '',
  curp: detail?.curp ?? '',
  street: detail?.street ?? '',
  ext_number: detail?.ext_number ?? '',
  int_number: detail?.int_number ?? '',
  suburb: detail?.suburb ?? '',
  locality: detail?.locality ?? '',
  municipality: detail?.municipality ?? '',
  state: detail?.state ?? '',
  personal_email: detail?.personal_email ?? '',
  email: detail?.email ?? '',
});

const TABLE_LIMIT = 10;

const buildAddressString = (source, emptyValue = '—') => {
  if (!source) {
    return emptyValue;
  }

  const parts = [
    [source.street, [source.ext_number, source.int_number].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' '),
    source.suburb,
    source.locality,
    source.municipality,
    source.state,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : emptyValue;
};

const formatDateValue = (value, locale = 'es') => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
};

const StudentDetailPage = ({
  studentId,
  language = 'es',
  strings = {},
  onBreadcrumbChange,
}) => {
  const { token, logout } = useAuth();
  const [status, setStatus] = useState('idle');
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [formValues, setFormValues] = useState(buildFormStateFromStudent(null));
  const [formErrors, setFormErrors] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('tuition');
  const [tuitionRows, setTuitionRows] = useState([]);
  const [paymentsRows, setPaymentsRows] = useState([]);
  const [requestsRows, setRequestsRows] = useState([]);
  const [topupsRows, setTopupsRows] = useState([]);
  const [tuitionStatus, setTuitionStatus] = useState('idle');
  const [paymentsStatus, setPaymentsStatus] = useState('idle');
  const [requestsStatus, setRequestsStatus] = useState('idle');
  const [topupsStatus, setTopupsStatus] = useState('idle');
  const [tuitionError, setTuitionError] = useState('');
  const [paymentsError, setPaymentsError] = useState('');
  const [requestsError, setRequestsError] = useState('');
  const [topupsError, setTopupsError] = useState('');
  const [tuitionFetched, setTuitionFetched] = useState(false);
  const [paymentsFetched, setPaymentsFetched] = useState(false);
  const [requestsFetched, setRequestsFetched] = useState(false);
  const [topupsFetched, setTopupsFetched] = useState(false);
  const [tuitionSort, setTuitionSort] = useState({});
  const [paymentsSort, setPaymentsSort] = useState({});
  const [requestsSort, setRequestsSort] = useState({});
  const [topupsSort, setTopupsSort] = useState({});
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    [language],
  );
  const isLoading = status === 'loading';

  const {
    loading: loadingLabel = 'Cargando información...',
    error: errorLabel = 'No fue posible cargar la información del alumno.',
    placeholderDescription = 'Muy pronto podrás consultar la información completa del alumno aquí.',
    registerLabel = 'Matrícula',
    saveSuccess = 'Información actualizada correctamente.',
    saveError = 'No se pudieron guardar los cambios.',
    saveButton = 'Guardar cambios',
    editButton = 'Editar información',
    cancelEdit = 'Cancelar',
    resetPassword = 'Restablecer contraseña',
    tabs = {
      tuition: 'Colegíaturas',
      requests: 'Solicitudes de pagos',
      payments: 'Pagos',
      topups: 'Recargas',
    },
    header: headerStrings = {},
    summaryCard = {},
    institutionCard = {},
    contactCard = {},
    validation = {},
  } = strings ?? {};

  const {
    activeInGroup = 'Activo en Grupo',
    roleFallback = 'Rol',
    groupStatusFallback = 'Estado grupo',
    roleStatusFallback = 'Estado rol',
  } = headerStrings || {};

  const summaryStrings = {
    title: summaryCard.title ?? 'Cuenta del alumno',
    paymentReference: summaryCard.paymentReference ?? 'Referencia de pago',
    balanceLabel: summaryCard.balanceLabel ?? 'Saldo actual',
    lastPayment: summaryCard.lastPayment ?? 'Último pago registrado',
    creditsLabel: summaryCard.creditsLabel ?? 'Creditos de referencia',
    groupIdLabel: summaryCard.groupIdLabel ?? 'ID Grupo',
    balance: summaryCard.balance ?? 'Añadir saldo',
    registerPlaceholder: summaryCard.registerPlaceholder ?? 'Ej. 5003',
    paymentReferencePlaceholder: summaryCard.paymentReferencePlaceholder ?? 'Ingresa referencia',
  };

  const institutionStrings = {
    label: institutionCard.label ?? 'Institución',
    meta: institutionCard.meta ?? 'Agrega o actualiza la información escolar.',
    schoolStatus: institutionCard.schoolStatus ?? 'Estatus escolar',
    groupStatus: institutionCard.groupStatus ?? 'Estatus del grupo',
    generationLabel: institutionCard.generationLabel ?? 'Generación',
    fields: {
      schoolId: institutionCard.fields?.schoolId ?? 'Escuela (ID)',
      scholarLevel: institutionCard.fields?.scholarLevel ?? 'Nivel escolar',
      groupId: institutionCard.fields?.groupId ?? 'Grupo (ID)',
      gradeGroup: institutionCard.fields?.gradeGroup ?? 'Grado y grupo',
      generation: institutionCard.fields?.generation ?? 'Generación',
      curp: institutionCard.fields?.curp ?? 'CURP',
    },
  };

  const contactStrings = {
    label: contactCard.label ?? 'Información de contacto',
    subtitle: contactCard.subtitle ?? 'Datos personales y de contacto del alumno.',
    meta: contactCard.meta ?? 'Revisa los datos principales del alumno.',
    roleChip: contactCard.roleChip ?? '',
    roleStatusChip: contactCard.roleStatusChip ?? '',
    emptyValue: contactCard.emptyValue ?? '—',
    summaryTitle: contactCard.summaryTitle ?? 'Datos principales',
    summary: {
      phone: contactCard.summary?.phone ?? 'Teléfono',
      birthDate: contactCard.summary?.birthDate ?? 'Fecha de nacimiento',
      taxId: contactCard.summary?.taxId ?? 'RFC',
      institutionalEmail: contactCard.summary?.institutionalEmail ?? 'Correo institucional',
      personalEmail: contactCard.summary?.personalEmail ?? 'Correo personal',
      address: contactCard.summary?.address ?? 'Dirección',
    },
    addressHelper: contactCard.addressHelper ?? 'Agrega la dirección actual del alumno.',
    fields: {
      firstName: contactCard.fields?.firstName ?? 'Nombre',
      lastNameFather: contactCard.fields?.lastNameFather ?? 'Apellido paterno',
      lastNameMother: contactCard.fields?.lastNameMother ?? 'Apellido materno',
      birthDate: contactCard.fields?.birthDate ?? 'Fecha de nacimiento',
      phoneNumber: contactCard.fields?.phoneNumber ?? 'Teléfono',
      taxId: contactCard.fields?.taxId ?? 'RFC',
      email: contactCard.fields?.email ?? 'Correo institucional',
      personalEmail: contactCard.fields?.personalEmail ?? 'Correo personal',
      street: contactCard.fields?.street ?? 'Calle',
      extNumber: contactCard.fields?.extNumber ?? 'No. Exterior',
      intNumber: contactCard.fields?.intNumber ?? 'No. Interior',
      suburb: contactCard.fields?.suburb ?? 'Colonia',
      locality: contactCard.fields?.locality ?? 'Localidad',
      municipality: contactCard.fields?.municipality ?? 'Municipio',
      state: contactCard.fields?.state ?? 'Estado',
    },
  };

  const validationStrings = {
    required: validation.required ?? 'Campo obligatorio',
    invalidEmail: validation.invalidEmail ?? 'Correo inválido',
    invalidPersonalEmail: validation.invalidPersonalEmail ?? 'Correo inválido',
  };

  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      setStatus('idle');
      setError('');
      setTuitionRows([]);
      setPaymentsRows([]);
      setRequestsRows([]);
      setTopupsRows([]);
      setTuitionFetched(false);
      setPaymentsFetched(false);
      setRequestsFetched(false);
      setTopupsFetched(false);
      setTuitionStatus('idle');
      setPaymentsStatus('idle');
      setRequestsStatus('idle');
      setTopupsStatus('idle');
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadStudent = async () => {
      try {
        setStatus('loading');
        setError('');

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
          handleExpiredToken(response, logout);
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
        setFormValues(buildFormStateFromStudent(detail));
        setStatus('success');

        const displayName = [
          detail.full_name,
          [detail.first_name, detail.last_name_father, detail.last_name_mother]
            .filter(Boolean)
            .join(' '),
        ]
          .find((name) => typeof name === 'string' && name.trim().length > 0);

        onBreadcrumbChange?.(displayName?.trim());
      } catch (requestError) {
        if (isCancelled || requestError.name === 'AbortError') {
          return;
        }

        console.error('Failed to load student detail', requestError);
        setStudent(null);
        setStatus('error');
        setError(errorLabel);
      }
    };

    loadStudent();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [errorLabel, language, logout, onBreadcrumbChange, studentId, token]);

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

  const stateMessage =
    status === 'loading' ? loadingLabel : status === 'error' ? error || errorLabel : '';

  const hasActiveAccess = Boolean(
    student?.school_enabled && student?.role_enabled && student?.group_enabled,
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};

    REQUIRED_FIELDS.forEach((field) => {
      if (!String(formValues[field] ?? '').trim()) {
        nextErrors[field] = validationStrings.required;
      }
    });

    if (formValues.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email)) {
      nextErrors.email = validationStrings.invalidEmail;
    }

    if (formValues.personal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.personal_email)) {
      nextErrors.personal_email = validationStrings.invalidPersonalEmail;
    }

    setFormErrors(nextErrors);
    return nextErrors;
  };

  const handleStartEdit = () => {
    if (!student) {
      return;
    }
    setFormValues(buildFormStateFromStudent(student));
    setFeedbackMessage('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormErrors({});
    setFeedbackMessage('');
    setFormValues(buildFormStateFromStudent(student));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!student) {
      return;
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFeedbackMessage(saveError);
      return;
    }

    const targetId = student?.user_id || studentId;
    if (!targetId) {
      setFeedbackMessage(saveError);
      return;
    }

    const sanitizedPayload = Object.fromEntries(
      Object.entries(formValues).map(([key, value]) => {
        if (typeof value === 'string') {
          const trimmedValue = value.trim();
          return [key, trimmedValue === '' ? null : trimmedValue];
        }
        return [key, value];
      }),
    );

    try {
      setSaveStatus('saving');
      setFeedbackMessage('');

      const response = await fetch(
        `${API_BASE_URL}/students/update/${encodeURIComponent(targetId)}?lang=${language ?? 'es'}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(sanitizedPayload),
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
      }

      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        setFeedbackMessage(payload?.message || saveError);
        setSaveStatus('idle');
        return;
      }

      const updatedFullName =
        [formValues.first_name, formValues.last_name_father, formValues.last_name_mother]
          .filter(Boolean)
          .join(' ') || student.full_name;

      const updatedStudent = {
        ...student,
        ...sanitizedPayload,
        full_name: updatedFullName,
      };

      setStudent(updatedStudent);
      setIsEditing(false);
      setFeedbackMessage(payload?.message || saveSuccess);
    } catch (requestError) {
      console.error('Failed to update student', requestError);
      setFeedbackMessage(saveError);
    } finally {
      setSaveStatus('idle');
    }
  };

  const formatCurrency = (value) => {
    const normalized = Number.isFinite(value) ? value : Number(value) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(normalized);
  };

  const getSortState = (key) =>
    ({
      tuition: tuitionSort,
      payments: paymentsSort,
      requests: requestsSort,
      topups: topupsSort,
    }[key] ?? { orderBy: '', orderDir: 'desc' });

  const tabConfig = useMemo(
    () => ({
      tuition: {
        endpoint: 'reports/payments/report',
        setRows: setTuitionRows,
        setStatus: setTuitionStatus,
        setError: setTuitionError,
        setFetched: setTuitionFetched,
        sort: tuitionSort,
      },
      payments: {
        endpoint: 'reports/payments',
        setRows: setPaymentsRows,
        setStatus: setPaymentsStatus,
        setError: setPaymentsError,
        setFetched: setPaymentsFetched,
        sort: paymentsSort,
      },
      requests: {
        endpoint: 'reports/paymentrequests',
        setRows: setRequestsRows,
        setStatus: setRequestsStatus,
        setError: setRequestsError,
        setFetched: setRequestsFetched,
        sort: requestsSort,
      },
      topups: {
        endpoint: 'reports/balance-recharges',
        setRows: setTopupsRows,
        setStatus: setTopupsStatus,
        setError: setTopupsError,
        setFetched: setTopupsFetched,
        sort: topupsSort,
      },
    }),
    [paymentsSort, requestsSort, topupsSort, tuitionSort],
  );

  const fetchTabRows = useCallback(
    async (tabKey, { sort, signal } = {}) => {
      if (!studentId || !tabConfig[tabKey]) {
        return;
      }

      const { endpoint, setRows, setStatus, setError, setFetched } = tabConfig[tabKey];
      const sortState = sort || getSortState(tabKey);
      const params = new URLSearchParams({
        lang: language ?? 'es',
        limit: String(TABLE_LIMIT),
      });

      const shouldUseUserId = endpoint === 'reports/balance-recharges';
      const identifier = shouldUseUserId ? student?.user_id : studentId;
      const identifierKey = shouldUseUserId ? 'user_id' : 'student_id';

      if (!identifier) {
        setStatus('error');
        setError('No fue posible cargar la información.');
        return;
      }

      params.set(identifierKey, String(identifier));

      if (sortState?.orderBy) {
        params.set('order_by', sortState.orderBy);
      }

      if (sortState?.orderDir) {
        params.set('order_dir', sortState.orderDir);
      }

      try {
        setStatus('loading');
        setError('');

        const response = await fetch(`${API_BASE_URL}/${endpoint}?${params.toString()}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal,
        });

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error('Failed to load table data');
        }

        const payload = await response.json();
        const content = Array.isArray(payload?.content)
          ? payload.content
          : Array.isArray(payload)
            ? payload
            : [];

        setRows(content);
        setFetched(true);
        setStatus('success');
      } catch (requestError) {
        if (requestError?.name === 'AbortError') {
          return;
        }

        console.error('Failed to load table', tabKey, requestError);
        setStatus('error');
        setError('No fue posible cargar la información.');
      }
    },
    [language, logout, student, studentId, tabConfig, token],
  );

  const handleSort = (tabKey, columnKey) => {
    if (!columnKey || !tabConfig[tabKey]) {
      return;
    }

    const currentSort = getSortState(tabKey);
    const nextDir =
      currentSort.orderBy === columnKey && currentSort.orderDir === 'asc' ? 'desc' : 'asc';
    const nextSort = { orderBy: columnKey, orderDir: nextDir };

    if (tabKey === 'tuition') setTuitionSort(nextSort);
    if (tabKey === 'payments') setPaymentsSort(nextSort);
    if (tabKey === 'requests') setRequestsSort(nextSort);
    if (tabKey === 'topups') setTopupsSort(nextSort);

    fetchTabRows(tabKey, { sort: nextSort });
  };

  const handleTuitionMonthClick = useCallback((row, monthKey, details) => {
    if (!details) {
      return;
    }

    const hasDetails =
      details.totalAmount != null ||
      (details.payments && details.payments.length > 0) ||
      details.paymentRequestId != null;

    if (!hasDetails) {
      return;
    }

    console.debug('Tuition month selected', { row, monthKey, details });
  }, []);

  const emptyValue = contactStrings.emptyValue;

  useEffect(() => {
    if (!studentId) {
      return undefined;
    }

    setTuitionRows([]);
    setPaymentsRows([]);
    setRequestsRows([]);
    setTopupsRows([]);
    setTuitionFetched(false);
    setPaymentsFetched(false);
    setRequestsFetched(false);
    setTopupsFetched(false);

    return undefined;
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      return undefined;
    }

    const controller = new AbortController();
    fetchTabRows('tuition', { signal: controller.signal });

    return () => controller.abort();
  }, [fetchTabRows, studentId]);

  useEffect(() => {
    if (!studentId) {
      return undefined;
    }

    const controller = new AbortController();

    if (activeTab === 'payments' && !paymentsFetched) {
      fetchTabRows('payments', { signal: controller.signal });
    }

    if (activeTab === 'requests' && !requestsFetched) {
      fetchTabRows('requests', { signal: controller.signal });
    }

    if (activeTab === 'topups' && !topupsFetched) {
      fetchTabRows('topups', { signal: controller.signal });
    }

    return () => controller.abort();
  }, [activeTab, fetchTabRows, paymentsFetched, requestsFetched, studentId, topupsFetched]);

  const renderEditableField = (
    label,
    name,
    { placeholder = '', type = 'text', valueOverride, errorOverride, inputClassName = 'input' } = {},
  ) => {
    const value = valueOverride ?? formValues[name] ?? '';
    const error = errorOverride ?? formErrors[name];
    const displayValue = value || emptyValue;

    return (
      <label className="field">
        <span>{label}</span>
        {isEditing ? (
          <input
            type={type}
            name={name}
            value={value}
            onChange={handleChange}
            className={error ? `${inputClassName} input--error` : inputClassName}
            placeholder={placeholder}
          />
        ) : (
          <p className="field__value">{displayValue}</p>
        )}
        {isEditing && error ? <span className="input__error">{error}</span> : null}
      </label>
    );
  };

  const renderStaticField = (label, value, { className = '' } = {}) => (
    <div className={`field ${className}`.trim()}>
      <span>{label}</span>
      <p className="field__value">{value || emptyValue}</p>
    </div>
  );

  const renderSortableHeader = (tabKey, columnKey, label, sortable = true, sortState) => {
    if (!sortable) {
      return label;
    }

    const isActive = sortState?.orderBy === columnKey;
    const direction = isActive ? sortState?.orderDir : null;
    const icon = direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '';

    return (
      <button type="button" className="student-detail-table__sort" onClick={() => handleSort(tabKey, columnKey)}>
        <span>{label}</span>
        <span aria-hidden="true" className="student-detail-table__sort-icon">
          {icon}
        </span>
      </button>
    );
  };

  const buildCellValue = (row, key) =>
    row?.[key] ??
    row?.[key?.replace(/_(\w)/g, (_, char) => char.toUpperCase())] ??
    row?.[key?.replace(/([A-Z])/g, '_$1').toLowerCase()];

  const buildSortableColumns = (tabKey, columns, sortState) =>
    columns.map((column) => ({
      ...column,
      header: renderSortableHeader(tabKey, column.key, column.label, column.sortable !== false, sortState),
    }));

  const getTableRowId = (row, index) =>
    row?.id || row?.payment_id || row?.payment_request_id || row?.balance_recharge_id || index;

  const formId = 'student-detail-form';

  const monthColumns = useMemo(() => {
    const columns = [];

    for (const row of tuitionRows) {
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
  }, [tuitionRows]);

  const tuitionColumns = useMemo(
    () =>
      monthColumns.map((month) => ({
        key: month,
        header: month,
      })),
    [monthColumns],
  );

  const paymentsColumns = [
    { key: 'payment_id', label: 'Pago' },
    { key: 'pt_name', label: 'Concepto' },
    {
      key: 'amount',
      label: 'Monto',
      render: (row) => formatCurrency(buildCellValue(row, 'amount') ?? 0),
    },
    { key: 'payment_status_name', label: 'Estatus' },
    {
      key: 'created_at',
      label: 'Fecha',
      render: (row) => formatDateValue(buildCellValue(row, 'created_at'), language) || emptyValue,
    },
    {
      key: 'actions',
      label: 'Ver detalles',
      sortable: false,
      render: () => (
        <ActionButton type="button" size="sm" variant="ghost">
          Ver detalles
        </ActionButton>
      ),
    },
  ];

  const requestsColumns = [
    { key: 'payment_request_id', label: 'Solicitud' },
    { key: 'pt_name', label: 'Concepto' },
    {
      key: 'amount',
      label: 'Monto',
      render: (row) => formatCurrency(buildCellValue(row, 'amount') ?? 0),
    },
    { key: 'ps_pr_name', label: 'Estatus' },
    {
      key: 'due_date',
      label: 'Vencimiento',
      render: (row) => formatDateValue(buildCellValue(row, 'due_date'), language) || emptyValue,
    },
    {
      key: 'created_at',
      label: 'Creado',
      render: (row) => formatDateValue(buildCellValue(row, 'created_at'), language) || emptyValue,
    },
    {
      key: 'actions',
      label: 'Ver detalles',
      sortable: false,
      render: () => (
        <ActionButton type="button" size="sm" variant="ghost">
          Ver detalles
        </ActionButton>
      ),
    },
  ];

  const topupsColumns = [
    { key: 'balance_recharge_id', label: 'ID de recarga' },
    {
      key: 'amount',
      label: 'Monto',
      render: (row) => formatCurrency(buildCellValue(row, 'amount') ?? 0),
    },
    {
      key: 'created_at',
      label: 'Fecha',
      render: (row) => formatDateValue(buildCellValue(row, 'created_at'), language) || emptyValue,
    },
    {
      key: 'actions',
      label: 'Ver detalles',
      sortable: false,
      render: () => (
        <ActionButton type="button" size="sm" variant="ghost">
          Ver detalles
        </ActionButton>
      ),
    },
  ];

  return (
    <section className="student-detail-page">
      <header className="student-detail-page__header">
        {isLoading ? (
          <div className="student-detail-page__header-skeleton">
            <span
              className="student-detail-page__avatar skeleton skeleton--circle skeleton--lg"
              aria-hidden="true"
            />
            <div className="student-detail-page__heading">
              <div className="skeleton skeleton--text skeleton--sm" />
              <div className="skeleton skeleton--text skeleton--lg" />
              <div className="student-detail-page__meta">
                <span className="skeleton skeleton--chip" />
                <span className="skeleton skeleton--chip" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="student-detail-page__heading">
              <div className="student-detail-page__identity">
                <span className="student-detail-page__avatar" aria-hidden="true">
                  {initials || '??'}
                </span>
                <div>
                  <p className="student-detail-page__sub">{activeInGroup}</p>
                  <h2>{student?.full_name || contactStrings.emptyValue}</h2>
                  <p className="student-detail-page__meta">
                    <span
                      className={`student-detail-page__chip ${hasActiveAccess ? 'chip--success' : 'chip--warning'}`}
                    >
                      {student?.user_status || contactStrings.emptyValue}
                    </span>
                    <span className="student-detail-page__chip">{student?.role_name || roleFallback}</span>
                    {/* <span className="student-detail-page__chip chip--light">
                      {student?.group_status || groupStatusFallback} | {student?.role_status || roleStatusFallback}
                    </span> */}
                  </p>
                </div>
              </div>
            </div>

            <div className="student-detail-page__actions">
              <button type="button" className="btn btn--ghost" disabled={status === 'loading'}>
                {resetPassword}
              </button>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={handleCancelEdit}
                    disabled={saveStatus === 'saving'}
                  >
                    {cancelEdit}
                  </button>
                  <button
                    type="submit"
                    form={formId}
                    className="ui-button ui-button--primary"
                    disabled={saveStatus === 'saving'}
                  >
                    {saveStatus === 'saving' ? 'Guardando...' : saveButton}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="ui-button ui-button--primary"
                  onClick={handleStartEdit}
                  disabled={status !== 'success'}
                >
                  {editButton}
                </button>
              )}
            </div>
          </>
        )}
      </header>

      <div className="student-detail-page__content">
        {stateMessage && !isLoading ? (
          <p className={`student-detail-page__state student-detail-page__state--${status}`} role={status === 'error' ? 'alert' : undefined}>
            {stateMessage}
          </p>
        ) : null}

        {isLoading ? (
          <div className="student-detail-page__skeleton-grid">
            <div className="student-card skeleton-card">
              <div className="skeleton skeleton--text skeleton--sm" />
              <div className="skeleton skeleton--input" />
              <div className="skeleton skeleton--text skeleton--sm" />
              <div className="skeleton skeleton--input" />
              <div className="skeleton skeleton--text skeleton--md" />
              <div className="skeleton skeleton--btn" />
            </div>
            <div className="info-card skeleton-card">
              <div className="skeleton skeleton--text skeleton--sm" />
              <div className="skeleton skeleton--text skeleton--lg" />
              <div className="skeleton skeleton--text skeleton--sm" />
              <div className="student-detail-page__meta">
                <span className="skeleton skeleton--chip" />
                <span className="skeleton skeleton--chip" />
              </div>
              <div className="skeleton skeleton--input" />
              <div className="skeleton skeleton--input" />
              <div className="skeleton skeleton--input" />
            </div>
            <div className="info-card skeleton-card">
              <div className="skeleton skeleton--text skeleton--sm" />
              <div className="skeleton skeleton--text skeleton--md" />
              <div className="skeleton skeleton--text skeleton--sm" />
              <div className="skeleton skeleton--input" />
              <div className="skeleton skeleton--input" />
              <div className="skeleton skeleton--input" />
            </div>
          </div>
        ) : null}

        {!student && status === 'success' ? (
          <div className="student-detail-page__placeholder">
            <h3>{placeholderDescription}</h3>
          </div>
        ) : null}

        {student && !isLoading ? (
          <form id={formId} onSubmit={handleSubmit}>
            <div className="container-fluid m-0 p-0">
              <div className="row g-3">
                <div className='col-md-4'>
                  <section className="student-card h-100">
                    <div className="student-card__row">
                      <div>
                        <p className="student-card__label">{registerLabel}</p>
                        {isEditing ? (
                          <input
                            name="register_id"
                            value={formValues.register_id}
                            onChange={handleChange}
                            className={formErrors.register_id ? 'input input--error' : 'input'}
                            placeholder={summaryStrings.registerPlaceholder}
                          />
                        ) : (
                          <p className="field__value">{formValues.register_id || emptyValue}</p>
                        )}
                        {isEditing && formErrors.register_id ? (
                          <span className="input__error">{formErrors.register_id}</span>
                        ) : null}
                      </div>
                      <div>
                        <p className="student-card__label">{summaryStrings.paymentReference}</p>
                        {isEditing ? (
                          <input
                            name="payment_reference"
                            value={formValues.payment_reference ?? ''}
                            onChange={handleChange}
                            className="input"
                            placeholder={summaryStrings.paymentReferencePlaceholder}
                          />
                        ) : (
                          <p className="field__value">{formValues.payment_reference || emptyValue}</p>
                        )}
                      </div>
                    </div>
                    <div className="student-card__divider" />
                    <div className="student-card__info">
                      <div>
                        <p className="student-card__label">{summaryStrings.balanceLabel}</p>
                        <h3>{formatCurrency(student.balance)}</h3>
                        <p className="student-card__hint">{summaryStrings.lastPayment}</p>
                      </div>
                    </div>
                    <button type="button" className="btn btn--ghost btn--full" disabled>
                      {summaryStrings.balance}
                    </button>
                  </section>
                </div>

                <div className='col-md-8'>
                  <section className="info-card h-100">
                    <div className="info-card__header">
                      <div>
                        <p className="info-card__label">{institutionStrings.label}</p>
                        <h3>{student.business_name || student.commercial_name || '—'}</h3>
                        <p className="info-card__meta">{institutionStrings.meta}</p>
                      </div>
                      <div className="info-card__status">
                        <span className="student-detail-page__chip chip--info">
                          {student.grade_group || institutionStrings.generationLabel}
                        </span>
                        <span className={`student-detail-page__chip ${student.group_enabled ? 'chip--success' : 'chip--warning'}`}>
                          {student.group_status || institutionStrings.groupStatus}
                        </span>
                      </div>
                    </div>
                    <div className="row">
                      <div className='col-md-4'>
                      {renderEditableField(institutionStrings.fields.schoolId, 'school_id', {
                        placeholder: institutionStrings.fields.schoolId,
                        inputClassName: 'input',
                      })}
                      </div>
                      <div className='col-md-4'>
                      {renderStaticField(institutionStrings.fields.scholarLevel, student.scholar_level_name)}
                      </div>
                      <div className='col-md-4'>
                      {renderEditableField(institutionStrings.fields.groupId, 'group_id', {
                        placeholder: institutionStrings.fields.groupId,
                        inputClassName: 'input',
                      })}
                      </div>
                      <div className='col-md-4'>
                      {renderStaticField(
                        institutionStrings.fields.gradeGroup,
                        student.grade_group || `${student.grade || ''} ${student.group || ''}`.trim(),
                      )}
                      </div>
                      <div className='col-md-4'>
                      {renderStaticField(institutionStrings.fields.generation, student.generation)}
                      </div>
                      <div className='col-md-4'>
                      {renderEditableField(institutionStrings.fields.curp, 'curp', {
                        placeholder: institutionStrings.fields.curp,
                        inputClassName: 'input',
                      })}
                      </div>
                    </div>
                  </section>
                </div>

                <div className='col-md-12'>
                  <div className="info-card">
                    <div className="info-card__header">
                      <div>
                        <p className="info-card__label">{contactStrings.label}</p>
                        <h3>{student.username}</h3>
                        <p className="info-card__meta">{student.email || contactStrings.meta}</p>
                      </div>
                      <div className="info-card__status">
                        <span className="student-detail-page__chip chip--info">
                          {student.role_name || contactStrings.roleChip || roleFallback}
                        </span>
                        <span className={`student-detail-page__chip ${student.user_enabled ? 'chip--success' : 'chip--warning'}`}>
                          {student.user_status || contactStrings.roleStatusChip || contactStrings.emptyValue}
                        </span>
                      </div>
                    </div>
                    {isEditing ? (
                      <>
                        <div className="row">
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.firstName, 'first_name', {
                              placeholder: contactStrings.fields.firstName,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.lastNameFather, 'last_name_father', {
                              placeholder: contactStrings.fields.lastNameFather,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.lastNameMother, 'last_name_mother', {
                              placeholder: contactStrings.fields.lastNameMother,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.birthDate, 'birth_date', {
                              placeholder: contactStrings.fields.birthDate,
                              type: 'date',
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.phoneNumber, 'phone_number', {
                              placeholder: contactStrings.fields.phoneNumber,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.taxId, 'tax_id', {
                              placeholder: contactStrings.fields.taxId,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.email, 'email', {
                              placeholder: contactStrings.fields.email,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.personalEmail, 'personal_email', {
                              placeholder: contactStrings.fields.personalEmail,
                              inputClassName: 'input',
                            })}
                          </div>
                        </div>
                        <div className="row">
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.street, 'street', {
                              placeholder: contactStrings.fields.street,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.extNumber, 'ext_number', {
                              placeholder: contactStrings.fields.extNumber,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.intNumber, 'int_number', {
                              placeholder: contactStrings.fields.intNumber,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.suburb, 'suburb', {
                              placeholder: contactStrings.fields.suburb,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.locality, 'locality', {
                              placeholder: contactStrings.fields.locality,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.municipality, 'municipality', {
                              placeholder: contactStrings.fields.municipality,
                              inputClassName: 'input',
                            })}
                          </div>
                          <div className='col-md-4'>
                            {renderEditableField(contactStrings.fields.state, 'state', {
                              placeholder: contactStrings.fields.state,
                              inputClassName: 'input',
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="info-card__summary">
                        <p className="info-card__summary-title">{contactStrings.summaryTitle}</p>
                        <div className="row">
                          <div className='col-md-4'>
                            <dt>{contactStrings.fields.firstName}:</dt>{' '}
                            {student.full_name}
                          </div>
                          <div className='col-md-4'>
                            <dt>{contactStrings.summary.phone}:</dt>{' '}
                            {student.phone_number || emptyValue}
                          </div>
                          <div className='col-md-4'>
                            <dt>{contactStrings.summary.birthDate}:</dt>{' '}
                            {formatDateValue(student.birth_date, language) || emptyValue}
                          </div>
                          <div className='col-md-4'>
                            <dt>{contactStrings.summary.taxId}:</dt>{' '}
                            {student.tax_id || emptyValue}
                          </div>
                          <div className='col-md-4'>
                            <dt>{contactStrings.summary.institutionalEmail}:</dt>{' '}
                            {student.email || emptyValue}
                          </div>
                          <div className='col-md-4'>
                            <dt>{contactStrings.summary.personalEmail}:</dt>{' '}
                            {student.personal_email || emptyValue}
                          </div>
                        </div>
                        <div className="info-card__address">
                          <p className="info-card__summary-title">{contactStrings.summary.address}</p>
                          <p className="info-card__meta">{contactStrings.addressHelper}</p>
                          <p className="field__value">{buildAddressString(student, emptyValue)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : null}

        <section className="student-detail-page__tabs">
          <div className="tabs__header">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'tuition' ? 'fw-bold tab-btn--active' : ''}`}
              onClick={() => setActiveTab('tuition')}
            >
              {tabs?.tuition || 'Colegíaturas'}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'requests' ? 'fw-bold tab-btn--active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              {tabs?.requests || 'Solicitudes de pagos'}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'payments' ? 'fw-bold tab-btn--active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              {tabs?.payments || 'Pagos'}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'topups' ? 'fw-bold tab-btn--active' : ''}`}
              onClick={() => setActiveTab('topups')}
            >
              {tabs?.topups || 'Recargas'}
            </button>
          </div>
          <div className="tabs__content">
            {activeTab === 'tuition' ? (
              <div className="student-detail-page__table-card">
                <GlobalTable
                  className="page__table-wrapper"
                  tableClassName="page__table mb-0"
                  columns={tuitionColumns}
                  data={tuitionRows}
                  getRowId={(row, index) => {
                    const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;
                    return studentId ?? row?.payment_reference ?? `${row?.student ?? 'row'}-${index}`;
                  }}
                  renderRow={(row, index) => {
                    const studentId = row?.student_id ?? row?.studentId ?? row?.student_uuid;
                    const rowKey = studentId ?? row?.payment_reference ?? `${row?.student ?? 'row'}-${index}`;

                    return (
                      <tr key={rowKey}>
                        {monthColumns.map((month) => {
                          const value = row?.[month];
                          const details = extractTuitionCellDetails(value);
                          const hasDetails =
                            details &&
                            (details.totalAmount != null ||
                              (details.payments && details.payments.length > 0) ||
                              details.paymentRequestId != null);
                          const displayAmount =
                            details?.totalAmount != null
                              ? currencyFormatter.format(details.totalAmount)
                              : null;
                          const fallbackAmount = normalizeAmount(value);
                          const fallbackContent =
                            fallbackAmount != null
                              ? currencyFormatter.format(fallbackAmount)
                              : <span className="ui-table__empty-indicator">--</span>;
                          const cellClassName = !hasDetails && fallbackAmount == null ? 'page__amount-null' : '';

                          return (
                            <td key={`${rowKey}-${month}`} data-title={month} className={cellClassName}>
                              {hasDetails ? (
                                <button
                                  type="button"
                                  className="page__amount-button"
                                  onClick={() => handleTuitionMonthClick(row, month, details)}
                                >
                                  {displayAmount ?? <span className="ui-table__empty-indicator">--</span>}
                                </button>
                              ) : (
                                fallbackContent
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }}
                  loading={tuitionStatus === 'loading'}
                  loadingMessage="Cargando colegiaturas..."
                  error={tuitionError || null}
                  emptyMessage="No hay información disponible."
                />
              </div>
            ) : null}
            {activeTab === 'requests'
              ? (
                  <div className="student-detail-page__table-card">
                    <GlobalTable
                      className="page__table-wrapper"
                      tableClassName="page__table mb-0"
                      columns={buildSortableColumns('requests', requestsColumns, requestsSort)}
                      data={requestsRows}
                      getRowId={getTableRowId}
                      loading={requestsStatus === 'loading'}
                      loadingMessage="Cargando solicitudes..."
                      error={requestsError || null}
                      emptyMessage="No hay información disponible."
                    />
                  </div>
                )
              : null}
            {activeTab === 'payments'
              ? (
                  <div className="student-detail-page__table-card">
                    <GlobalTable
                      className="page__table-wrapper"
                      tableClassName="page__table mb-0"
                      columns={buildSortableColumns('payments', paymentsColumns, paymentsSort)}
                      data={paymentsRows}
                      getRowId={getTableRowId}
                      loading={paymentsStatus === 'loading'}
                      loadingMessage="Cargando pagos..."
                      error={paymentsError || null}
                      emptyMessage="No hay información disponible."
                    />
                  </div>
                )
              : null}
            {activeTab === 'topups'
              ? (
                  <div className="student-detail-page__table-card">
                    <GlobalTable
                      className="page__table-wrapper"
                      tableClassName="page__table mb-0"
                      columns={buildSortableColumns('topups', topupsColumns, topupsSort)}
                      data={topupsRows}
                      getRowId={getTableRowId}
                      loading={topupsStatus === 'loading'}
                      loadingMessage="Cargando recargas..."
                      error={topupsError || null}
                      emptyMessage="No hay información disponible."
                    />
                  </div>
                )
              : null}
          </div>
        </section>
      </div>
    </section>
  );
};

export default StudentDetailPage;
