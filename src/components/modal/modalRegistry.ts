import type { ComponentType } from 'react';
import CreateStudentForm from './forms/CreateStudentForm';
import EditStudentForm from './forms/EditStudentForm';
import TuitionPaymentDetailsModal from './forms/TuitionPaymentDetailsModal';

export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
}

export interface StudentFormValues {
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
}

export interface CreateStudentFormValues extends StudentFormValues {
  username: string;
  password: string;
}

export interface CreateStudentModalProps {
  initialValues?: Partial<CreateStudentFormValues>;
}

export interface CreateStudentModalResult {
  action: 'create';
  data: CreateStudentFormValues;
}

export interface EditStudentModalProps {
  student: StudentProfile;
}

export interface EditStudentModalResult {
  action: 'edit';
  data: StudentFormValues & { id: string };
}

export interface TuitionPaymentModalPayment {
  paymentId: string | number | null;
  amount: number | null;
  createdAt: string | null;
  statusName?: string | null;
}

export interface TuitionPaymentDetailsStrings {
  title: string;
  summary: {
    student: string;
    class: string;
    generation: string;
    level: string;
    month: string;
    total: string;
    request: string;
  };
  paymentsTitle: string;
  paymentsTable: {
    columns: {
      id: string;
      date: string;
      amount: string;
      status: string;
    };
    empty: string;
    paymentLinkLabel: string;
  };
  requestButton: string;
  close: string;
}

export interface TuitionPaymentDetailsModalProps {
  studentName?: string | null;
  className?: string | null;
  generation?: string | null;
  scholarLevel?: string | null;
  monthKey: string;
  paymentMonth?: string | null;
  totalAmount: number | null;
  paymentRequestId?: number | string | null;
  payments: TuitionPaymentModalPayment[];
  locale: string;
  currency?: string;
  strings: TuitionPaymentDetailsStrings;
  paymentDetailBasePath: string;
  paymentRequestDetailBasePath?: string | null;
}

export type TuitionPaymentDetailsModalResult = void;

type ModalDefinition<Props, Result> = {
  props: Props;
  resolved: Result;
};

export type ModalDefinitions = {
  CreateStudent: ModalDefinition<CreateStudentModalProps | undefined, CreateStudentModalResult>;
  EditStudent: ModalDefinition<EditStudentModalProps, EditStudentModalResult>;
  TuitionPaymentDetails: ModalDefinition<TuitionPaymentDetailsModalProps, TuitionPaymentDetailsModalResult>;
};

export type ModalKey = keyof ModalDefinitions;

export type RawModalPropsByKey<K extends ModalKey> = ModalDefinitions[K]['props'];

export type ModalPropsByKey<K extends ModalKey> = NonNullable<RawModalPropsByKey<K>>;

export type ModalResultByKey<K extends ModalKey> = ModalDefinitions[K]['resolved'];

type OptionalPropsKeys = {
  [K in ModalKey]: undefined extends RawModalPropsByKey<K> ? K : never;
}[ModalKey];

type RequiredPropsKeys = Exclude<ModalKey, OptionalPropsKeys>;

type ComponentPropsForKey<K extends ModalKey> = ModalPropsByKey<K> & {
  instanceId: string;
  close: () => void;
  submit: (value: ModalResultByKey<K>) => void;
};

export type ModalComponentProps<K extends ModalKey> = ComponentPropsForKey<K>;

type ModalPresentation = 'custom' | 'bootstrap';

type ModalRegistryEntry<K extends ModalKey> = {
  Component: ComponentType<ModalComponentProps<K>>;
  containerClassName?: string;
  presentation?: ModalPresentation;
  modalClassName?: string;
  dialogClassName?: string;
};

export type ModalRegistry = {
  [K in ModalKey]: ModalRegistryEntry<K>;
};

type OptionalPropsConfig<K extends OptionalPropsKeys> = {
  key: K;
  props?: RawModalPropsByKey<K>;
  onSubmit?: (value: ModalResultByKey<K>) => void;
};

type RequiredPropsConfig<K extends RequiredPropsKeys> = {
  key: K;
  props: ModalPropsByKey<K>;
  onSubmit?: (value: ModalResultByKey<K>) => void;
};

export type OpenModalConfig<K extends ModalKey> = K extends OptionalPropsKeys
  ? OptionalPropsConfig<K>
  : K extends RequiredPropsKeys
  ? RequiredPropsConfig<K>
  : never;

export const modalRegistry: ModalRegistry = {
  CreateStudent: {
    Component: CreateStudentForm,
  },
  EditStudent: {
    Component: EditStudentForm,
  },
  TuitionPaymentDetails: {
    Component: TuitionPaymentDetailsModal,
    presentation: 'bootstrap',
    dialogClassName: 'modal-lg modal-dialog-centered modal-dialog-scrollable',
  },
};
