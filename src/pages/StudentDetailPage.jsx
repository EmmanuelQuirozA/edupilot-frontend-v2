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

const StudentDetailPage = ({
  studentId,
  language = 'es',
  strings = {},
  onBreadcrumbChange,
  onNavigateToStudents,
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
    breadcrumbFallback = 'Detalle de alumno',
    loading: loadingLabel = 'Cargando información...',
    error: errorLabel = 'No fue posible cargar la información del alumno.',
    placeholderDescription = 'Muy pronto podrás consultar la información completa del alumno aquí.',
    registerLabel = 'Matrícula',
    backToStudents = 'Volver a alumnos',
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
  }, [breadcrumbFallback, errorLabel, language, logout, onBreadcrumbChange, studentId, token]);

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
        nextErrors[field] = 'Campo obligatorio';
      }
    });

    if (formValues.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email)) {
      nextErrors.email = 'Correo inválido';
    }

    if (formValues.personal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.personal_email)) {
      nextErrors.personal_email = 'Correo inválido';
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
      onBreadcrumbChange?.(updatedFullName?.trim() || breadcrumbFallback);
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

  const formId = 'student-detail-form';

  return (
    <section className="student-detail-page">
      <header className="student-detail-page__header">
        <div className="student-detail-page__heading">
          <div className="student-detail-page__breadcrumb">
            <span className="student-detail-page__breadcrumb-link" role="link" onClick={onNavigateToStudents}>
              {backToStudents}
            </span>
            <span className="student-detail-page__breadcrumb-divider">/</span>
            <span className="student-detail-page__breadcrumb-current">Detalle de alumno</span>
          </div>
          <div className="student-detail-page__identity">
            <span className="student-detail-page__avatar" aria-hidden="true">
              {initials || '??'}
            </span>
            <div>
              <p className="student-detail-page__sub">Activo en Grupo</p>
              <h2>{student?.full_name || breadcrumbFallback}</h2>
              <p className="student-detail-page__meta">
                <span
                  className={`student-detail-page__chip ${
                    student?.user_status === 'Activo' ? 'chip--success' : 'chip--muted'
                  }`}
                >
                  {student?.user_status || '—'}
                </span>
                <span className="student-detail-page__chip">{student?.role_name || 'Rol'}</span>
                <span className="student-detail-page__chip chip--light">
                  {student?.group_status || 'Estado grupo'} | {student?.role_status || 'Estado rol'}
                </span>
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
                className="btn btn--primary"
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? 'Guardando...' : saveButton}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" onClick={handleStartEdit} disabled={status !== 'success'}>
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
          <form id={formId} className="student-detail-page__grid" onSubmit={handleSubmit}>
            <aside className="student-detail-page__sidebar">
              <div className="student-card">
                <div className="student-card__row">
                  <div>
                    <p className="student-card__label">{registerLabel}</p>
                    <input
                      name="register_id"
                      value={formValues.register_id}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.register_id ? 'input input--error' : 'input'}
                      placeholder="Ej. 5003"
                    />
                    {formErrors.register_id ? <span className="input__error">{formErrors.register_id}</span> : null}
                  </div>
                  <div>
                    <p className="student-card__label">Referencia de pago</p>
                    <input
                      name="payment_reference"
                      value={formValues.payment_reference ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Ingresa referencia"
                    />
                  </div>
                </div>
                <div className="student-card__divider" />
                <div className="student-card__info">
                  <div>
                    <p className="student-card__label">Saldo actual</p>
                    <h3>{formatCurrency(student.balance)}</h3>
                    <p className="student-card__hint">Último pago 10 dic 2024</p>
                  </div>
                  <div className="student-card__info">
                    <div>
                      <p className="student-card__label">Creditos de referencia</p>
                      <p className="student-card__value">{student.payment_reference || '—'}</p>
                    </div>
                    <div>
                      <p className="student-card__label">ID Grupo</p>
                      <p className="student-card__value">{student.group_id || '—'}</p>
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn--ghost btn--full" disabled>
                  Ver historial de pagos
                </button>
              </div>
            </aside>

            <div className="student-detail-page__main">
              <section className="info-card">
                <div className="info-card__header">
                  <div>
                    <p className="info-card__label">Institución</p>
                    <h3>{student.business_name || student.commercial_name || '—'}</h3>
                    <p className="info-card__meta">{student.user_status || '—'}</p>
                  </div>
                  <div className="info-card__status">
                    <span className="student-detail-page__chip chip--success">{student.school_status || '—'}</span>
                    <span className="student-detail-page__chip chip--info">{student.generation || 'Generación'}</span>
                  </div>
                </div>
                <div className="info-card__grid">
                  <label className="field">
                    <span>Escuela (ID)</span>
                    <input
                      name="school_id"
                      value={formValues.school_id}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.school_id ? 'input input--error' : 'input'}
                      placeholder="ID de escuela"
                    />
                    {formErrors.school_id ? <span className="input__error">{formErrors.school_id}</span> : null}
                  </label>
                  <label className="field">
                    <span>Nivel escolar</span>
                    <input value={student.scholar_level_name || '—'} disabled className="input input--static" />
                  </label>
                  <label className="field">
                    <span>Grupo (ID)</span>
                    <input
                      name="group_id"
                      value={formValues.group_id}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.group_id ? 'input input--error' : 'input'}
                      placeholder="ID de grupo"
                    />
                    {formErrors.group_id ? <span className="input__error">{formErrors.group_id}</span> : null}
                  </label>
                  <label className="field">
                    <span>Grado y grupo</span>
                    <input value={student.grade_group || `${student.grade || ''} ${student.group || ''}` || '—'} disabled className="input input--static" />
                  </label>
                  <label className="field">
                    <span>Generación</span>
                    <input value={student.generation || '—'} disabled className="input input--static" />
                  </label>
                  <label className="field">
                    <span>CURP</span>
                    <input
                      name="curp"
                      value={formValues.curp ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Ingresa CURP"
                    />
                  </label>
                </div>
              </section>

              <section className="info-card">
                <div className="info-card__header">
                  <div>
                    <p className="info-card__label">Información de contacto</p>
                    <h3>{student.username || 'Usuario no registrado'}</h3>
                    <p className="info-card__meta">{student.email || 'Sin correo'}</p>
                  </div>
                  <div className="info-card__status">
                    <span className="student-detail-page__chip chip--info">{student.role_name || '—'}</span>
                    <span className="student-detail-page__chip chip--success">{student.role_status || '—'}</span>
                  </div>
                </div>
                <div className="info-card__grid">
                  <label className="field">
                    <span>Nombre</span>
                    <input
                      name="first_name"
                      value={formValues.first_name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.first_name ? 'input input--error' : 'input'}
                      placeholder="Nombre(s)"
                    />
                    {formErrors.first_name ? <span className="input__error">{formErrors.first_name}</span> : null}
                  </label>
                  <label className="field">
                    <span>Apellido paterno</span>
                    <input
                      name="last_name_father"
                      value={formValues.last_name_father}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.last_name_father ? 'input input--error' : 'input'}
                      placeholder="Apellido paterno"
                    />
                    {formErrors.last_name_father ? <span className="input__error">{formErrors.last_name_father}</span> : null}
                  </label>
                  <label className="field">
                    <span>Apellido materno</span>
                    <input
                      name="last_name_mother"
                      value={formValues.last_name_mother}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.last_name_mother ? 'input input--error' : 'input'}
                      placeholder="Apellido materno"
                    />
                    {formErrors.last_name_mother ? <span className="input__error">{formErrors.last_name_mother}</span> : null}
                  </label>
                  <label className="field">
                    <span>Fecha de nacimiento</span>
                    <input
                      type="date"
                      name="birth_date"
                      value={formValues.birth_date ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                    />
                  </label>
                  <label className="field">
                    <span>Teléfono</span>
                    <input
                      name="phone_number"
                      value={formValues.phone_number ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Agregar número"
                    />
                  </label>
                  <label className="field">
                    <span>RFC</span>
                    <input
                      name="tax_id"
                      value={formValues.tax_id ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="RFC"
                    />
                  </label>
                  <label className="field">
                    <span>Correo institucional</span>
                    <input
                      name="email"
                      value={formValues.email ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.email ? 'input input--error' : 'input'}
                      placeholder="Correo institucional"
                    />
                    {formErrors.email ? <span className="input__error">{formErrors.email}</span> : null}
                  </label>
                  <label className="field">
                    <span>Correo personal</span>
                    <input
                      name="personal_email"
                      value={formValues.personal_email ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={formErrors.personal_email ? 'input input--error' : 'input'}
                      placeholder="Correo personal"
                    />
                    {formErrors.personal_email ? <span className="input__error">{formErrors.personal_email}</span> : null}
                  </label>
                </div>
              </section>

              <section className="info-card">
                <div className="info-card__header">
                  <div>
                    <p className="info-card__label">Dirección</p>
                    <h3>Datos de localización</h3>
                    <p className="info-card__meta">Agrega la dirección actual del alumno.</p>
                  </div>
                </div>
                <div className="info-card__grid info-card__grid--address">
                  <label className="field">
                    <span>Calle</span>
                    <input
                      name="street"
                      value={formValues.street ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Ingresa calle"
                    />
                  </label>
                  <label className="field">
                    <span>No. Exterior</span>
                    <input
                      name="ext_number"
                      value={formValues.ext_number ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Ext."
                    />
                  </label>
                  <label className="field">
                    <span>No. Interior</span>
                    <input
                      name="int_number"
                      value={formValues.int_number ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Int."
                    />
                  </label>
                  <label className="field">
                    <span>Colonia</span>
                    <input
                      name="suburb"
                      value={formValues.suburb ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Colonia"
                    />
                  </label>
                  <label className="field">
                    <span>Localidad</span>
                    <input
                      name="locality"
                      value={formValues.locality ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Localidad"
                    />
                  </label>
                  <label className="field">
                    <span>Municipio</span>
                    <input
                      name="municipality"
                      value={formValues.municipality ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Municipio"
                    />
                  </label>
                  <label className="field">
                    <span>Estado</span>
                    <input
                      name="state"
                      value={formValues.state ?? ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className="input"
                      placeholder="Estado"
                    />
                  </label>
                </div>
              </section>
            </div>
          </form>
        ) : null}

        {feedbackMessage ? <div className="student-detail-page__feedback">{feedbackMessage}</div> : null}

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
