import { forwardRef } from 'react';
import ActionButton from '../ActionButton.jsx';

const DEFAULT_EDIT_ICON = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M3 16.75V19h2.25l8.9-8.9-2.25-2.25Zm12.87-7.4a.75.75 0 0 0 0-1.06l-1.16-1.16a.75.75 0 0 0-1.06 0l-1.04 1.04 2.22 2.22Z" />
  </svg>
);

const EditRecordButton = forwardRef(
  ({ icon, className = '', variant = 'outline', ...props }, ref) => {
    const resolvedIcon = icon === undefined ? DEFAULT_EDIT_ICON : icon;
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
  },
);

EditRecordButton.displayName = 'EditRecordButton';

export default EditRecordButton;
