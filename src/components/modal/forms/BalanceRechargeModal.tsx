import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { API_BASE_URL } from '../../../config.js';
import { handleExpiredToken } from '../../../utils/auth.js';
import ActionButton from '../../ui/ActionButton.jsx';
import UserBalanceSearchSelect from '../../students/UserBalanceSearchSelect.jsx';
import type { ModalComponentProps } from '../modalRegistry';
import './BalanceRechargeModal.css';

type StudentInfo = {
  fullName?: string | null;
  grade?: string | null;
  group?: string | null;
  scholarLevel?: string | null;
  balance?: number | string | null;
  registerId?: string | null;
};

type SelectedUser = {
  id: string;
  fullName: string;
  balance: number;
  role?: string;
  grade?: string | null;
  group?: string | null;
  scholarLevel?: string | null;
  registerId?: string | null;
};

const DEFAULT_STRINGS = {
  title: 'Añadir saldo a favor',
  description: 'Ingresa el monto que deseas abonar al saldo del alumno.',
  studentInfoTitle: 'Datos del alumno',
  nameLabel: 'Nombre',
  gradeLabel: 'Grado',
  groupLabel: 'Grupo',
  levelLabel: 'Nivel escolar',
  balanceLabel: 'Saldo actual',
  registerLabel: 'Matrícula',
  amountLabel: 'Monto a abonar',
  amountPlaceholder: '0.00',
  suggestionsLabel: 'Montos sugeridos',
  cancel: 'Cancelar',
  confirm: 'Confirmar recarga',
  confirmLoading: 'Procesando...',
  amountRequired: 'Ingresa un monto válido.',
  userRequired: 'Selecciona un alumno.',
  confirmTitle: 'Confirmar recarga',
  confirmText: '¿Deseas continuar con la recarga?',
  confirmButton: 'Sí, recargar',
  cancelButton: 'Cancelar',
  genericError: 'No fue posible registrar la recarga.',
};

const SUGGESTED_AMOUNTS = [50, 100, 200, 500];

const formatCurrency = (value: number | string | null | undefined) => {
  if (value == null || value === '') {
    return '0.00';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
};

const parseAmount = (value: string) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
};

const getSwalInstance = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const { Swal } = window as typeof window & { Swal?: { fire?: (...args: unknown[]) => unknown } };
  if (Swal && typeof Swal.fire === 'function') {
    return Swal;
  }

  return null;
};

const normalizeSelectedUser = (userId: string | number | null | undefined, info?: StudentInfo | null): SelectedUser | null => {
  if (!userId) {
    return null;
  }

  return {
    id: String(userId),
    fullName: info?.fullName ?? 'Alumno seleccionado',
    balance: Number(info?.balance ?? 0) || 0,
    grade: info?.grade ?? null,
    group: info?.group ?? null,
    scholarLevel: info?.scholarLevel ?? null,
    registerId: info?.registerId ?? null,
  };
};

