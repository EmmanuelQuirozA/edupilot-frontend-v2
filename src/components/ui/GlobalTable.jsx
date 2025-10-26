import { Fragment, useMemo } from 'react';

/**
 * @param {Object} props
 * @param {Array<{
 *  key: string,
 *  header?: React.ReactNode,
 *  label?: React.ReactNode,
 *  accessor?: string,
 *  render?: (item: any, index: number) => React.ReactNode,
 *  cellClassName?: string,
 *  headerClassName?: string,
 *  align?: 'start' | 'center' | 'end' | 'left' | 'right'
 * }>} props.columns
 * @param {Array<any>} props.data
 * @param {(item: any, index: number) => string | number} [props.getRowId]
 * @param {(item: any, index: number) => React.ReactNode} [props.renderRow]
 * @param {boolean} [props.loading]
 * @param {React.ReactNode} [props.loadingMessage]
 * @param {string | { message?: string }} [props.error]
 * @param {React.ReactNode} [props.emptyMessage]
 * @param {string} [props.className]
 * @param {string} [props.tableClassName]
 * @param {boolean} [props.responsive]
 * @param {{
 *  currentPage?: number,
 *  pageSize?: number,
 *  totalItems?: number,
 *  onPageChange?: (page: number) => void,
 *  previousLabel?: React.ReactNode,
 *  nextLabel?: React.ReactNode,
 *  summary?: (info: { from: number, to: number, total: number, page: number, totalPages: number }) => React.ReactNode,
 *  pageLabel?: (info: { page: number, totalPages: number }) => React.ReactNode,
 * }} [props.pagination]
 * @param {React.ReactNode} [props.footer]
 */
const GlobalTable = ({
  columns,
  data,
  getRowId,
  renderRow,
  loading = false,
  loadingMessage = 'Cargando...',
  error = null,
  emptyMessage = 'Sin registros.',
  className = '',
  tableClassName = '',
  responsive = true,
  pagination,
  footer,
}) => {
  const colCount = columns?.length ?? 1;

  const tableBody = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan={colCount} className="global-table__state text-center py-5">
            <div className="spinner-border text-primary" role="status" aria-hidden="true" />
            <span className="d-block mt-3">{loadingMessage}</span>
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td colSpan={colCount} className="global-table__state text-center py-4">
            {typeof error === 'string' ? error : error.message}
          </td>
        </tr>
      );
    }

    if (!data || data.length === 0) {
      return (
        <tr>
          <td colSpan={colCount} className="global-table__state text-center py-4">
            {emptyMessage}
          </td>
        </tr>
      );
    }

    if (renderRow) {
      return data.map((item, index) => (
        <Fragment key={getRowId ? getRowId(item, index) : index}>{renderRow(item, index)}</Fragment>
      ));
    }

    return data.map((item, index) => {
      const key = getRowId ? getRowId(item, index) : index;

      return (
        <tr key={key}>
          {columns.map((column) => {
            const value = column.render ? column.render(item, index) : item[column.accessor ?? column.key];
            const dataTitle = column.header ?? column.label ?? column.key;
            const cellClassName = [
              'global-table__cell',
              column.cellClassName,
              column.align ? `text-${column.align}` : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <td key={column.key} className={cellClassName} data-title={dataTitle}>
                {value ?? <span className="text-muted">--</span>}
              </td>
            );
          })}
        </tr>
      );
    });
  }, [colCount, data, emptyMessage, error, getRowId, loading, loadingMessage, renderRow, columns]);

  const tableElement = (
    <table className={["table align-middle global-table__table", tableClassName].filter(Boolean).join(' ')}>
      {columns && (
        <thead className="global-table__head">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.headerClassName}>
                {column.header ?? column.label}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody className="global-table__body">{tableBody}</tbody>
    </table>
  );

  const content = responsive ? <div className="table-responsive">{tableElement}</div> : tableElement;

  const renderPagination = () => {
    if (!pagination) {
      return null;
    }

    const {
      currentPage = 1,
      pageSize = 10,
      totalItems = 0,
      onPageChange,
      previousLabel,
      nextLabel,
      summary,
      pageLabel,
    } =
      pagination;

    const totalPages = Math.max(1, Math.ceil(totalItems / (pageSize || 1)));
    const hasItems = totalItems > 0;
    const safePage = Math.min(Math.max(currentPage, 1), totalPages);

    const from = hasItems ? (safePage - 1) * pageSize + 1 : 0;
    const to = hasItems ? Math.min(safePage * pageSize, totalItems) : 0;

    const summaryContent = summary
      ? summary({ from, to, total: totalItems, page: safePage, totalPages })
      : hasItems
      ? `Mostrando ${from}-${to} de ${totalItems} registros`
      : 'Mostrando 0 de 0 registros';

    const handlePageChange = (nextPage) => {
      if (nextPage < 1 || nextPage > totalPages || nextPage === safePage) {
        return;
      }

      onPageChange?.(nextPage);
    };

    return (
      <div className="py-2 px-4 d-flex flex-column flex-lg-row align-lg-center justify-content-between">
        <div className="global-table__summary text-muted">{summaryContent}</div>
        <nav aria-label="Table pagination">
          <ul className="pagination justify-content-lg-end mb-0">
            <li className={`page-item ${safePage <= 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(safePage - 1)}
                aria-label={previousLabel ?? 'Página anterior'}
              >
                {previousLabel ?? '←'}
              </button>
            </li>
            <li className="page-item disabled">
              <span className="page-link">
                {pageLabel ? pageLabel({ page: safePage, totalPages }) : `${safePage} / ${totalPages}`}
              </span>
            </li>
            <li className={`page-item ${safePage >= totalPages ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => handlePageChange(safePage + 1)}
                aria-label={nextLabel ?? 'Página siguiente'}
              >
                {nextLabel ?? '→'}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  };

  return (
    <div className={["global-table", className].filter(Boolean).join(' ')}>
      {content}
      {footer}
      {renderPagination()}
    </div>
  );
};

export default GlobalTable;
