import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SidebarModal from '../ui/SidebarModal.jsx';
import ActionButton from '../ui/ActionButton.jsx';
import { API_BASE_URL } from '../../config.js';
import { handleExpiredToken } from '../../utils/auth.js';
import './AddPaymentModal.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const STUDENT_SEARCH_DEBOUNCE = 350;

const DEFAULT_STRINGS = {
  title: 'Agregar pago',
  description: 'Registra un nuevo pago para un alumno.',
  studentLabel: 'Estudiante',
  studentPlaceholder: 'Buscar por nombre',
  studentEmpty: 'Selecciona un alumno',
  studentNoResults: 'No se encontraron alumnos.',
  studentLoading: 'Buscando alumnos...',
  studentLoadError: 'No fue posible cargar los alumnos.',
  conceptLabel: 'Concepto de pago',
  conceptPlaceholder: 'Selecciona un concepto',
  conceptLoading: 'Cargando conceptos...',
  throughLabel: 'Método de pago',
  throughPlaceholder: 'Selecciona un método',
  throughLoading: 'Cargando métodos de pago...',
  monthLabel: 'Mes de pago',
  amountLabel: 'Monto',
  commentsLabel: 'Comentarios',
  receiptLabel: 'Comprobante (PDF, máx. 5 MB)',
  receiptOptional: 'Opcional',
  receiptTypeError: 'El comprobante debe ser un archivo PDF.',
  receiptSizeError: 'El archivo debe ser menor a 5 MB.',
  cancel: 'Cancelar',
  submit: 'Guardar pago',
  submitting: 'Guardando...',
  success: 'Pago creado correctamente.',
  error: 'No fue posible crear el pago.',
  requiredField: 'Este campo es obligatorio.',
};

