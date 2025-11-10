import { useEffect } from 'react';

/**
 * @typedef {Object} FiltersModalResetAction
 * @property {import('react').ReactNode} label
 * @property {(event: import('react').MouseEvent<HTMLButtonElement>) => void} onClick
 */

/**
 * @typedef {Object} FiltersModalProps
 * @property {boolean} isOpen
 * @property {() => void} [onClose]
 * @property {import('react').ReactNode} title
 * @property {import('react').ReactNode} [description]
 * @property {import('react').ReactNode} [children]
 * @property {import('react').ReactNode} [headerActions]
 * @property {import('react').ReactNode} [footer]
 * @property {FiltersModalResetAction} [resetAction]
 * @property {'sm' | 'md' | 'lg'} [size]
 * @property {string} [bodyClassName]
 * @property {string} [dialogClassName]
 * @property {string} [contentClassName]
 * @property {string} [id]
 * @property {string} [closeAriaLabel]
 */

/**
 * @param {FiltersModalProps} props
 */
const FiltersModal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  headerActions,
  footer,
  resetAction,
  size = 'md',
  bodyClassName = '',
  dialogClassName = '',
  contentClassName = '',
  id,
  closeAriaLabel = 'Cerrar',
}) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    const previousOverflow = document.body.style.overflow;
    const hadModalOpenClass = document.body.classList.contains('modal-open');

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      if (!hadModalOpenClass) {
        document.body.classList.remove('modal-open');
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  const labelledBy = id ? `${id}-title` : undefined;
  const describedBy = description && id ? `${id}-description` : undefined;

  const sizeClassName = size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : '';

  return (
    <>
      <div
        className="modal fade show"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        style={{ display: 'block' }}
        onClick={handleBackdropClick}
        id={id}
        tabIndex={-1}
      >
        <div
          className={[
            'modal-dialog',
            'modal-dialog-scrollable',
            sizeClassName,
            dialogClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div
            className={['modal-content', contentClassName].filter(Boolean).join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="me-auto">
                <h2 id={labelledBy} className="modal-title fs-5 mb-0">
                  {title}
                </h2>
                {description ? (
                  <p id={describedBy} className="text-muted mb-0 mt-2">
                    {description}
                  </p>
                ) : null}
              </div>
              <div className="d-flex align-items-center gap-3">
                {resetAction ? (
                  <button
                    type="button"
                    className="btn btn-link text-decoration-none sidebar-modal__reset"
                    onClick={(event) => {
                      event.preventDefault();
                      resetAction.onClick(event);
                    }}
                  >
                    {resetAction.label}
                  </button>
                ) : null}
                {headerActions}
                <button
                  type="button"
                  className="btn-close"
                  onClick={onClose}
                  aria-label={closeAriaLabel}
                />
              </div>
            </div>
            <div className={['modal-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" />
    </>
  );
};

export default FiltersModal;
