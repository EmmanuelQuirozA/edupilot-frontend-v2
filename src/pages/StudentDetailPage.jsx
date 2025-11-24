import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { handleExpiredToken } from '../utils/auth';
import './StudentDetailPage.css';

const REQUIRED_FIELDS = ['first_name', 'last_name_father', 'last_name_mother', 'school_id', 'group_id', 'register_id', 'email'];

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

  const emptyValue = contactStrings.emptyValue;

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

  const formId = 'student-detail-form';

  return (
    <section className="student-detail-page">
      <header className="student-detail-page__header">
        <div className="student-detail-page__heading">
          <div className="student-detail-page__identity">
            <span className="student-detail-page__avatar" aria-hidden="true">
              {initials || '??'}
            </span>
            <div>
              <p className="student-detail-page__sub">{activeInGroup}</p>
              <h2>{student?.full_name}</h2>
              <p className="student-detail-page__meta">
                <span className={`student-detail-page__chip 
                  ${student.school_enabled && student.role_enabled && student.group_enabled ? 
                  'chip--success' : 'chip--warning'}`}
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
              <button type="button" className="btn btn--secondary" onClick={handleCancelEdit} disabled={saveStatus === 'saving'}>
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
            <button type="button" className="ui-button ui-button--primary" onClick={handleStartEdit} disabled={status !== 'success'}>
              {editButton}
            </button>
          )}
        </div>
      </header>

      <div className="student-detail-page__content">
        {stateMessage ? (
          <p className={`student-detail-page__state student-detail-page__state--${status}`} role={status === 'error' ? 'alert' : undefined}>
            {stateMessage}
          </p>
        ) : null}

        {!student && status === 'success' ? (
          <div className="student-detail-page__placeholder">
            <h3>{placeholderDescription}</h3>
          </div>
        ) : null}

        {student ? (
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
                        <span className={`student-detail-page__chip  'chip--warning'`}>
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
              className={`tab-btn ${activeTab === 'tuition' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('tuition')}
            >
              {tabs?.tuition || 'Colegíaturas'}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'requests' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              {tabs?.requests || 'Solicitudes de pagos'}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'payments' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              {tabs?.payments || 'Pagos'}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'topups' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('topups')}
            >
              {tabs?.topups || 'Recargas'}
            </button>
          </div>
          <div className="tabs__content">
            {activeTab === 'tuition' ? <p>Gestiona las colegiaturas y mensualidades del alumno.</p> : null}
            {activeTab === 'requests' ? <p>Consulta las solicitudes de pagos generadas.</p> : null}
            {activeTab === 'payments' ? <p>Revisa los pagos registrados para el alumno.</p> : null}
            {activeTab === 'topups' ? <p>Administra las recargas y fondos adicionales.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
};

export default StudentDetailPage;
