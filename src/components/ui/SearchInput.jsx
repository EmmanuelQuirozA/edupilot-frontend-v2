/**
 * @typedef {Object} SearchInputProps
 * @property {string | number} value
 * @property {(event: import('react').ChangeEvent<HTMLInputElement>) => void} onChange
 * @property {(event: import('react').FormEvent<HTMLFormElement>) => void} [onSubmit]
 * @property {string} [placeholder]
 * @property {string} [className]
 * @property {string} [inputClassName]
 * @property {import('react').ReactNode} [icon]
 * @property {Record<string, unknown>} [inputProps]
 * @property {Record<string, unknown>} [wrapperProps]
 */

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

/**
 * @param {SearchInputProps} props
 */
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

export default SearchInput;
