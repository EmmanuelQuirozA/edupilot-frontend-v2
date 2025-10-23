import { forwardRef } from 'react';

const TableContainer = forwardRef(({ className = '', children, ...props }, ref) => (
  <div ref={ref} className={['ui-table__container', className].filter(Boolean).join(' ')} {...props}>
    {children}
  </div>
));

TableContainer.displayName = 'TableContainer';

const Table = forwardRef(({ className = '', children, ...props }, ref) => (
  <table ref={ref} className={['ui-table', className].filter(Boolean).join(' ')} {...props}>
    {children}
  </table>
));

Table.displayName = 'Table';

const TableEmptyState = ({ colSpan = 1, message, icon }) => (
  <tr>
    <td colSpan={colSpan} className="ui-table__empty">
      {icon ? <span className="ui-table__empty-icon" aria-hidden="true">{icon}</span> : null}
      {message}
    </td>
  </tr>
);

export { Table, TableContainer, TableEmptyState };
