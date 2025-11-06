import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '../ui/ActionButton.jsx';
import { API_BASE_URL } from '../../config.js';
import { handleExpiredToken } from '../../utils/auth.js';
import './AddPaymentModal.css';
import StudentSearchSelect from '../students/StudentSearchSelect.jsx';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

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
  }, [isOpen, onClose]);

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

  const handleSelectStudent = useCallback((option) => {
    setSelectedStudent(option);
    setFormValues((previous) => ({ ...previous, studentId: option?.id ?? '' }));
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

  const modalTitleId = 'add-payment-modal-title';
  const modalDescriptionId = 'add-payment-modal-description';

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="modal-backdrop fade show" onClick={resetAndClose} />
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
        <div className="modal-dialog modal-dialog-scrollable modal-lg modal-dialog-centered">
          <form id="add-payment-form" className="modal-content border-0 shadow" onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id={modalTitleId} className="modal-title h4 mb-1">
                  {mergedStrings.title}
                </h2>
                <p id={modalDescriptionId} className="text-muted mb-0">
                  {mergedStrings.description}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={resetAndClose} aria-label={mergedStrings.cancel} />
            </div>
            <div className="modal-body add-payment-modal__body">
              <div className="add-payment-form">
                <div className="mb-3">
                  <label className="form-label" htmlFor="add-payment-student">
                    {mergedStrings.studentLabel}
                  </label>
                  <StudentSearchSelect
                    id="add-payment-student"
                    token={token}
                    logout={logout}
                    language={normalizedLanguage}
                    selectedStudent={selectedStudent}
                    onSelect={handleSelectStudent}
                    strings={{
                      togglePlaceholder: mergedStrings.studentPlaceholder,
                      searchPlaceholder: mergedStrings.studentPlaceholder,
                      noResults: mergedStrings.studentNoResults,
                      loading: mergedStrings.studentLoading,
                      loadError: mergedStrings.studentLoadError,
                    }}
                  />
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
              </div>
            </div>
            <div className="modal-footer add-payment-modal__footer">
              <ActionButton type="button" variant="text" onClick={resetAndClose} disabled={isSubmitting}>
                {mergedStrings.cancel}
              </ActionButton>
              <ActionButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? mergedStrings.submitting : mergedStrings.submit}
              </ActionButton>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddPaymentModal;
