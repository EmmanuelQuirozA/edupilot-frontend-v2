import PropTypes from 'prop-types';

const getInitials = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

const StudentInfo = ({
  name,
  fallbackName = '—',
  metaLabel,
  metaValue,
  onClick,
  disabled = false,
  avatarText,
  avatarFallback = '??',
  className = '',
  nameButtonProps = {},
}) => {
  const hasName = typeof name === 'string' && name.trim() !== '';
  const displayName = hasName ? name.trim() : fallbackName;
  const computedInitials = getInitials(hasName ? name : '');
  const avatarContent = avatarText ?? computedInitials || avatarFallback;
  const wrapperClassName = ['table__student-wrapper', className].filter(Boolean).join(' ');
  const { className: ignoredClassName, type, disabled: customDisabled, ...restButtonProps } =
    nameButtonProps;
  const buttonClassName = ['table__student-button', ignoredClassName]
    .filter(Boolean)
    .join(' ');
  const isButtonDisabled = customDisabled ?? disabled;

  const renderMeta = () => {
    if (metaValue == null || metaValue === '') {
      return null;
    }

    if (metaLabel) {
      return (
        <span className="table__student-meta">
          {metaLabel}
          {' '}
          <strong>{metaValue}</strong>
        </span>
      );
    }

    return <span className="table__student-meta">{metaValue}</span>;
  };

  if (typeof onClick === 'function') {
    return (
      <div className={wrapperClassName}>
        <span className="table__avatar" aria-hidden="true">
          {avatarContent}
        </span>
        <div className="table__student-info">
          <button
            type={type ?? 'button'}
            className={buttonClassName}
            disabled={isButtonDisabled}
            {...restButtonProps}
            onClick={onClick}
          >
            {displayName}
          </button>
          {renderMeta()}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClassName}>
      <span className="table__avatar" aria-hidden="true">
        {avatarContent}
      </span>
      <div className="table__student-info">
        <span className="table__student-name">{displayName}</span>
        {renderMeta()}
      </div>
    </div>
  );
};

StudentInfo.propTypes = {
  name: PropTypes.string,
  fallbackName: PropTypes.string,
  metaLabel: PropTypes.string,
  metaValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  avatarText: PropTypes.string,
  avatarFallback: PropTypes.string,
  className: PropTypes.string,
  nameButtonProps: PropTypes.object,
};

export default StudentInfo;
