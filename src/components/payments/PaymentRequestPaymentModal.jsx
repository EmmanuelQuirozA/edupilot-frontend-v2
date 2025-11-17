import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActionButton from '../ui/ActionButton.jsx';
import { API_BASE_URL } from '../../config.js';
import { handleExpiredToken } from '../../utils/auth.js';
import './PaymentRequestPaymentModal.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const DEFAULT_STRINGS = {
  title: 'Registrar pago',
  description: 'Registra un pago para esta solicitud.',
  monthLabel: 'Mes del pago',
  conceptLabel: 'Concepto',
  partialLabel: 'Pago parcial',
  pendingLabel: 'Pendiente de pago',
  amountLabel: 'Monto a pagar',
  commentsLabel: 'Comentarios',
  methodLabel: 'Método de pago',
  methodPlaceholder: 'Selecciona un método',
  methodLoading: 'Cargando métodos...',
  attachmentLabel: 'Adjuntar archivo',
  attachmentHint: 'Arrastra y suelta o haz clic para seleccionar',
  attachmentSelected: 'Archivo seleccionado',
  removeFile: 'Quitar archivo',
  cancel: 'Cancelar',
  submit: 'Registrar pago',
  submitting: 'Guardando...',
  success: 'Pago registrado correctamente.',
  error: 'No fue posible registrar el pago.',
  fileSizeError: 'El archivo supera el tamaño máximo permitido (5 MB).',
  requiredField: 'Completa los campos obligatorios.',
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

