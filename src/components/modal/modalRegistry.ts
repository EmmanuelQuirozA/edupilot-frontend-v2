import type { ComponentType } from 'react';
import CreateStudentForm from './forms/CreateStudentForm';
import EditStudentForm from './forms/EditStudentForm';

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

export interface CreateStudentModalProps {
  initialValues?: Partial<StudentFormValues>;
}

export interface CreateStudentModalResult {
  action: 'create';
  data: StudentFormValues;
}

export interface EditStudentModalProps {
  student: StudentProfile;
}

export interface EditStudentModalResult {
  action: 'edit';
  data: StudentFormValues & { id: string };
}

type ModalDefinition<Props, Result> = {
  props: Props;
  resolved: Result;
};

export type ModalDefinitions = {
  CreateStudent: ModalDefinition<CreateStudentModalProps | undefined, CreateStudentModalResult>;
  EditStudent: ModalDefinition<EditStudentModalProps, EditStudentModalResult>;
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

export type ModalRegistry = {
  [K in ModalKey]: {
    Component: ComponentType<ModalComponentProps<K>>;
  };
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
};
