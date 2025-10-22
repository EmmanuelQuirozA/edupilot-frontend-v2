import { useModalContext } from './ModalContext';
import type { ModalKey, OpenModalConfig, ModalResultByKey } from './modalRegistry';

export const useModal = () => {
  const { openModal, closeModal } = useModalContext();

  return {
    openModal: <K extends ModalKey>(config: OpenModalConfig<K>) => openModal(config),
    closeModal,
  } as const;
};

export type { OpenModalConfig, ModalKey, ModalResultByKey } from './modalRegistry';
