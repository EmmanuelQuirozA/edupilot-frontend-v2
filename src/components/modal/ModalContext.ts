import { createContext, useContext } from 'react';
import type {
  ModalKey,
  ModalPropsByKey,
  ModalResultByKey,
  OpenModalConfig,
  RawModalPropsByKey,
} from './modalRegistry';

export type StoredModalProps<K extends ModalKey> = RawModalPropsByKey<K> extends undefined
  ? ModalPropsByKey<K> | undefined
  : ModalPropsByKey<K>;

export type ModalInstance<K extends ModalKey> = {
  instanceId: string;
  key: K;
  props: StoredModalProps<K>;
  onSubmit?: (value: ModalResultByKey<K>) => void;
};

export type ModalInstanceAny = {
  [K in ModalKey]: ModalInstance<K>;
}[ModalKey];

export interface ModalContextValue {
  openModal: <K extends ModalKey>(config: OpenModalConfig<K>) => string;
  closeModal: (instanceId: string) => void;
  resolveModal: <K extends ModalKey>(instanceId: string, value: ModalResultByKey<K>) => void;
  instances: ModalInstanceAny[];
}

export const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext debe usarse dentro de un ModalProvider');
  }
  return context;
};
