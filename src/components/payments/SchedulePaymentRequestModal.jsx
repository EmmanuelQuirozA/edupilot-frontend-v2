import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '../ui/ActionButton.jsx';
import { API_BASE_URL } from '../../config.js';
import { handleExpiredToken } from '../../utils/auth.js';
import StudentSearchSelect from '../students/StudentSearchSelect.jsx';
import './SchedulePaymentRequestModal.css';

const DEFAULT_STRINGS = {
  title: 'Programar solicitud de pago',
  description: 'Configura un cobro recurrente para tus estudiantes.',
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
  ruleNameEsLabel: 'Nombre (ES)',
  ruleNameEnLabel: 'Nombre (EN)',
  conceptLabel: 'Concepto de pago',
  conceptPlaceholder: 'Selecciona un concepto',
  amountLabel: 'Monto',
  feeTypeLabel: 'Tipo de recargo',
  feeTypeOptions: {
    currency: '$',
    percentage: '%',
  },
  lateFeeLabel: 'Recargo',
  lateFeeFrequencyLabel: 'Frecuencia de recargo',
  periodLabel: 'Periodo de tiempo',
  periodPlaceholder: 'Selecciona un periodo',
  intervalLabel: 'Intervalo',
  startDateLabel: 'Fecha inicial',
  endDateLabel: 'Fecha final',
  paymentMonthLabel: 'Mes de pago',
  nextDueDateLabel: 'Próximo vencimiento',
  commentsLabel: 'Comentarios',
  cancel: 'Cancelar',
  submit: 'Crear programación',
  submitting: 'Creando…',
  requiredField: 'Completa los campos obligatorios.',
  error: 'No fue posible crear la solicitud programada.',
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

const parseNumeric = (value, { allowZero = true, integer = false } = {}) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (!allowZero && parsed === 0) {
    return null;
  }

  if (integer) {
    const integerValue = Math.trunc(parsed);
    return integerValue;
  }

  return parsed;
};

const formatMonthValue = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  return trimmed;
};

