import { forwardRef } from 'react';
import ActionButton from '../ActionButton.jsx';

const DEFAULT_ADD_ICON = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path
      d="M10 3v14M3 10h14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AddRecordButton = forwardRef(({ icon, className = '', variant = 'primary', ...props }, ref) => {
  const resolvedIcon = icon === undefined ? DEFAULT_ADD_ICON : icon;
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

AddRecordButton.displayName = 'AddRecordButton';

export default AddRecordButton;
