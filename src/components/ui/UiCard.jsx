import { forwardRef } from 'react';

const PADDING_CLASSNAMES = {
  none: 'ui-card--padding-none',
  sm: 'ui-card--padding-sm',
  md: 'ui-card--padding-md',
  lg: 'ui-card--padding-lg',
};

const SURFACE_CLASSNAMES = {
  raised: 'ui-card--raised',
  flat: 'ui-card--flat',
  outlined: 'ui-card--outlined',
};

const UiCard = forwardRef(
  (
    {
      as: Component = 'section',
      padding = 'lg',
      surface = 'raised',
      className = '',
      children,
      bodyClassName = '',
      ...props
    },
    ref,
  ) => {
    const classes = ['card', 'global-card', 'ui-card'];

    const paddingClass = PADDING_CLASSNAMES[padding] ?? PADDING_CLASSNAMES.lg;
    const surfaceClass = SURFACE_CLASSNAMES[surface] ?? SURFACE_CLASSNAMES.raised;

    classes.push(paddingClass, surfaceClass, 'border-0');

    if (className) {
      classes.push(className);
    }

    return (
      <Component ref={ref} className={classes.filter(Boolean).join(' ')} {...props}>
        <div className={["card-body", bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      </Component>
    );
  },
);

UiCard.displayName = 'UiCard';

export default UiCard;
