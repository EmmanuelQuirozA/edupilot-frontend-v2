import { Fragment } from 'react';
import { useModalContext, type ModalInstance } from './ModalContext';
import { modalRegistry, type ModalKey, type ModalComponentProps, type ModalResultByKey } from './modalRegistry';
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
  const containerClassName = definition.containerClassName
    ? `modal-container ${definition.containerClassName}`
    : 'modal-container';
  const componentProps = (instance.props ?? {}) as Omit<ModalComponentProps<K>, 'close' | 'submit' | 'instanceId'>;

  const handleClose = () => closeModal(instance.instanceId);
  const handleSubmit = (value: ModalResultByKey<K>) => {
    resolveModal(instance.instanceId, value);
  };

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

  if (instances.length === 0) {
    return null;
  }

  return <Fragment>{instances.map((instance) => renderInstance(instance, closeModal, resolveModal))}</Fragment>;
};

export default ModalRoot;
