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
  href,
  disabled = false,
  avatarText,
  avatarFallback = '??',
  className = '',
  nameButtonProps = {},
}) => {
  const hasName = typeof name === 'string' && name.trim() !== '';
  const displayName = hasName ? name.trim() : fallbackName;
  const computedInitials = getInitials(hasName ? name : '');
  const avatarContent = (avatarText ?? computedInitials) || avatarFallback;
  const wrapperClassName = ['table__student-wrapper', className].filter(Boolean).join(' ');
  const { className: ignoredClassName, type, disabled: customDisabled, ...restButtonProps } =
    nameButtonProps;
  const buttonClassName = ['table__student-button', ignoredClassName]
    .filter(Boolean)
    .join(' ');
  const isButtonDisabled = customDisabled ?? disabled;
  const linkHref = typeof href === 'string' && href.trim() ? href.trim() : undefined;

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

  if (typeof onClick === 'function' || linkHref) {
    return (
      <div className={wrapperClassName}>
        <span className="table__avatar" aria-hidden="true">
          {avatarContent}
        </span>
        <div className="table__student-info">
          {linkHref ? (
            <a
              href={linkHref}
              className={buttonClassName}
              aria-disabled={isButtonDisabled}
              onClick={isButtonDisabled ? (event) => event.preventDefault() : onClick}
              {...restButtonProps}
            >
              {displayName}
            </a>
          ) : (
            <button
              type={type ?? 'button'}
              className={buttonClassName}
              disabled={isButtonDisabled}
              {...restButtonProps}
              onClick={onClick}
            >
              {displayName}
            </button>
          )}
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

export default StudentInfo;
