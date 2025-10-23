import { forwardRef } from 'react';
import ActionButton from '../ActionButton.jsx';

const DEFAULT_FILTER_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 5h16M7 12h10M10 19h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FilterButton = forwardRef(({ icon, className = '', ...props }, ref) => {
  const resolvedIcon = icon === undefined ? DEFAULT_FILTER_ICON : icon;
  const classes = ['ui-action-button', className].filter(Boolean).join(' ');

  return (
    <ActionButton
      ref={ref}
      variant="filter"
      icon={resolvedIcon}
      className={classes}
      {...props}
    />
  );
});

FilterButton.displayName = 'FilterButton';

export default FilterButton;
