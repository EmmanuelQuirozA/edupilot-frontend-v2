import { forwardRef } from 'react';

const VARIANT_CLASSNAMES = {
  primary: 'ui-button--primary',
  secondary: 'ui-button--secondary',
  danger: 'ui-button--danger',
  warning: 'ui-button--warning',
  success: 'ui-button--success',
  ghost: 'ui-button--ghost',
  outline: 'ui-button--outline',
  filter: 'ui-button--filter',
  upload: 'ui-button--upload',
  text: 'ui-button--text',
};

const SIZE_CLASSNAMES = {
  sm: 'ui-button--sm',
  md: 'ui-button--md',
  lg: 'ui-button--lg',
  icon: 'ui-button--icon-only',
};

const ActionButton = forwardRef(
  (
    {
      as: Component = 'button',
      type,
      variant = 'primary',
      size = 'md',
      icon,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const classes = ['ui-button'];

    const variantClass = VARIANT_CLASSNAMES[variant] ?? VARIANT_CLASSNAMES.primary;
    const sizeClass = SIZE_CLASSNAMES[size] ?? SIZE_CLASSNAMES.md;

    classes.push(variantClass, sizeClass);

    if (className) {
      classes.push(className);
    }

    const resolvedProps = { ...props, ref };
    const isButtonElement = Component === 'button' || Component === undefined;

    if (isButtonElement) {
      resolvedProps.type = type ?? 'button';
    }

    const content = [];

    if (icon) {
      content.push(
        <span key="icon" className="ui-button__icon" aria-hidden="true">
          {icon}
        </span>,
      );
    }

    if (children !== null && children !== undefined && children !== false) {
      content.push(
        <span key="label" className="ui-button__label">
          {children}
        </span>,
      );
    }

    return (
      <Component className={classes.filter(Boolean).join(' ')} {...resolvedProps}>
        {content}
      </Component>
    );
  },
);

ActionButton.displayName = 'ActionButton';

export default ActionButton;
