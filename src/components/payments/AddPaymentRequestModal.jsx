import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '../ui/ActionButton.jsx';
import { API_BASE_URL } from '../../config.js';
import { handleExpiredToken } from '../../utils/auth.js';
import StudentSearchSelect from '../students/StudentSearchSelect.jsx';
import './AddPaymentRequestModal.css';

const DEFAULT_STRINGS = {
  title: 'Agregar solicitud de pago',
  description: 'Crea solicitudes de pago para tus estudiantes.',
  scopeLabel: 'Aplicar a',
  scopeOptions: {
    school: 'Toda la escuela',
    group: 'Grupo',
    student: 'Alumno',
  },
  schoolLabel: 'Escuela',
  schoolPlaceholder: 'Selecciona una escuela',
  groupLabel: 'Grupo',
  groupPlaceholder: 'Selecciona un grupo',
  studentLabel: 'Alumno',
  studentPlaceholder: 'Selecciona un alumno',
  conceptLabel: 'Concepto de pago',
  conceptPlaceholder: 'Selecciona un concepto',
  amountLabel: 'Monto solicitado',
  dueDateLabel: 'Fecha límite de pago',
  commentsLabel: 'Comentarios',
  lateFeeLabel: 'Recargo',
  feeTypeLabel: 'Tipo de recargo',
  feeTypeOptions: {
    currency: '$',
    percentage: '%',
  },
  frequencyLabel: 'Frecuencia de recargo',
  paymentMonthLabel: 'Mes de pago',
  partialPaymentLabel: 'Permitir pago parcial',
  partialPaymentOptions: {
    true: 'Sí',
    false: 'No',
  },
  cancel: 'Cancelar',
  submit: 'Crear solicitudes',
  submitting: 'Creando…',
  requiredField: 'Completa los campos obligatorios.',
  error: 'No fue posible crear las solicitudes de pago.',
};

const SCOPE_OPTIONS = ['school', 'group', 'student'];

const normalizeOption = (item, index = 0, valueKey = 'id', labelKey = 'name') => {
  if (!item || typeof item !== 'object') {
    return { value: '', label: '' };
  }

  const valueKeys = Array.isArray(valueKey) ? valueKey : [valueKey];
  const labelKeys = Array.isArray(labelKey) ? labelKey : [labelKey];

  let value = '';
  for (const key of valueKeys) {
    const candidate = item[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      value = String(candidate);
      break;
    }
  }

  let label = '';
  for (const key of labelKeys) {
    const candidate = item[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      label = candidate;
      break;
    }
  }

  if (!label) {
    label = value || `Opción ${index + 1}`;
  }

  return { value, label };
};

const mapCatalogOptions = (list, valueKey = 'id', labelKey = 'name') =>
  (Array.isArray(list) ? list : []).map((item, index) => normalizeOption(item, index, valueKey, labelKey));

const parseNumeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const AddPaymentRequestModal = ({
  isOpen,
  onClose,
  token,
  logout,
  language = 'es',
  strings = {},
  onSuccess,
}) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const [scope, setScope] = useState('school');
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [conceptOptions, setConceptOptions] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentConceptId, setPaymentConceptId] = useState('');
  const [amount, setAmount] = useState('');
  const [payBy, setPayBy] = useState('');
  const [comments, setComments] = useState('');
  const [lateFee, setLateFee] = useState('');
  const [feeType, setFeeType] = useState('$');
  const [lateFeeFrequency, setLateFeeFrequency] = useState('');
  const [paymentMonth, setPaymentMonth] = useState('');
  const [partialPayment, setPartialPayment] = useState('false');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);

  const normalizedLanguage = language || 'es';

  const resetForm = useCallback(() => {
    setScope('school');
    setSelectedSchool('');
    setSelectedGroup('');
    setSelectedStudent(null);
    setPaymentConceptId('');
    setAmount('');
    setPayBy('');
    setComments('');
    setLateFee('');
    setFeeType('$');
    setLateFeeFrequency('');
    setPaymentMonth('');
    setPartialPayment('false');
    setFormError('');
    setIsSubmitting(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    resetForm();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, resetForm]);

  const loadConcepts = useCallback(async () => {
    setIsLoadingConcepts(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/catalog/payment-concepts?lang=${normalizedLanguage}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error('Failed to load concepts');
      }

      const payload = await response.json();
      const options = mapCatalogOptions(payload?.data ?? payload, [
        'payment_concept_id',
        'id',
        'value',
      ]);
      setConceptOptions(options);

      if (options.length > 0) {
        setPaymentConceptId(options[0].value);
      }
    } catch (error) {
      console.error('Payment concepts fetch error', error);
      setConceptOptions([]);
    } finally {
      setIsLoadingConcepts(false);
    }
  }, [logout, normalizedLanguage, token]);

  const loadSchools = useCallback(async () => {
    setIsLoadingSchools(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/schools/list?lang=${normalizedLanguage}&status_filter=-1`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error('Failed to load schools');
      }

      const payload = await response.json();
      const options = mapCatalogOptions(payload?.schools ?? payload, [
        'school_id',
        'id',
        'value',
      ]);
      setSchoolOptions(options);

      if (options.length > 0) {
        setSelectedSchool(options[0].value);
      }
    } catch (error) {
      console.error('Schools fetch error', error);
      setSchoolOptions([]);
    } finally {
      setIsLoadingSchools(false);
    }
  }, [logout, normalizedLanguage, token]);

  const loadGroups = useCallback(async () => {
    setIsLoadingGroups(true);

    try {
      const params = new URLSearchParams({
        lang: normalizedLanguage,
        offset: '0',
        limit: '100',
        export_all: 'true',
      });

      const response = await fetch(`${API_BASE_URL}/classes?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error('Failed to load groups');
      }

      const payload = await response.json();
      const options = mapCatalogOptions(payload?.content ?? payload?.groups ?? payload, [
        'class_id',
        'group_id',
        'id',
        'value',
      ], ['name', 'group_name', 'group', 'label']);
      setGroupOptions(options);

      if (options.length > 0) {
        setSelectedGroup(options[0].value);
      }
    } catch (error) {
      console.error('Groups fetch error', error);
      setGroupOptions([]);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [logout, normalizedLanguage, token]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    loadConcepts();
    loadSchools();
    loadGroups();
  }, [isOpen, loadConcepts, loadGroups, loadSchools]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (scope === 'school') {
      if (schoolOptions.length > 0 && !selectedSchool) {
        setSelectedSchool(schoolOptions[0].value);
      }
    } else if (scope === 'group') {
      if (groupOptions.length > 0 && !selectedGroup) {
        setSelectedGroup(groupOptions[0].value);
      }
    } else if (scope === 'student') {
      setSelectedStudent(null);
    }
  }, [groupOptions, isOpen, scope, schoolOptions, selectedGroup, selectedSchool]);

  const handleScopeChange = useCallback((event) => {
    const nextScope = event.target.value;
    if (SCOPE_OPTIONS.includes(nextScope)) {
      setScope(nextScope);
      setFormError('');
    }
  }, []);

  const handleStudentSelect = useCallback((option) => {
    setSelectedStudent(option);
  }, []);

  const resetAndClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();

      if (isSubmitting) {
        return;
      }

      if (!paymentConceptId || !amount || !payBy) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      if (scope === 'school' && !selectedSchool) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      if (scope === 'group' && !selectedGroup) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      if (scope === 'student' && !selectedStudent?.id) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      const amountValue = parseNumeric(amount);
      const lateFeeValue = lateFee === '' ? null : parseNumeric(lateFee);
      const frequencyValue = lateFeeFrequency === '' ? null : parseNumeric(lateFeeFrequency);

      if (amountValue == null) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      const params = new URLSearchParams();

      if (scope === 'school') {
        params.set('school_id', selectedSchool);
      } else if (scope === 'group') {
        params.set('group_id', selectedGroup);
      } else if (scope === 'student' && selectedStudent?.id) {
        params.set('student_id', selectedStudent.id);
      }

      const payload = {
        payment_concept_id: Number(paymentConceptId),
        amount: amountValue,
        pay_by: payBy,
        comments: comments || undefined,
        late_fee: lateFeeValue ?? 0,
        fee_type: feeType || '$',
        late_fee_frequency: frequencyValue ?? 0,
        payment_month: paymentMonth || undefined,
        partial_payment: partialPayment === 'true',
      };

      setIsSubmitting(true);
      setFormError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/payment-requests/create?${params.toString()}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error(mergedStrings.error);
        }

        const result = await response.json();
        onSuccess?.(result);
        resetAndClose();
        onClose?.();
      } catch (error) {
        console.error('Create payment request error', error);
        const message =
          error instanceof Error && error.message ? error.message : mergedStrings.error;
        setFormError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      amount,
      comments,
      feeType,
      isSubmitting,
      lateFee,
      lateFeeFrequency,
      logout,
      mergedStrings.error,
      mergedStrings.requiredField,
      onClose,
      onSuccess,
      partialPayment,
      payBy,
      paymentConceptId,
      paymentMonth,
      scope,
      selectedGroup,
      selectedSchool,
      selectedStudent,
      resetAndClose,
      token,
    ],
  );

  const modalTitleId = 'add-payment-modal-title';
  const modalDescriptionId = 'add-payment-modal-description';

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        aria-describedby={modalDescriptionId}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            resetAndClose();
          }
        }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h2 id={modalTitleId} className="modal-title h4 mb-1">
                  {mergedStrings.title}
                </h2>
                <p id={modalDescriptionId} className="text-muted mb-0">
                  {mergedStrings.description}
                </p>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body add-payment-request__body">
              <form className="add-payment-request__form" onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-scope" className="form-label">
                      {mergedStrings.scopeLabel}
                    </label>
                    <select
                      id="payment-request-scope"
                      className="form-select"
                      value={scope}
                      onChange={handleScopeChange}
                    >
                      <option value="school">{mergedStrings.scopeOptions.school}</option>
                      <option value="group">{mergedStrings.scopeOptions.group}</option>
                      <option value="student">{mergedStrings.scopeOptions.student}</option>
                    </select>
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-concept" className="form-label">
                      {mergedStrings.conceptLabel}
                    </label>
                    <select
                      id="payment-request-concept"
                      className="form-select"
                      value={paymentConceptId}
                      onChange={(event) => setPaymentConceptId(event.target.value)}
                      disabled={isLoadingConcepts}
                    >
                      <option value="" disabled>
                        {mergedStrings.conceptPlaceholder}
                      </option>
                      {conceptOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {scope === 'school' && (
                    <div className="col-12">
                      <label htmlFor="payment-request-school" className="form-label">
                        {mergedStrings.schoolLabel}
                      </label>
                      <select
                        id="payment-request-school"
                        className="form-select"
                        value={selectedSchool}
                        onChange={(event) => setSelectedSchool(event.target.value)}
                        disabled={isLoadingSchools}
                      >
                        <option value="" disabled>
                          {mergedStrings.schoolPlaceholder}
                        </option>
                        {schoolOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {scope === 'group' && (
                    <div className="col-12">
                      <label htmlFor="payment-request-group" className="form-label">
                        {mergedStrings.groupLabel}
                      </label>
                      <select
                        id="payment-request-group"
                        className="form-select"
                        value={selectedGroup}
                        onChange={(event) => setSelectedGroup(event.target.value)}
                        disabled={isLoadingGroups}
                      >
                        <option value="" disabled>
                          {mergedStrings.groupPlaceholder}
                        </option>
                        {groupOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {scope === 'student' && (
                    <div className="col-12">
                      <label htmlFor="add-payment-student" className="form-label">
                        {mergedStrings.studentLabel}
                      </label>
                      <StudentSearchSelect
                        id="add-payment-student"
                        token={token}
                        logout={logout}
                        language={normalizedLanguage}
                        selectedStudent={selectedStudent}
                        onSelect={handleStudentSelect}
                        strings={{ togglePlaceholder: mergedStrings.studentPlaceholder }}
                      />
                    </div>
                  )}
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-amount" className="form-label">
                      {mergedStrings.amountLabel}
                    </label>
                    <input
                      id="payment-request-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-payby" className="form-label">
                      {mergedStrings.dueDateLabel}
                    </label>
                    <input
                      id="payment-request-payby"
                      type="date"
                      className="form-control"
                      value={payBy}
                      onChange={(event) => setPayBy(event.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-latefee" className="form-label">
                      {mergedStrings.lateFeeLabel}
                    </label>
                    <input
                      id="payment-request-latefee"
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={lateFee}
                      onChange={(event) => setLateFee(event.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-feetype" className="form-label">
                      {mergedStrings.feeTypeLabel}
                    </label>
                    <select
                      id="payment-request-feetype"
                      className="form-select"
                      value={feeType}
                      onChange={(event) => setFeeType(event.target.value)}
                    >
                      <option value="$">{mergedStrings.feeTypeOptions.currency}</option>
                      <option value="%">{mergedStrings.feeTypeOptions.percentage}</option>
                    </select>
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-frequency" className="form-label">
                      {mergedStrings.frequencyLabel}
                    </label>
                    <input
                      id="payment-request-frequency"
                      type="number"
                      step="1"
                      min="0"
                      className="form-control"
                      value={lateFeeFrequency}
                      onChange={(event) => setLateFeeFrequency(event.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-month" className="form-label">
                      {mergedStrings.paymentMonthLabel}
                    </label>
                    <input
                      id="payment-request-month"
                      type="month"
                      className="form-control"
                      value={paymentMonth}
                      onChange={(event) => setPaymentMonth(event.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label htmlFor="payment-request-partial" className="form-label">
                      {mergedStrings.partialPaymentLabel}
                    </label>
                    <select
                      id="payment-request-partial"
                      className="form-select"
                      value={partialPayment}
                      onChange={(event) => setPartialPayment(event.target.value)}
                    >
                      <option value="false">{mergedStrings.partialPaymentOptions.false}</option>
                      <option value="true">{mergedStrings.partialPaymentOptions.true}</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label htmlFor="payment-request-comments" className="form-label">
                      {mergedStrings.commentsLabel}
                    </label>
                    <textarea
                      id="payment-request-comments"
                      className="form-control"
                      rows={3}
                      value={comments}
                      onChange={(event) => setComments(event.target.value)}
                    />
                  </div>
                </div>
                {formError && <p className="add-payment-request__error">{formError}</p>}
                <div className="add-payment-request__footer">
                  <ActionButton type="button" variant="text" onClick={onClose}>
                    {mergedStrings.cancel}
                  </ActionButton>
                  <ActionButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? mergedStrings.submitting : mergedStrings.submit}
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddPaymentRequestModal;
