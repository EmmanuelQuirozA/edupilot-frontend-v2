import PropTypes from 'prop-types';

const DefaultIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="search-input__svg">
    <path
      d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SearchInput = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = '',
  inputClassName = '',
  icon = DefaultIcon,
  inputProps = {},
  wrapperProps = {},
}) => {
  const Wrapper = onSubmit ? 'form' : 'div';

  const { className: wrapperClassName = '', onSubmit: wrapperOnSubmit, ...restWrapperProps } = wrapperProps;
  const { className: inputClassNameProp = '', ...restInputProps } = inputProps;

  const handleSubmit = (event) => {
    if (onSubmit) {
      event.preventDefault();
      onSubmit(event);
    }

    wrapperOnSubmit?.(event);
  };

  return (
    <Wrapper
      className={["search-input", className, wrapperClassName].filter(Boolean).join(' ')}
      onSubmit={handleSubmit}
      {...restWrapperProps}
    >
      <span className="search-input__icon" aria-hidden="true">
        {icon}
      </span>
      <input
        type="search"
        className={["form-control search-input__field", inputClassName, inputClassNameProp]
          .filter(Boolean)
          .join(' ')}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...restInputProps}
      />
    </Wrapper>
  );
};

SearchInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  icon: PropTypes.node,
  inputProps: PropTypes.object,
  wrapperProps: PropTypes.object,
};

export default SearchInput;
