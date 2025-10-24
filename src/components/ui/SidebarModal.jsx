import { useEffect } from 'react';
import PropTypes from 'prop-types';

const SidebarModal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = '',
  headerActions,
  footer,
  resetAction,
  size = 'md',
  bodyClassName = '',
  id,
}) => {
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

  return (
    <div className="sidebar-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      <div className="sidebar-modal__backdrop" aria-hidden="true" onClick={handleBackdropClick} />
      <aside
        className={["sidebar-modal__panel offcanvas offcanvas-end show", `sidebar-modal__panel--${size}`, className]
          .filter(Boolean)
          .join(' ')}
        id={id}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="offcanvas-header border-bottom">
          <div className="me-auto">
            <h2 id={labelledBy} className="offcanvas-title mb-1">
              {title}
            </h2>
            {description ? (
              <p id={describedBy} className="text-muted mb-0">
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
            <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
          </div>
        </div>
        <div className={["offcanvas-body", bodyClassName].filter(Boolean).join(' ')}>{children}</div>
        {footer ? <div className="offcanvas-footer border-top pt-3 pb-3 px-3">{footer}</div> : null}
      </aside>
    </div>
  );
};

SidebarModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  headerActions: PropTypes.node,
  footer: PropTypes.node,
  resetAction: PropTypes.shape({
    label: PropTypes.node.isRequired,
    onClick: PropTypes.func.isRequired,
  }),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  bodyClassName: PropTypes.string,
  id: PropTypes.string,
};

export default SidebarModal;