const SchedulePaymentRequestModal = ({
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
  const [groupDetailsMap, setGroupDetailsMap] = useState({});
  const [periodOptions, setPeriodOptions] = useState([]);
  const [conceptOptions, setConceptOptions] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [ruleNameEs, setRuleNameEs] = useState('');
  const [ruleNameEn, setRuleNameEn] = useState('');
  const [paymentConceptId, setPaymentConceptId] = useState('');
  const [amount, setAmount] = useState('');
  const [feeType, setFeeType] = useState('$');
  const [lateFee, setLateFee] = useState('');
  const [lateFeeFrequency, setLateFeeFrequency] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [intervalCount, setIntervalCount] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMonth, setPaymentMonth] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [comments, setComments] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false);

  const normalizedLanguage = language || 'es';

  const resetForm = useCallback(() => {
    setScope('school');
    setSelectedSchool('');
    setSelectedGroup('');
    setSelectedStudent(null);
    setRuleNameEs('');
    setRuleNameEn('');
    setPaymentConceptId('');
    setAmount('');
    setFeeType('$');
    setLateFee('');
    setLateFeeFrequency('');
    setPeriodId('');
    setIntervalCount('1');
    setStartDate('');
    setEndDate('');
    setPaymentMonth('');
    setNextDueDate('');
    setComments('');
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

  const loadPeriods = useCallback(async () => {
    setIsLoadingPeriods(true);

    try {
      const response = await fetch(`${API_BASE_URL}/catalog/period-of-time?lang=${normalizedLanguage}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error('Failed to load periods');
      }

      const payload = await response.json();
      const options = mapCatalogOptions(payload, ['id', 'value'], ['name', 'label']);
      setPeriodOptions(options);

      if (options.length > 0) {
        setPeriodId(options[0].value);
      }
    } catch (error) {
      console.error('Periods fetch error', error);
      setPeriodOptions([]);
    } finally {
      setIsLoadingPeriods(false);
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
      const options = mapCatalogOptions(
        payload?.schools ?? payload,
        ['school_id', 'id', 'value'],
        ['commercial_name', 'name', 'label'],
      );
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
      const response = await fetch(`${API_BASE_URL}/groups/catalog`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(normalizedLanguage ? { 'Accept-Language': normalizedLanguage } : {}),
        },
      });

      if (!response.ok) {
        handleExpiredToken(response, logout);
        throw new Error('Failed to load groups');
      }

      const payload = await response.json();
      const groupsList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.content)
          ? payload.content
          : Array.isArray(payload?.groups)
            ? payload.groups
            : Array.isArray(payload)
              ? payload
              : [];

      const detailsMap = {};
      const options = groupsList
        .map((item, index) => {
          const rawValue =
            item?.group_id ?? item?.class_id ?? item?.id ?? item?.value ?? '';
          const value = rawValue !== undefined && rawValue !== null ? String(rawValue) : '';

          if (!value) {
            return null;
          }

          detailsMap[value] = item;

          const gradeGroup = item?.grade_group;
          const scholarLevel = item?.scholar_level_name;
          const labelParts = [];

          if (gradeGroup) {
            labelParts.push(gradeGroup);
          }

          if (scholarLevel) {
            labelParts.push(scholarLevel);
          }

          let label = labelParts.join(' - ');

          if (!label) {
            label =
              item?.group_name || item?.group || item?.name || value || `Opción ${index + 1}`;
          }

          return { value, label };
        })
        .filter(Boolean);

      setGroupDetailsMap(detailsMap);
      setGroupOptions(options);

      if (options.length > 0) {
        setSelectedGroup(options[0].value);
      }
    } catch (error) {
      console.error('Groups fetch error', error);
      setGroupOptions([]);
      setGroupDetailsMap({});
    } finally {
      setIsLoadingGroups(false);
    }
  }, [logout, normalizedLanguage, token]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    loadConcepts();
    loadPeriods();
    loadSchools();
    loadGroups();
  }, [isOpen, loadConcepts, loadGroups, loadPeriods, loadSchools]);

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

  const selectedGroupDetails = useMemo(() => {
    if (!selectedGroup) {
      return null;
    }

    return groupDetailsMap?.[selectedGroup] ?? null;
  }, [groupDetailsMap, selectedGroup]);

  const resetAndClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();

      if (isSubmitting) {
        return;
      }

      if (!ruleNameEs.trim() || !ruleNameEn.trim()) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      if (!paymentConceptId || !amount || !periodId || !intervalCount || !startDate || !endDate || !nextDueDate) {
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

      const amountValue = parseNumeric(amount, { allowZero: false });
      const lateFeeValue = parseNumeric(lateFee, { allowZero: true });
      const frequencyValue = parseNumeric(lateFeeFrequency, { allowZero: true, integer: true });
      const intervalValue = parseNumeric(intervalCount, { allowZero: false, integer: true });

      if (amountValue == null || intervalValue == null) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      if (amountValue < 0 || intervalValue <= 0) {
        setFormError(mergedStrings.requiredField);
        return;
      }

      const params = new URLSearchParams();
      params.set('lang', normalizedLanguage || 'en');

      if (scope === 'school') {
        params.set('school_id', selectedSchool);
      } else if (scope === 'group') {
        params.set('group_id', selectedGroup);
      } else if (scope === 'student' && selectedStudent?.id) {
        params.set('student_id', selectedStudent.id);
      }

      const payload = {
        rule_name_es: ruleNameEs.trim(),
        rule_name_en: ruleNameEn.trim(),
        payment_concept_id: Number(paymentConceptId),
        amount: amountValue,
        fee_type: feeType || '$',
        late_fee: lateFeeValue ?? 0,
        late_fee_frequency: frequencyValue ?? 0,
        period_of_time_id: Number(periodId),
        interval_count: intervalValue,
        start_date: startDate,
        end_date: endDate,
        comments: comments || undefined,
        payment_month: formatMonthValue(paymentMonth),
        next_due_date: nextDueDate,
      };

      setIsSubmitting(true);
      setFormError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/payment-requests/create-schedule?${params.toString()}`,
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
        console.error('Create payment request schedule error', error);
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
      endDate,
      feeType,
      intervalCount,
      isSubmitting,
      lateFee,
      lateFeeFrequency,
      logout,
      mergedStrings.error,
      mergedStrings.requiredField,
      nextDueDate,
      normalizedLanguage,
      onClose,
      onSuccess,
      paymentConceptId,
      paymentMonth,
      periodId,
      ruleNameEn,
      ruleNameEs,
      scope,
      selectedGroup,
      selectedSchool,
      selectedStudent,
      startDate,
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
              <div className="modal-body schedule-payment-request__body">
                <form className="schedule-payment-request__form" onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-scope" className="form-label">
                        {mergedStrings.scopeLabel}
                      </label>
                      <select
                        id="schedule-request-scope"
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
                      <label htmlFor="schedule-request-concept" className="form-label">
                        {mergedStrings.conceptLabel}
                      </label>
                      <select
                        id="schedule-request-concept"
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
                        <label htmlFor="schedule-request-school" className="form-label">
                          {mergedStrings.schoolLabel}
                        </label>
                        <select
                          id="schedule-request-school"
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
                        <label htmlFor="schedule-request-group" className="form-label">
                          {mergedStrings.groupLabel}
                        </label>
                        <select
                          id="schedule-request-group"
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
                        {selectedGroupDetails && (
                          <p className="form-text text-muted mb-0">
                            {[
                              selectedGroupDetails?.generation
                                ? `Generación: ${selectedGroupDetails.generation}`
                                : null,
                              selectedGroupDetails?.grade_group
                                ? `Grupo: ${selectedGroupDetails.grade_group}`
                                : null,
                              selectedGroupDetails?.scholar_level_name
                                ? `Nivel: ${selectedGroupDetails.scholar_level_name}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    )}
                    {scope === 'student' && (
                      <div className="col-12">
                        <label htmlFor="schedule-request-student" className="form-label">
                          {mergedStrings.studentLabel}
                        </label>
                        <StudentSearchSelect
                          id="schedule-request-student"
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
                      <label htmlFor="schedule-request-rule-es" className="form-label">
                        {mergedStrings.ruleNameEsLabel}
                      </label>
                      <input
                        id="schedule-request-rule-es"
                        type="text"
                        className="form-control"
                        value={ruleNameEs}
                        onChange={(event) => setRuleNameEs(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-rule-en" className="form-label">
                        {mergedStrings.ruleNameEnLabel}
                      </label>
                      <input
                        id="schedule-request-rule-en"
                        type="text"
                        className="form-control"
                        value={ruleNameEn}
                        onChange={(event) => setRuleNameEn(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-amount" className="form-label">
                        {mergedStrings.amountLabel}
                      </label>
                      <input
                        id="schedule-request-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-feetype" className="form-label">
                        {mergedStrings.feeTypeLabel}
                      </label>
                      <select
                        id="schedule-request-feetype"
                        className="form-select"
                        value={feeType}
                        onChange={(event) => setFeeType(event.target.value)}
                      >
                        <option value="$">{mergedStrings.feeTypeOptions.currency}</option>
                        <option value="%">{mergedStrings.feeTypeOptions.percentage}</option>
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-latefee" className="form-label">
                        {mergedStrings.lateFeeLabel}
                      </label>
                      <input
                        id="schedule-request-latefee"
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        value={lateFee}
                        onChange={(event) => setLateFee(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-frequency" className="form-label">
                        {mergedStrings.lateFeeFrequencyLabel}
                      </label>
                      <input
                        id="schedule-request-frequency"
                        type="number"
                        step="1"
                        min="0"
                        className="form-control"
                        value={lateFeeFrequency}
                        onChange={(event) => setLateFeeFrequency(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-period" className="form-label">
                        {mergedStrings.periodLabel}
                      </label>
                      <select
                        id="schedule-request-period"
                        className="form-select"
                        value={periodId}
                        onChange={(event) => setPeriodId(event.target.value)}
                        disabled={isLoadingPeriods}
                      >
                        <option value="" disabled>
                          {mergedStrings.periodPlaceholder}
                        </option>
                        {periodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-interval" className="form-label">
                        {mergedStrings.intervalLabel}
                      </label>
                      <input
                        id="schedule-request-interval"
                        type="number"
                        step="1"
                        min="1"
                        className="form-control"
                        value={intervalCount}
                        onChange={(event) => setIntervalCount(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-start-date" className="form-label">
                        {mergedStrings.startDateLabel}
                      </label>
                      <input
                        id="schedule-request-start-date"
                        type="date"
                        className="form-control"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-end-date" className="form-label">
                        {mergedStrings.endDateLabel}
                      </label>
                      <input
                        id="schedule-request-end-date"
                        type="date"
                        className="form-control"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-month" className="form-label">
                        {mergedStrings.paymentMonthLabel}
                      </label>
                      <input
                        id="schedule-request-month"
                        type="month"
                        className="form-control"
                        value={paymentMonth}
                        onChange={(event) => setPaymentMonth(event.target.value)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <label htmlFor="schedule-request-next-due" className="form-label">
                        {mergedStrings.nextDueDateLabel}
                      </label>
                      <input
                        id="schedule-request-next-due"
                        type="date"
                        className="form-control"
                        value={nextDueDate}
                        onChange={(event) => setNextDueDate(event.target.value)}
                      />
                    </div>
                    <div className="col-12">
                      <label htmlFor="schedule-request-comments" className="form-label">
                        {mergedStrings.commentsLabel}
                      </label>
                      <textarea
                        id="schedule-request-comments"
                        className="form-control"
                        rows={3}
                        value={comments}
                        onChange={(event) => setComments(event.target.value)}
                      />
                    </div>
                  </div>
                  {formError && <p className="schedule-payment-request__error">{formError}</p>}
                  <div className="schedule-payment-request__footer">
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

export default SchedulePaymentRequestModal;
