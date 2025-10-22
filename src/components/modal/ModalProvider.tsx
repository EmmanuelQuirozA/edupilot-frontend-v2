import { useCallback, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ModalContext, type ModalInstanceAny } from './ModalContext';
import type { ModalKey, ModalResultByKey, OpenModalConfig } from './modalRegistry';
import ModalRoot from './ModalRoot';

const createInstanceId = (key: ModalKey) =>
  `${key}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const ModalProvider = ({ children }: PropsWithChildren<unknown>) => {
  const [instances, setInstances] = useState<ModalInstanceAny[]>([]);

  const openModal = useCallback(
    <K extends ModalKey>(config: OpenModalConfig<K>) => {
      const instanceId = createInstanceId(config.key);
      const props = 'props' in config ? config.props : undefined;

      const nextInstance = {
        instanceId,
        key: config.key,
        props: props as ModalInstanceAny['props'],
        onSubmit: config.onSubmit as ModalInstanceAny['onSubmit'],
      } satisfies ModalInstanceAny;

      setInstances((previous) => [...previous, nextInstance]);

      return instanceId;
    },
    [],
  );

  const closeModal = useCallback((instanceId: string) => {
    setInstances((previous) => previous.filter((modal) => modal.instanceId !== instanceId));
  }, []);

  const resolveModal = useCallback(
    <K extends ModalKey>(instanceId: string, value: ModalResultByKey<K>) => {
      let callback: ((payload: ModalResultByKey<K>) => void) | undefined;

      setInstances((previous) => {
        const next: ModalInstanceAny[] = [];
        for (const modal of previous) {
          if (modal.instanceId === instanceId) {
            callback = modal.onSubmit as typeof callback;
          } else {
            next.push(modal);
          }
        }
        return next;
      });

      if (callback) {
        callback(value);
      }
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      openModal,
      closeModal,
      resolveModal,
      instances,
    }),
    [closeModal, instances, openModal, resolveModal],
  );

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      <ModalRoot />
    </ModalContext.Provider>
  );
};

export default ModalProvider;