const extractArrayFromPayload = (payload) => {
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
    payload.students,
    payload.content,
    payload.response,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeStudentOption = (item, index = 0) => {
  const id =
    item?.student_id ??
    item?.studentId ??
    item?.id ??
    item?.user_id ??
    item?.uuid ??
    item?.value ??
    index;

  const fullName =
    item?.full_name ??
    item?.fullName ??
    item?.student_full_name ??
    item?.name ??
    '';

  const gradeGroup = item?.grade_group ?? item?.group_name ?? item?.class_name ?? '';
  const generation = item?.generation ?? item?.generation_name ?? '';
  const scholarLevel = item?.scholar_level_name ?? item?.scholar_level ?? item?.level ?? '';
  const paymentReference = item?.payment_reference ?? item?.register_id ?? '';

  return {
    id: String(id),
    fullName: fullName || `Alumno ${index + 1}`,
    gradeGroup,
    generation,
    scholarLevel,
    paymentReference,
  };
};

const normalizeCatalogOption = (item, index = 0) => {
  const id =
    item?.id ??
    item?.value ??
    item?.catalog_id ??
    item?.payment_concept_id ??
    item?.payment_through_id ??
    index;

  const name =
    item?.name ??
    item?.label ??
    item?.title ??
    item?.description ??
    item?.concept ??
    `Opción ${index + 1}`;

  return { id: String(id), name };
};

const AddPaymentModal = ({
  isOpen,
  onClose,
  token,
  logout,
  language = 'es',
  strings = {},
  onSuccess,
}) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const [formValues, setFormValues] = useState({
    studentId: '',
    paymentConceptId: '',
    paymentThroughId: '',
    paymentMonth: '',
    amount: '',
    comments: '',
  });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [conceptOptions, setConceptOptions] = useState([]);
  const [throughOptions, setThroughOptions] = useState([]);
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
  const [isLoadingThrough, setIsLoadingThrough] = useState(false);

  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentOptions, setStudentOptions] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);
  const normalizedLanguage = language || 'es';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues({
      studentId: '',
      paymentConceptId: '',
      paymentThroughId: '',
      paymentMonth: '',
      amount: '',
      comments: '',
    });
    setSelectedStudent(null);
    setReceiptFile(null);
    setFileError('');
    setFormError('');
    setStudentSearchTerm('');
    setStudentOptions([]);
    setStudentsError('');
    setIsStudentDropdownOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isStudentDropdownOpen) {
      return undefined;
    }

    let isMounted = true;
    const controller = new AbortController();
    const searchValue = studentSearchTerm.trim();

    setIsLoadingStudents(true);
    setStudentsError('');

    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          lang: normalizedLanguage,
          offset: '0',
          limit: '10',
          export_all: 'false',
        });

        if (searchValue) {
          params.set('full_name', searchValue);
        }

        const response = await fetch(`${API_BASE_URL}/students?${params.toString()}`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error(mergedStrings.studentLoadError);
        }

        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        const list = extractArrayFromPayload(payload);
        const options = list.map((item, index) => normalizeStudentOption(item, index));
        setStudentOptions(options);
      } catch (error) {
        if (!isMounted && error.name === 'AbortError') {
          return;
        }

        if (error.name !== 'AbortError') {
          console.error('Student search error', error);
          if (isMounted) {
            setStudentsError(
              error instanceof Error && error.message ? error.message : mergedStrings.studentLoadError,
            );
            setStudentOptions([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingStudents(false);
        }
      }
    }, STUDENT_SEARCH_DEBOUNCE);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    isOpen,
    isStudentDropdownOpen,
    studentSearchTerm,
    normalizedLanguage,
    token,
    logout,
    mergedStrings.studentLoadError,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadConcepts = async () => {
      setIsLoadingConcepts(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/catalog/payment-concepts?lang=${normalizedLanguage}`,
          {
            method: 'GET',
            signal: controller.signal,
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
        if (!isMounted) {
          return;
        }
        const list = extractArrayFromPayload(payload);
        const options = list.map((item, index) => normalizeCatalogOption(item, index));
        setConceptOptions(options);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Payment concepts fetch error', error);
          if (isMounted) {
            setConceptOptions([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingConcepts(false);
        }
      }
    };

    loadConcepts();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, normalizedLanguage, token, logout]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadThroughOptions = async () => {
      setIsLoadingThrough(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/catalog/payment-through?lang=${normalizedLanguage}`,
          {
            method: 'GET',
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error('Failed to load payment methods');
        }

        const payload = await response.json();
        if (!isMounted) {
          return;
        }
        const list = extractArrayFromPayload(payload);
        const options = list.map((item, index) => normalizeCatalogOption(item, index));
        setThroughOptions(options);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Payment methods fetch error', error);
          if (isMounted) {
            setThroughOptions([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingThrough(false);
        }
      }
    };

    loadThroughOptions();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, normalizedLanguage, token, logout]);

  useEffect(() => {
    if (!isStudentDropdownOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsStudentDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStudentDropdownOpen]);

  const handleStudentToggle = useCallback(() => {
    setIsStudentDropdownOpen((previous) => !previous);
    setStudentSearchTerm('');
  }, []);

  const handleStudentSearchChange = useCallback((event) => {
    setStudentSearchTerm(event.target.value);
  }, []);

  const handleSelectStudent = useCallback((option) => {
    setSelectedStudent(option);
    setFormValues((previous) => ({ ...previous, studentId: option.id }));
    setIsStudentDropdownOpen(false);
  }, []);

  const handleFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormValues((previous) => ({ ...previous, [name]: value }));
  }, []);

  const handleAmountChange = useCallback((event) => {
    const { value } = event.target;
    if (value === '' || /^\d*(\.\d{0,2})?$/.test(value)) {
      setFormValues((previous) => ({ ...previous, amount: value }));
    }
  }, []);

  const handleReceiptChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        setReceiptFile(null);
        setFileError('');
        return;
      }

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        setFileError(mergedStrings.receiptTypeError);
        setReceiptFile(null);
        event.target.value = '';
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(mergedStrings.receiptSizeError);
        setReceiptFile(null);
        event.target.value = '';
        return;
      }

      setFileError('');
      setReceiptFile(file);
    },
    [mergedStrings.receiptSizeError, mergedStrings.receiptTypeError],
  );

  const resetAndClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      const { studentId, paymentConceptId, paymentThroughId, paymentMonth, amount, comments } =
        formValues;

      if (!studentId || !paymentConceptId || !paymentThroughId || !paymentMonth || amount === '') {
        setFormError(mergedStrings.requiredField);
        return;
      }

      setFormError('');
      setIsSubmitting(true);

      try {
        const payload = {
          student_id: Number(studentId),
          payment_concept_id: Number(paymentConceptId),
          payment_through_id: Number(paymentThroughId),
          payment_month: paymentMonth,
          amount: Number(amount),
          comments: comments || '',
        };

        const formData = new FormData();
        formData.append('request', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

        if (receiptFile) {
          formData.append('receipt', receiptFile, receiptFile.name);
        }

        const response = await fetch(
          `${API_BASE_URL}/payments/create?lang=${normalizedLanguage}`,
          {
            method: 'POST',
            body: formData,
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        const rawText = await response.text();

        if (!response.ok) {
          handleExpiredToken(response, logout);

          let message = mergedStrings.error;
          if (rawText) {
            try {
              const data = JSON.parse(rawText);
              if (typeof data === 'string') {
                message = data;
              } else if (data?.message) {
                message = data.message;
              }
            } catch (parseError) {
              message = rawText;
            }
          }

          throw new Error(message);
        }

        let successMessage = mergedStrings.success;
        if (rawText) {
          try {
            const data = JSON.parse(rawText);
            if (typeof data === 'string') {
              successMessage = data;
            } else if (data?.message) {
              successMessage = data.message;
            }
          } catch (parseError) {
            successMessage = rawText;
          }
        }

        onSuccess?.(successMessage);
        resetAndClose();
      } catch (error) {
        console.error('Create payment error', error);
        setFormError(error instanceof Error && error.message ? error.message : mergedStrings.error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formValues,
      isSubmitting,
      mergedStrings,
      normalizedLanguage,
      onSuccess,
      receiptFile,
      resetAndClose,
      token,
      logout,
    ],
  );

  const studentSummary = useMemo(() => {
    if (!selectedStudent) {
      return mergedStrings.studentPlaceholder;
    }

    return selectedStudent.fullName;
  }, [mergedStrings.studentPlaceholder, selectedStudent]);

  const renderStudentMeta = (option) => {
    const metaParts = [option.gradeGroup, option.generation, option.scholarLevel]
      .map((value) => value && String(value).trim())
      .filter(Boolean);

    const reference = option.paymentReference ? `Matrícula: ${option.paymentReference}` : '';

    if (reference) {
      metaParts.unshift(reference);
    }

    if (metaParts.length === 0) {
      return null;
    }

    return metaParts.join(' • ');
  };

  return (
    <SidebarModal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={mergedStrings.title}
      description={mergedStrings.description}
      size="lg"
      bodyClassName="add-payment-modal__body"
      id="add-payment-modal"
      footer={
        <div className="add-payment-modal__footer">
          <ActionButton type="button" variant="text" onClick={resetAndClose} disabled={isSubmitting}>
            {mergedStrings.cancel}
          </ActionButton>
          <ActionButton
            type="submit"
            form="add-payment-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? mergedStrings.submitting : mergedStrings.submit}
          </ActionButton>
        </div>
      }
    >
      <form id="add-payment-form" className="add-payment-form" onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="add-payment-student">
            {mergedStrings.studentLabel}
          </label>
          <div className="student-search" ref={dropdownRef}>
            <button
              type="button"
              id="add-payment-student"
              className={`student-search__toggle ${selectedStudent ? '' : 'is-placeholder'}`}
              onClick={handleStudentToggle}
              aria-expanded={isStudentDropdownOpen}
            >
              {studentSummary}
            </button>
            {isStudentDropdownOpen ? (
              <div className="student-search__dropdown">
                <div className="student-search__search">
                  <input
                    type="text"
                    value={studentSearchTerm}
                    onChange={handleStudentSearchChange}
                    placeholder={mergedStrings.studentPlaceholder}
                    autoFocus
                  />
                </div>
                <div className="student-search__options">
                  {isLoadingStudents ? (
                    <div className="student-search__status">{mergedStrings.studentLoading}</div>
                  ) : studentsError ? (
                    <div className="student-search__status student-search__status--error">
                      {studentsError}
                    </div>
                  ) : studentOptions.length === 0 ? (
                    <div className="student-search__status">{mergedStrings.studentNoResults}</div>
                  ) : (
                    studentOptions.map((option) => {
                      const meta = renderStudentMeta(option);
                      return (
                        <button
                          type="button"
                          key={option.id}
                          className="student-search__option"
                          onClick={() => handleSelectStudent(option)}
                        >
                          <span className="student-search__option-name">{option.fullName}</span>
                          {meta ? <span className="student-search__option-meta">{meta}</span> : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
            {selectedStudent
              ? (() => {
                  const meta = renderStudentMeta(selectedStudent);
                  return meta ? (
                    <p className="student-search__selected-meta">{meta}</p>
                  ) : null;
                })()
              : null}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="add-payment-concept">
              {mergedStrings.conceptLabel}
            </label>
            <select
              id="add-payment-concept"
              name="paymentConceptId"
              className="form-select"
              value={formValues.paymentConceptId}
              onChange={handleFieldChange}
            >
              <option value="">
                {isLoadingConcepts ? mergedStrings.conceptLoading : mergedStrings.conceptPlaceholder}
              </option>
              {conceptOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="add-payment-through">
              {mergedStrings.throughLabel}
            </label>
            <select
              id="add-payment-through"
              name="paymentThroughId"
              className="form-select"
              value={formValues.paymentThroughId}
              onChange={handleFieldChange}
            >
              <option value="">
                {isLoadingThrough ? mergedStrings.throughLoading : mergedStrings.throughPlaceholder}
              </option>
              {throughOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="add-payment-month">
              {mergedStrings.monthLabel}
            </label>
            <input
              type="month"
              id="add-payment-month"
              name="paymentMonth"
              className="form-control"
              value={formValues.paymentMonth}
              onChange={handleFieldChange}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label" htmlFor="add-payment-amount">
              {mergedStrings.amountLabel}
            </label>
            <input
              type="text"
              inputMode="decimal"
              id="add-payment-amount"
              name="amount"
              className="form-control"
              value={formValues.amount}
              onChange={handleAmountChange}
              placeholder="0.00"
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="add-payment-comments">
              {mergedStrings.commentsLabel}
            </label>
            <textarea
              id="add-payment-comments"
              name="comments"
              className="form-control"
              rows={3}
              value={formValues.comments}
              onChange={handleFieldChange}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="add-payment-receipt">
              {mergedStrings.receiptLabel}
              <span className="text-muted ms-2">{mergedStrings.receiptOptional}</span>
            </label>
            <input
              type="file"
              id="add-payment-receipt"
              className="form-control"
              accept="application/pdf"
              onChange={handleReceiptChange}
            />
            {fileError ? <p className="add-payment-form__error">{fileError}</p> : null}
          </div>
        </div>

        {formError ? <p className="add-payment-form__error">{formError}</p> : null}
      </form>
    </SidebarModal>
  );
};

export default AddPaymentModal;
