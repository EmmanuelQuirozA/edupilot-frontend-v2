import { forwardRef } from 'react';
import ActionButton from '../ActionButton.jsx';

const DEFAULT_EXPORT_ICON = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M10 3v8m0 0 3-3m-3 3-3-3M4 12v4h12v-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const ExportButton = forwardRef(({ icon, className = '', variant = 'outline', ...props }, ref) => {
  const resolvedIcon = icon === undefined ? DEFAULT_EXPORT_ICON : icon;
  const classes = ['ui-action-button', className].filter(Boolean).join(' ');

  return (
    <ActionButton
      ref={ref}
      variant={variant}
      icon={resolvedIcon}
      className={classes}
      {...props}
    />
  );
});

ExportButton.displayName = 'ExportButton';

export default ExportButton;