const formatCurrency = (value, language) => {
  if (value == null || value === '') {
    return '';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

const formatMonth = (value, language) => {
  if (!value) {
    return '';
  }

  const parsedValue = value.length > 7 ? value.slice(0, 7) : value;
  const date = new Date(`${parsedValue}-01`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-MX', {
    year: 'numeric',
    month: 'long',
  }).format(date);
};

const PaymentRequestPaymentModal = ({
  isOpen,
  onClose,
  language = 'es',
  token,
  logout,
  paymentRequest,
  paymentInfo,
  onSuccess,
  yesLabel,
  noLabel,
  strings = {},
}) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fileError, setFileError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [methodOptions, setMethodOptions] = useState([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  const normalizedLanguage = language || 'es';
  const paymentRequestId = paymentRequest?.payment_request_id ?? paymentRequest?.id ?? '';
  const paymentConceptId =
    paymentRequest?.payment_concept_id ??
    paymentRequest?.concept_id ??
    paymentRequest?.paymentConceptId ??
    paymentRequest?.conceptId ??
    null;
  const paymentMonth = paymentRequest?.payment_month ? paymentRequest.payment_month.slice(0, 7) : '';
  const pendingPayment = paymentInfo?.pendingPayment ?? paymentInfo?.pending_payment ?? null;
  const pendingAmountLabel = formatCurrency(pendingPayment, normalizedLanguage);
  const partialPaymentLabel = paymentRequest?.partial_payment ? yesLabel || 'Sí' : noLabel || 'No';
  const paymentMonthLabel = formatMonth(paymentMonth, normalizedLanguage);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    setAmount(pendingPayment != null && pendingPayment !== '' ? String(pendingPayment) : '');
    setComments('');
    setPaymentMethodId('');
    setFormError('');
    setFileError('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadMethods = async () => {
      setIsLoadingMethods(true);

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
        const options = extractArrayFromPayload(payload).map((item, index) =>
          normalizeCatalogOption(item, index),
        );
        setMethodOptions(options);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Payment methods fetch error', error);
          if (isMounted) {
            setMethodOptions([]);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoadingMethods(false);
        }
      }
    };

    loadMethods();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, normalizedLanguage, token, logout, pendingPayment]);

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    onClose?.();
  }, [isSubmitting, onClose]);

  const handleAmountChange = useCallback((event) => {
    const { value } = event.target;
    if (value === '' || /^\d*(\.\d{0,2})?$/.test(value)) {
      setAmount(value);
    }
  }, []);

  const handleCommentsChange = useCallback((event) => {
    setComments(event.target.value);
  }, []);

  const handleMethodChange = useCallback((event) => {
    setPaymentMethodId(event.target.value);
  }, []);

  const handleFileSelection = useCallback(
    (file) => {
      if (!file) {
        setSelectedFile(null);
        setFileError('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(mergedStrings.fileSizeError);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setFileError('');
      setSelectedFile(file);
    },
    [mergedStrings.fileSizeError],
  );

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      handleFileSelection(file);
    },
    [handleFileSelection],
  );

  const handleRemoveFile = useCallback(
    (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      handleFileSelection(null);
    },
    [handleFileSelection],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingFile(false);
      const file = event.dataTransfer?.files?.[0];
      handleFileSelection(file);
    },
    [handleFileSelection],
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (isSubmitting) {
        return;
      }

      if (!paymentRequestId || !paymentMethodId || amount === '') {
        setFormError(mergedStrings.requiredField);
        return;
      }

      setFormError('');
      setIsSubmitting(true);

      try {
        const payload = {
          payment_request_id: Number(paymentRequestId),
          payment_concept_id:
            paymentConceptId != null && paymentConceptId !== '' ? Number(paymentConceptId) : undefined,
          payment_month: paymentMonth || undefined,
          payment_through_id: Number(paymentMethodId),
          amount: Number(amount),
          comments: comments || '',
        };

        const sanitizedPayload = Object.fromEntries(
          Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''),
        );

        const formData = new FormData();
        formData.append('request', new Blob([JSON.stringify(sanitizedPayload)], { type: 'application/json' }));

        if (selectedFile) {
          formData.append('receipt', selectedFile, selectedFile.name);
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
        handleClose();
      } catch (error) {
        console.error('Create payment from request error', error);
        setFormError(error instanceof Error && error.message ? error.message : mergedStrings.error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      amount,
      comments,
      handleClose,
      isSubmitting,
      logout,
      mergedStrings.error,
      mergedStrings.requiredField,
      mergedStrings.success,
      normalizedLanguage,
      onSuccess,
      paymentConceptId,
      paymentMethodId,
      paymentMonth,
      paymentRequestId,
      selectedFile,
      token,
    ],
  );

  if (!isOpen) {
    return null;
  }

  const modalTitleId = 'payment-request-payment-modal-title';
  const modalDescriptionId = 'payment-request-payment-modal-description';

  return (
    <>
      <div className="modal-backdrop fade show" onClick={handleClose} />
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        aria-describedby={modalDescriptionId}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="modal-dialog modal-dialog-scrollable modal-lg modal-dialog-centered">
          <form className="modal-content border-0 shadow" onSubmit={handleSubmit}>
            <div className="modal-header">
              <div>
                <h2 id={modalTitleId} className="modal-title h4 mb-1">
                  {mergedStrings.title}
                </h2>
                <p id={modalDescriptionId} className="text-muted mb-0">
                  {mergedStrings.description}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={handleClose} aria-label={mergedStrings.cancel} />
            </div>

            <div className="modal-body payment-request-payment-modal__body">
              <div className="payment-request-payment-modal__summary">
                {paymentMonthLabel ? (
                  <div className="payment-request-payment-modal__summary-item">
                    <span>{mergedStrings.monthLabel}</span>
                    <strong>{paymentMonthLabel}</strong>
                  </div>
                ) : null}
                <div className="payment-request-payment-modal__summary-item">
                  <span>{mergedStrings.conceptLabel}</span>
                  <strong>{paymentRequest?.pt_name ?? '—'}</strong>
                </div>
                <div className="payment-request-payment-modal__summary-item">
                  <span>{mergedStrings.partialLabel}</span>
                  <strong>{partialPaymentLabel}</strong>
                </div>
                <div className="payment-request-payment-modal__summary-item">
                  <span>{mergedStrings.pendingLabel}</span>
                  <strong className="payment-request-payment-modal__summary-amount">{pendingAmountLabel || '—'}</strong>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label" htmlFor="payment-request-payment-amount">
                    {mergedStrings.amountLabel}
                  </label>
                  <input
                    id="payment-request-payment-amount"
                    type="text"
                    inputMode="decimal"
                    className="form-control"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="payment-request-payment-method">
                    {mergedStrings.methodLabel}
                  </label>
                  <select
                    id="payment-request-payment-method"
                    className="form-select"
                    value={paymentMethodId}
                    onChange={handleMethodChange}
                  >
                    <option value="">
                      {isLoadingMethods ? mergedStrings.methodLoading : mergedStrings.methodPlaceholder}
                    </option>
                    {methodOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="payment-request-payment-comments">
                    {mergedStrings.commentsLabel}
                  </label>
                  <textarea
                    id="payment-request-payment-comments"
                    className="form-control"
                    rows={3}
                    value={comments}
                    onChange={handleCommentsChange}
                  />
                </div>
                <div className="col-12">
                  <span className="form-label">{mergedStrings.attachmentLabel}</span>
                  <div
                    className={`payment-request-payment-modal__dropzone ${
                      isDraggingFile ? 'payment-request-payment-modal__dropzone--dragging' : ''
                    } ${selectedFile ? 'payment-request-payment-modal__dropzone--has-file' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <label htmlFor="payment-request-payment-file" className="payment-request-payment-modal__dropzone-label">
                      {selectedFile ? (
                        <>
                          <span className="payment-request-payment-modal__file-name">
                            {mergedStrings.attachmentSelected}: {selectedFile.name}
                          </span>
                          <span className="payment-request-payment-modal__file-actions">
                            <button type="button" className="btn btn-link p-0" onClick={handleRemoveFile}>
                              {mergedStrings.removeFile}
                            </button>
                          </span>
                        </>
                      ) : (
                        <span>{mergedStrings.attachmentHint}</span>
                      )}
                    </label>
                    <input
                      ref={fileInputRef}
                      id="payment-request-payment-file"
                      type="file"
                      className="payment-request-payment-modal__file-input"
                      onChange={handleFileChange}
                    />
                  </div>
                  {fileError ? <p className="payment-request-payment-modal__error">{fileError}</p> : null}
                </div>
              </div>

              {formError ? <p className="payment-request-payment-modal__error">{formError}</p> : null}
            </div>

            <div className="modal-footer payment-request-payment-modal__footer">
              <ActionButton type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
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

export default PaymentRequestPaymentModal;
