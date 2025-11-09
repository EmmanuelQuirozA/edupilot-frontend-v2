import { Fragment, useEffect } from 'react';
import { useModalContext, type ModalInstance } from './ModalContext';
import {
  modalRegistry,
  type ModalKey,
  type ModalComponentProps,
  type ModalResultByKey,
} from './modalRegistry';
import './modalStyles.css';

type CloseModalHandler = (instanceId: string) => void;

type ResolveModalHandler = <K extends ModalKey>(instanceId: string, value: ModalResultByKey<K>) => void;

const renderInstance = <K extends ModalKey>(
  instance: ModalInstance<K>,
  closeModal: CloseModalHandler,
  resolveModal: ResolveModalHandler,
) => {
  const definition = modalRegistry[instance.key];
  if (!definition) {
    return null;
  }
  const Component = definition.Component;
  const presentation = definition.presentation ?? 'custom';
  const containerClassName = definition.containerClassName
    ? `modal-container ${definition.containerClassName}`
    : 'modal-container';
  const componentProps = (instance.props ?? {}) as Omit<ModalComponentProps<K>, 'close' | 'submit' | 'instanceId'>;

  const handleClose = () => closeModal(instance.instanceId);
  const handleSubmit = (value: ModalResultByKey<K>) => {
    resolveModal(instance.instanceId, value);
  };

  if (presentation === 'bootstrap') {
    const modalClassName = definition.modalClassName
      ? `modal fade show d-block ${definition.modalClassName}`
      : 'modal fade show d-block';
    const dialogClassName = definition.dialogClassName
      ? `modal-dialog ${definition.dialogClassName}`
      : 'modal-dialog';

    return (
      <Fragment key={instance.instanceId}>
        <div className="modal-backdrop fade show" />
        <div
          className={modalClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${instance.instanceId}-title`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleClose();
            }
          }}
        >
          <div className={dialogClassName}>
            <Component
              {...componentProps}
              instanceId={instance.instanceId}
              close={handleClose}
              submit={handleSubmit}
            />
          </div>
        </div>
      </Fragment>
    );
  }

  return (
    <div className="modal-overlay" key={instance.instanceId}>
      <div
        className={containerClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${instance.instanceId}-title`}
      >
        <Component
          {...componentProps}
          instanceId={instance.instanceId}
          close={handleClose}
          submit={handleSubmit}
        />
      </div>
    </div>
  );
};

const ModalRoot = (): JSX.Element | null => {
  const { instances, closeModal, resolveModal } = useModalContext();

  const hasBootstrapModal = instances.some((instance) => {
    const definition = modalRegistry[instance.key];
    return (definition.presentation ?? 'custom') === 'bootstrap';
  });

  useEffect(() => {
    if (!hasBootstrapModal) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;

    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = originalOverflow;
    };
  }, [hasBootstrapModal]);

  if (instances.length === 0) {
    return null;
  }

  return <Fragment>{instances.map((instance) => renderInstance(instance, closeModal, resolveModal))}</Fragment>;
};

export default ModalRoot;