const BalanceRechargeModal = ({
  instanceId,
  close,
  submit,
  token,
  logout,
  language = 'es',
  userId,
  studentInfo,
  strings = {},
}: ModalComponentProps<'BalanceRecharge'>) => {
  const mergedStrings = useMemo(() => ({ ...DEFAULT_STRINGS, ...strings }), [strings]);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(normalizeSelectedUser(userId ?? null, studentInfo));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedUser((current) => {
      if (current && current.id === String(userId ?? '')) {
        return {
          ...current,
          ...normalizeSelectedUser(userId ?? null, studentInfo),
        } as SelectedUser;
      }

      return normalizeSelectedUser(userId ?? null, studentInfo);
    });
  }, [studentInfo, userId]);

  const handleAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setAmount(event.target.value);
    setError('');
  }, []);

  const handleSuggestion = useCallback((value: number) => {
    setAmount(String(value));
    setError('');
  }, []);

  const handleUserSelect = useCallback((option: SelectedUser) => {
    setSelectedUser(option);
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    close();
  }, [close, isSubmitting]);

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (isSubmitting) {
        return;
      }

      if (!selectedUser) {
        setError(mergedStrings.userRequired);
        return;
      }

      const numericAmount = parseAmount(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setError(mergedStrings.amountRequired);
        return;
      }

      const swalInstance = getSwalInstance();
      if (swalInstance) {
        const confirmation = await swalInstance.fire({
          title: mergedStrings.confirmTitle,
          text: `${mergedStrings.confirmText}\n${formatCurrency(numericAmount)}`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: mergedStrings.confirmButton,
          cancelButtonText: mergedStrings.cancelButton,
        });

        if (!confirmation?.isConfirmed) {
          return;
        }
      } else if (!window.confirm(mergedStrings.confirmText)) {
        return;
      }

      try {
        setIsSubmitting(true);
        setError('');

        const response = await fetch(`${API_BASE_URL}/balances/recharge?lang=${language || 'es'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            amount: numericAmount,
          }),
        });

        if (!response.ok) {
          handleExpiredToken(response, logout);
        }

        const payload = await response.json();

        if (!response.ok || payload?.success === false) {
          const message = payload?.message || mergedStrings.genericError;
          setError(message);
          const swal = getSwalInstance();
          if (swal) {
            swal.fire({ icon: 'error', title: payload?.title || mergedStrings.genericError, text: message });
          }
          return;
        }

        const swal = getSwalInstance();
        if (swal) {
          swal.fire({ icon: payload?.type || 'success', title: payload?.title, text: payload?.message });
        }

        submit({
          userId: selectedUser.id,
          amount: numericAmount,
          newBalance: payload?.newBalance ?? payload?.new_balance ?? null,
          rechargeId: payload?.rechargeId ?? payload?.recharge_id ?? null,
        });
      } catch (requestError) {
        console.error('Failed to recharge balance', requestError);
        setError(mergedStrings.genericError);
        const swal = getSwalInstance();
        if (swal) {
          swal.fire({ icon: 'error', title: mergedStrings.genericError });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [amount, isSubmitting, language, logout, mergedStrings, selectedUser, submit, token],
  );

  const displayUser = useMemo(() => {
    if (selectedUser) {
      return selectedUser;
    }

    return normalizeSelectedUser(userId ?? null, studentInfo);
  }, [selectedUser, studentInfo, userId]);

  const modalTitleId = 'add-balance-modal-title';
  const modalDescriptionId = 'add-balance-modal-description';

  return (
    <>
      <div className="modal-backdrop fade show" onClick={handleClose} />
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        // aria-labelledby={modalTitleId}
        // aria-describedby={modalDescriptionId}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="modal-dialog modal-dialog-scrollable modal-lg modal-dialog-centered">
          <form className="modal-content border-0 shadow" onSubmit={handleSubmit} noValidate>
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
            {/* <header className="balance-recharge-modal__header">
              <h2 className="balance-recharge-modal__title" id={`${instanceId}-title`}>
                {mergedStrings.title}
              </h2>
              <p className="balance-recharge-modal__subtitle">{mergedStrings.subtitle}</p>
            </header> */}

            <div className="modal-body">
              <section className="balance-recharge-modal__body">
                {!userId ? (
                <UserBalanceSearchSelect
                  id={`${instanceId}-user`}
                  token={token}
                  logout={logout}
                  language={language}
                  selectedUser={selectedUser as never}
                  onSelect={handleUserSelect as never}
                />
              ) : null}

                {displayUser ? (
                  <div className="balance-recharge-modal__student-card">
                    <p className="balance-recharge-modal__student-title">{mergedStrings.studentInfoTitle}</p>
                    <div className="row g-3">
                      <div className='col-md-6'>
                        <p className="balance-recharge-modal__student-label">{mergedStrings.nameLabel}</p>
                        <p className="balance-recharge-modal__student-value">{displayUser.fullName}</p>
                      </div>
                      {displayUser.registerId ? (
                        <div className='col-md-6'>
                          <p className="balance-recharge-modal__student-label">{mergedStrings.registerLabel}</p>
                          <p className="balance-recharge-modal__student-value">{displayUser.registerId}</p>
                        </div>
                      ) : null}
                      {displayUser.grade ? (
                        <div className='col-md-6'>
                          <p className="balance-recharge-modal__student-label">{mergedStrings.gradeLabel}</p>
                          <p className="balance-recharge-modal__student-value">{displayUser.grade}</p>
                        </div>
                      ) : null}
                      {displayUser.group ? (
                        <div className='col-md-6'>
                          <p className="balance-recharge-modal__student-label">{mergedStrings.groupLabel}</p>
                          <p className="balance-recharge-modal__student-value">{displayUser.group}</p>
                        </div>
                      ) : null}
                      {displayUser.scholarLevel ? (
                        <div className='col-md-6'>
                          <p className="balance-recharge-modal__student-label">{mergedStrings.levelLabel}</p>
                          <p className="balance-recharge-modal__student-value">{displayUser.scholarLevel}</p>
                        </div>
                      ) : null}
                      <div className='col-md-6'>
                        <p className="balance-recharge-modal__student-label">{mergedStrings.balanceLabel}</p>
                        <p className="balance-recharge-modal__student-value">{formatCurrency(displayUser.balance)}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="balance-recharge-modal__amount-card">
                  <p className="balance-recharge-modal__amount-label">{mergedStrings.amountLabel}</p>
                  <div className="balance-recharge-modal__input">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder={mergedStrings.amountPlaceholder}
                      disabled={isSubmitting}
                      inputMode="decimal"
                    />
                    <span>MXN</span>
                  </div>
                  <div>
                    <p className="balance-recharge-modal__student-label" style={{ marginBottom: '6px' }}>
                      {mergedStrings.suggestionsLabel}
                    </p>
                    <div className="balance-recharge-modal__suggestions">
                      {SUGGESTED_AMOUNTS.map((value) => {
                        const isActive = parseAmount(amount) === value;
                        return (
                          <button
                            type="button"
                            key={value}
                            className={`balance-recharge-modal__suggestion ${isActive ? 'is-active' : ''}`}
                            onClick={() => handleSuggestion(value)}
                            disabled={isSubmitting}
                          >
                            {formatCurrency(value)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {error ? <p className="balance-recharge-modal__error">{error}</p> : null}
                </div>
              </section>
            </div>

            <footer className="balance-recharge-modal__footer">
              <div className="balance-recharge-modal__actions">
                {/* <ActionButton label={mergedStrings.cancel} variant="ghost" onClick={handleClose} disabled={isSubmitting} />
                <ActionButton
                  label={isSubmitting ? mergedStrings.confirmLoading : mergedStrings.confirm}
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                /> */}

              <ActionButton type="button" variant="text" onClick={handleClose} disabled={isSubmitting}>
                {mergedStrings.cancel}
              </ActionButton>
              <ActionButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? mergedStrings.confirmLoading : mergedStrings.confirm}
              </ActionButton>
              </div>
            </footer>
          </form>
        </div>
      </div>
      </>
  );
};

export default BalanceRechargeModal;
