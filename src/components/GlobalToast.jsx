const TOAST_VARIANTS = {
  success: { toast: 'text-bg-success border-0', close: 'btn-close-white' },
  error: { toast: 'text-bg-danger border-0', close: 'btn-close-white' },
  info: { toast: 'text-bg-info border-0', close: '' },
  warning: { toast: 'text-bg-warning border-0', close: '' },
};

const GlobalToast = ({ alert, onClose = () => {} }) => {
  if (!alert) {
    return null;
  }

  const { type = 'info', message = '', closeLabel = 'Cerrar' } = alert;
  const variant = TOAST_VARIANTS[type] ?? TOAST_VARIANTS.info;
  const closeButtonClassName = ['btn-close', 'me-2', 'm-auto', variant.close]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 1090 }}>
      <div
        className={`toast show align-items-center ${variant.toast}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="d-flex">
          <div className="toast-body">{message}</div>
          <button
            type="button"
            className={closeButtonClassName}
            data-bs-dismiss="toast"
            aria-label={closeLabel}
            onClick={onClose}
          ></button>
        </div>
      </div>
    </div>
  );
};

export default GlobalToast;
