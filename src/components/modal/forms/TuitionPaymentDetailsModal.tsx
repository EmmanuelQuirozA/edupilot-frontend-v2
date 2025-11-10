import { useMemo } from 'react';
import ActionButton from '../../ui/ActionButton.jsx';
import type { ModalComponentProps } from '../modalRegistry';
import './TuitionPaymentDetailsModal.css';

const formatPaymentMonth = (paymentMonth: string | null | undefined, locale: string, fallback: string) => {
  if (typeof paymentMonth !== 'string' || paymentMonth.trim() === '') {
    return fallback;
  }

  const normalized = paymentMonth.replace(/_/g, '-').trim();
  const [yearPart, monthPart] = normalized.split(/[-/]/);
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;

  if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
    return fallback;
  }

  const date = new Date(year, monthIndex, 1);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const formatted = formatter.format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatPaymentDate = (rawDate: string | null | undefined, locale: string) => {
  if (typeof rawDate !== 'string' || rawDate.trim() === '') {
    return null;
  }

  const normalized = rawDate.replace(/_/g, '-').trim();
  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' });
  return formatter.format(new Date(timestamp));
};

const TuitionPaymentDetailsModal = ({
  instanceId,
  close,
  studentName,
  className,
  generation,
  scholarLevel,
  monthKey,
  paymentMonth,
  totalAmount,
  paymentRequestId,
  payments,
  locale,
  currency = 'MXN',
  strings,
  paymentDetailBasePath,
  paymentRequestDetailBasePath,
}: ModalComponentProps<'TuitionPaymentDetails'>) => {
  const monthLabel = useMemo(
    () => formatPaymentMonth(paymentMonth, locale, monthKey),
    [locale, monthKey, paymentMonth],
  );

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency }),
    [currency, locale],
  );

  const summaryItems = useMemo(() => {
    const items: Array<{ label: string; value: string | null; className?: string } & { actions?: JSX.Element | null }> = [
      { label: strings.summary.student, value: studentName || null },
      { label: strings.summary.class, value: className || null },
      { label: strings.summary.generation, value: generation || null },
      { label: strings.summary.level, value: scholarLevel || null },
      { label: strings.summary.month, value: monthLabel || null },
      {
        label: strings.summary.total,
        value: totalAmount != null ? currencyFormatter.format(totalAmount) : null,
      },
    ];

    if (paymentRequestId != null && paymentRequestId !== '') {
      const requestUrl = paymentRequestDetailBasePath
        ? `${paymentRequestDetailBasePath}?payment_request_id=${encodeURIComponent(String(paymentRequestId))}`
        : null;

      items.push({
        label: strings.summary.request,
        value: requestUrl ? String(paymentRequestId) : String(paymentRequestId) || null,
        actions:
          requestUrl != null ? (
            <ActionButton
              as="a"
              href={requestUrl}
              variant="secondary"
              size="sm"
              className="tuition-payment-modal__request-button"
            >
              {strings.requestButton}
            </ActionButton>
          ) : null,
      });
    }

    return items;
  }, [
    strings.summary,
    studentName,
    className,
    generation,
    scholarLevel,
    monthLabel,
    totalAmount,
    currencyFormatter,
    paymentRequestId,
    paymentRequestDetailBasePath,
    strings.requestButton,
  ]);

  const paymentsContent = useMemo(() => {
    if (!payments || payments.length === 0) {
      return (
        <p className="tuition-payment-modal__empty" role="status">
          {strings.paymentsTable.empty}
        </p>
      );
    }

    return (
      <table className="tuition-payment-modal__table">
        <thead>
          <tr>
            <th scope="col">{strings.paymentsTable.columns.id}</th>
            <th scope="col">{strings.paymentsTable.columns.date}</th>
            <th scope="col">{strings.paymentsTable.columns.amount}</th>
            <th scope="col">{strings.paymentsTable.columns.status}</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const paymentId = payment.paymentId != null && payment.paymentId !== ''
              ? String(payment.paymentId)
              : null;
            const paymentUrl = paymentId
              ? `${paymentDetailBasePath}/${encodeURIComponent(paymentId)}`
              : null;
            const formattedAmount =
              payment.amount != null ? currencyFormatter.format(payment.amount) : '--';
            const formattedDate = formatPaymentDate(payment.createdAt, locale) ?? '--';
            const status = payment.statusName && payment.statusName.trim() !== '' ? payment.statusName : '--';

            return (
              <tr key={paymentId ?? `${formattedDate}-${formattedAmount}`}>
                <td data-title={strings.paymentsTable.columns.id}>
                  {paymentUrl ? (
                    <a
                      className="tuition-payment-modal__payment-link"
                      href={paymentUrl}
                      aria-label={`${strings.paymentsTable.paymentLinkLabel} ${paymentId}`}
                    >
                      {paymentId}
                    </a>
                  ) : (
                    <span>{paymentId ?? '--'}</span>
                  )}
                </td>
                <td data-title={strings.paymentsTable.columns.date}>{formattedDate}</td>
                <td data-title={strings.paymentsTable.columns.amount}>{formattedAmount}</td>
                <td data-title={strings.paymentsTable.columns.status}>{status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }, [
    payments,
    strings.paymentsTable,
    currencyFormatter,
    paymentDetailBasePath,
    locale,
  ]);

  const modalTitleId = `${instanceId}-title`;
  const hasMonthDescription = monthLabel != null && monthLabel.trim() !== '';
  const modalDescriptionId = hasMonthDescription ? `${instanceId}-description` : undefined;

  return (
    <div
      className="modal-content border-0 shadow tuition-payment-modal__content"
      role="document"
      aria-labelledby={modalTitleId}
      aria-describedby={modalDescriptionId}
    >
      <div className="modal-header align-items-start">
        <div>
          <h2 className="modal-title h4 mb-1" id={modalTitleId}>
            {strings.title}
          </h2>
          {hasMonthDescription ? (
            <p id={modalDescriptionId} className="text-muted mb-0">
              {monthLabel}
            </p>
          ) : null}
        </div>
        <button type="button" className="btn-close" aria-label={strings.close} onClick={close} />
      </div>
      <div className="modal-body tuition-payment-modal__body" aria-live="polite">
        <dl className="tuition-payment-modal__summary">
          {summaryItems.map((item) => (
            <div key={item.label} className="tuition-payment-modal__summary-item">
              <dt>{item.label}</dt>
              <dd>
                {item.value ?? '--'}
                {item.actions}
              </dd>
            </div>
          ))}
        </dl>
        <div className="tuition-payment-modal__payments">
          <h3 className="tuition-payment-modal__subtitle">{strings.paymentsTitle}</h3>
          {paymentsContent}
        </div>
      </div>
      <div className="modal-footer">
        <ActionButton type="button" variant="text" onClick={close}>
          {strings.close}
        </ActionButton>
      </div>
    </div>
  );
};

export default TuitionPaymentDetailsModal;
