import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import GlobalToast from '../components/GlobalToast.jsx';
import './StudentsGroupsPage.css';

const DEFAULT_PAGINATION = { offset: 0, limit: 10 };

const createInitialFilters = () => ({
  student_id: '',
  full_name: '',
  payment_reference: '',
  generation: '',
  grade_group: '',
  enabled: '',
});

const createInitialGroupFilters = () => ({
  group_id: '',
  generation: '',
  grade_group: '',
  scholar_level_name: '',
  enabled: '',
});

const createInitialStudent = () => ({
  student_id: '',
  user_id: '',
  first_name: '',
  last_name_father: '',
  last_name_mother: '',
  birth_date: '',
  phone_number: '',
  tax_id: '',
  curp: '',
  street: '',
  ext_number: '',
  int_number: '',
  suburb: '',
  locality: '',
  municipality: '',
  state: '',
  personal_email: '',
  image: null,
  email: '',
  username: '',
  password: '',
  school_id: '',
  group_id: '',
  register_id: '',
  payment_reference: '',
});

const createInitialGroupForm = () => ({
  scholar_level_id: '',
  name: '',
  generation: '',
  group: '',
  grade: '',
});

const extractListFromPayload = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload.data,
    payload.results,
    payload.items,
    payload.list,
    payload.response,
    payload.content,
    payload.schools,
    payload.classes,
    payload.data?.items,
    payload.data?.results,
    payload.data?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const normalizeSelectOption = (item, index = 0) => {
  if (item == null) {
    return { value: '', label: '' };
  }

  if (typeof item !== 'object') {
    const stringValue = String(item);
    return { value: stringValue, label: stringValue };
  }

  const valueKeys = [
    'id',
    'school_id',
    'schoolId',
    'class_id',
    'classId',
    'group_id',
    'groupId',
    'value',
    'uuid',
    'code',
  ];

  let value = '';
  for (const key of valueKeys) {
    const candidate = item[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      value = String(candidate);
      break;
    }
  }

  const labelKeys = [
    'name',
    'label',
    'title',
    'description',
    'code',
    'grade_group',
    'group_name',
    'class_name',
  ];

  let label = '';
  for (const key of labelKeys) {
    const candidate = item[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      label = candidate;
      break;
    }
  }

  if (!label) {
    label = value || String(index + 1);
  }

  return { value, label };
};

const normalizeStudentsResponse = (payload) => {
  if (!payload) {
    return { students: [], total: 0 };
  }

  if (Array.isArray(payload)) {
    return { students: payload, total: payload.length };
  }

  const possibleArrays = [
    payload.data,
    payload.results,
    payload.items,
    payload.students,
    payload.data?.students,
    payload.data?.items,
    payload.response,
    payload.content,
  ].find(Array.isArray);

  const students = possibleArrays ?? [];

  const total =
    payload.total ??
    payload.count ??
    payload.meta?.total ??
    payload.data?.total ??
    payload.pagination?.total ??
    payload.totalElements ??
    students.length;

  return { students, total: Number.isFinite(total) ? total : students.length };
};

const normalizeGroupsResponse = (payload) => {
  if (!payload) {
    return { groups: [], total: 0 };
  }

  if (Array.isArray(payload)) {
    return { groups: payload, total: payload.length };
  }

  const groups = extractListFromPayload(payload) ?? [];

  const total =
    payload.total ??
    payload.count ??
    payload.totalElements ??
    payload.total_pages ??
    payload.total_items ??
    payload.pagination?.total ??
    groups.length;

  return { groups, total: Number.isFinite(total) ? total : groups.length };
};

const extractUserIdFromStudentDetail = (detail) => {
  if (!detail || typeof detail !== 'object') {
    return null;
  }

  const candidates = [
    detail.user_id,
    detail.userId,
    detail.user_uuid,
    detail.userUuid,
    detail.user?.user_id,
    detail.user?.userId,
    detail.user?.id,
    detail.user?.uuid,
    detail.user?.user_uuid,
    detail.user?.userUuid,
    detail.user?.data?.user_id,
    detail.user?.data?.userId,
    detail.user?.data?.id,
    detail.user?.data?.user?.id,
    detail.user?.data?.user?.user_id,
    detail.user?.data?.user?.userId,
  ];

  const validCandidate = candidates.find(
    (candidate) => candidate !== undefined && candidate !== null && candidate !== '',
  );

  if (validCandidate === undefined) {
    return null;
  }

  return typeof validCandidate === 'number' ? String(validCandidate) : validCandidate;
};

const StudentsGroupsPage = ({ language, placeholder, strings, onStudentDetail, onBulkUpload }) => {
  const [activeTab, setActiveTab] = useState('students');
  const [searchValue, setSearchValue] = useState('');
  const [students, setStudents] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { token } = useAuth();
  const [filters, setFilters] = useState(createInitialFilters);
  const [appliedFilters, setAppliedFilters] = useState(createInitialFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState(createInitialStudent);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [formFeedback, setFormFeedback] = useState('');
  const [globalAlert, setGlobalAlert] = useState(null);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [modalMode, setModalMode] = useState('create');
  const [editingStudentUserId, setEditingStudentUserId] = useState(null);
  const [isStudentPrefetching, setIsStudentPrefetching] = useState(false);
  const [openActionsMenuId, setOpenActionsMenuId] = useState(null);
  const [pendingStatusStudentId, setPendingStatusStudentId] = useState(null);

  const [groups, setGroups] = useState([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [groupPagination, setGroupPagination] = useState(DEFAULT_PAGINATION);
  const [groupFilters, setGroupFilters] = useState(createInitialGroupFilters);
  const [appliedGroupFilters, setAppliedGroupFilters] = useState(createInitialGroupFilters);
  const [isGroupFiltersOpen, setIsGroupFiltersOpen] = useState(false);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(createInitialGroupForm);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [groupModalMode, setGroupModalMode] = useState('edit');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupFormFeedback, setGroupFormFeedback] = useState('');
  const [pendingStatusGroupId, setPendingStatusGroupId] = useState(null);

  const filtersCount = useMemo(
    () =>
      Object.entries(appliedFilters).reduce((count, [key, value]) => {
        if (key === 'enabled' && value === '') {
          return count;
        }
        if (value === '' || value === null || value === undefined) {
          return count;
        }
        return count + 1;
      }, 0),
    [appliedFilters],
  );

  const groupFiltersCount = useMemo(
    () =>
      Object.entries(appliedGroupFilters).reduce((count, [key, value]) => {
        if (key === 'enabled' && value === '') {
          return count;
        }
        if (value === '' || value === null || value === undefined) {
          return count;
        }
        return count + 1;
      }, 0),
    [appliedGroupFilters],
  );

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError('');

    const params = new URLSearchParams({
      lang: language ?? 'es',
      offset: String(pagination.offset ?? 0),
      limit: String(pagination.limit ?? 10),
      export_all: 'false',
    });

    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) {
        return;
      }

      if (key === 'enabled') {
        params.set('enabled', value);
        return;
      }

      params.set(key, value);
    });

    const controller = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/students?${params.toString()}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load students');
      }

      const payload = await response.json();
      const { students: normalizedStudents, total } = normalizeStudentsResponse(payload);

      setStudents(normalizedStudents);
      setTotalStudents(total);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message || 'Unable to load students');
        setStudents([]);
        setTotalStudents(0);
      }
    } finally {
      setIsLoading(false);
    }

    return () => {
      controller.abort();
    };
  }, [appliedFilters, language, pagination.limit, pagination.offset, token]);

  const fetchGroups = useCallback(async () => {
    setIsGroupsLoading(true);
    setGroupsError('');

    const params = new URLSearchParams({
      lang: language ?? 'es',
      offset: String(groupPagination.offset ?? 0),
      limit: String(groupPagination.limit ?? 10),
      export_all: 'false',
    });

    Object.entries(appliedGroupFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) {
        return;
      }

      if (key === 'enabled') {
        params.set('enabled', value);
        return;
      }

      params.set(key, value);
    });

    const controller = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/classes?${params.toString()}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load groups');
      }

      const payload = await response.json();
      const { groups: normalizedGroups, total } = normalizeGroupsResponse(payload);

      setGroups(normalizedGroups);
      setTotalGroups(total);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setGroupsError(requestError.message || 'Unable to load groups');
        setGroups([]);
        setTotalGroups(0);
      }
    } finally {
      setIsGroupsLoading(false);
    }

    return () => {
      controller.abort();
    };
  }, [appliedGroupFilters, groupPagination.limit, groupPagination.offset, language, token]);

  useEffect(() => {
    const abort = fetchStudents();
    return () => {
      if (typeof abort === 'function') {
        abort();
      }
    };
  }, [fetchStudents]);

  useEffect(() => {
    if (activeTab !== 'groups') {
      return () => {};
    }

    const abort = fetchGroups();
    return () => {
      if (typeof abort === 'function') {
        abort();
      }
    };
  }, [activeTab, fetchGroups]);

  useEffect(() => {
    setSearchValue(appliedFilters.full_name ?? '');
  }, [appliedFilters.full_name]);

  useEffect(() => {
    if (isFiltersOpen) {
      setFilters(appliedFilters);
    }
  }, [appliedFilters, isFiltersOpen]);

  useEffect(() => {
    if (isGroupFiltersOpen) {
      setGroupFilters(appliedGroupFilters);
    }
  }, [appliedGroupFilters, isGroupFiltersOpen]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    setAppliedFilters((previous) => ({ ...previous, full_name: trimmed }));
    setFilters((previous) => ({ ...previous, full_name: trimmed }));
    setPagination((previous) => ({ ...previous, offset: 0 }));
  };

  const handlePaginationChange = (direction) => {
    setPagination((previous) => {
      const totalPages = Math.ceil((totalStudents || 0) / previous.limit) || 1;
      const currentPage = Math.floor((previous.offset || 0) / previous.limit) + 1;
      if (direction === 'next' && currentPage < totalPages) {
        return { ...previous, offset: previous.offset + previous.limit };
      }
      if (direction === 'prev' && currentPage > 1) {
        return { ...previous, offset: previous.offset - previous.limit };
      }
      return previous;
    });
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
    setPagination((previous) => ({ ...previous, offset: 0 }));
    setIsFiltersOpen(false);
  };

  const handleClearFilters = () => {
    const reset = createInitialFilters();
    setFilters(reset);
    setAppliedFilters(reset);
    setPagination((previous) => ({ ...previous, offset: 0 }));
    setIsFiltersOpen(false);
  };

  const handleGroupFilterChange = (event) => {
    const { name, value } = event.target;
    setGroupFilters((previous) => ({ ...previous, [name]: value }));
  };

  const handleApplyGroupFilters = (event) => {
    event.preventDefault();
    setAppliedGroupFilters(groupFilters);
    setGroupPagination((previous) => ({ ...previous, offset: 0 }));
    setIsGroupFiltersOpen(false);
  };

  const handleClearGroupFilters = () => {
    const reset = createInitialGroupFilters();
    setGroupFilters(reset);
    setAppliedGroupFilters(reset);
    setGroupPagination((previous) => ({ ...previous, offset: 0 }));
    setIsGroupFiltersOpen(false);
  };

  const handleGroupPaginationChange = (direction) => {
    setGroupPagination((previous) => {
      const totalPages = Math.ceil((totalGroups || 0) / previous.limit) || 1;
      const currentPage = Math.floor((previous.offset || 0) / previous.limit) + 1;
      if (direction === 'next' && currentPage < totalPages) {
        return { ...previous, offset: previous.offset + previous.limit };
      }
      if (direction === 'prev' && currentPage > 1) {
        return { ...previous, offset: previous.offset - previous.limit };
      }
      return previous;
    });
  };

  const fetchClasses = useCallback(
    async (schoolId, preferredGroupId = '') => {
      if (!schoolId) {
        setClassOptions([]);
        setStudentForm((previous) => ({ ...previous, group_id: '' }));
        return;
      }

      const normalizedPreferredGroupId =
        preferredGroupId === null || preferredGroupId === undefined
          ? ''
          : String(preferredGroupId);

      try {
        const response = await fetch(
          `${API_BASE_URL}/classes?lang=${language ?? 'es'}&school_id=${encodeURIComponent(schoolId)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        if (!response.ok) {
          throw new Error('Failed to load classes');
        }

        const payload = await response.json();
        const classesList = extractListFromPayload(payload);
        const options = classesList
          .map((item, index) => normalizeSelectOption(item, index))
          .filter((option) => option.value !== '');
        setClassOptions(options);

        if (options.length > 0) {
          const availableValues = new Set(options.map((option) => option.value));
          const nextGroupId =
            normalizedPreferredGroupId && availableValues.has(normalizedPreferredGroupId)
              ? normalizedPreferredGroupId
              : options[0].value;
          setStudentForm((previous) => ({ ...previous, group_id: nextGroupId }));
        } else {
          setStudentForm((previous) => ({ ...previous, group_id: '' }));
        }
      } catch (error) {
        console.error('Failed to load classes', error);
        setClassOptions([]);
        setStudentForm((previous) => ({ ...previous, group_id: '' }));
      }
    },
    [language, token],
  );

  const fetchSchools = useCallback(
    async (preferredSchoolId = '', preferredGroupId = '') => {
      try {
        const response = await fetch(`${API_BASE_URL}/schools/list?lang=${language ?? 'es'}&status_filter=-1`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load schools');
        }

        const payload = await response.json();
        const schoolsList = extractListFromPayload(payload);
        const options = schoolsList
          .map((item, index) => normalizeSelectOption(item, index))
          .filter((option) => option.value !== '');
        setSchoolOptions(options);

        const normalizedPreferredSchoolId =
          preferredSchoolId === null || preferredSchoolId === undefined
            ? ''
            : String(preferredSchoolId);

        if (options.length > 0) {
          const availableValues = new Set(options.map((option) => option.value));
          const nextSchoolId =
            normalizedPreferredSchoolId && availableValues.has(normalizedPreferredSchoolId)
              ? normalizedPreferredSchoolId
              : options[0].value;

          setStudentForm((previous) => ({ ...previous, school_id: nextSchoolId }));

          if (nextSchoolId) {
            await fetchClasses(nextSchoolId, preferredGroupId);
          } else {
            setClassOptions([]);
            setStudentForm((previous) => ({ ...previous, group_id: '' }));
          }
        } else {
          setStudentForm((previous) => ({ ...previous, school_id: '', group_id: '' }));
          setClassOptions([]);
        }
      } catch (error) {
        console.error('Failed to load schools', error);
        setSchoolOptions([]);
        setStudentForm((previous) => ({ ...previous, school_id: '', group_id: '' }));
        setClassOptions([]);
        throw error;
      }
    },
    [fetchClasses, language, token],
  );

  const fetchStudentDetail = useCallback(
    async (studentId) => {
      if (!studentId) {
        return null;
      }

      const response = await fetch(
        `${API_BASE_URL}/students/student-details/${encodeURIComponent(studentId)}?lang=${language ?? 'es'}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to load student details');
      }

      const payload = await response.json();

      if (Array.isArray(payload)) {
        const arrayCandidate = payload.find(
          (candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate),
        );

        if (!arrayCandidate) {
          throw new Error('Student details not available');
        }

        return arrayCandidate;
      }

      const detailCandidate = [
        payload.data,
        payload.result,
        payload.student,
        payload.details,
        payload.response,
        payload,
      ].find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate));

      if (!detailCandidate) {
        throw new Error('Student details not available');
      }

      return detailCandidate;
    },
    [language, token],
  );

  const mapDetailToForm = useCallback((detail) => {
    const base = createInitialStudent();

    if (!detail || typeof detail !== 'object') {
      return base;
    }

    const normalized = { ...base };

    const fieldMap = {
      student_id: ['student_id', 'id'],
      user_id: ['user_id', 'userId'],
      first_name: ['first_name', 'firstName'],
      last_name_father: ['last_name_father', 'lastNameFather', 'father_last_name'],
      last_name_mother: ['last_name_mother', 'lastNameMother', 'mother_last_name'],
      birth_date: ['birth_date', 'birthDate'],
      phone_number: ['phone_number', 'phoneNumber', 'phone'],
      tax_id: ['tax_id', 'taxId'],
      curp: ['curp'],
      street: ['street'],
      ext_number: ['ext_number', 'extNumber', 'external_number'],
      int_number: ['int_number', 'intNumber', 'internal_number'],
      suburb: ['suburb', 'neighborhood'],
      locality: ['locality', 'city'],
      municipality: ['municipality'],
      state: ['state'],
      personal_email: ['personal_email', 'personalEmail'],
      image: ['image', 'avatar'],
      email: ['email'],
      username: ['username', 'user_name'],
      school_id: ['school_id', 'schoolId'],
      group_id: ['group_id', 'groupId', 'class_id'],
      register_id: ['register_id', 'registration_id', 'registerId'],
      payment_reference: ['payment_reference', 'paymentReference'],
    };

    Object.entries(fieldMap).forEach(([field, keys]) => {
      for (const key of keys) {
        const value = detail[key];
        if (value !== undefined && value !== null && value !== '') {
          normalized[field] = typeof value === 'number' ? String(value) : value;
          break;
        }
      }
    });

    if (!normalized.user_id && detail.user && typeof detail.user === 'object') {
      const userId = detail.user.user_id ?? detail.user.id;
      if (userId !== undefined && userId !== null) {
        normalized.user_id = typeof userId === 'number' ? String(userId) : userId;
      }
      if (!normalized.email && detail.user.email) {
        normalized.email = detail.user.email;
      }
    }

    return normalized;
  }, []);

  const handleStudentFormChange = (event) => {
    const { name, value } = event.target;
    if (name === 'school_id') {
      setStudentForm((previous) => ({ ...previous, school_id: value, group_id: '' }));
      fetchClasses(value);
      return;
    }

    setStudentForm((previous) => ({ ...previous, [name]: value }));
  };

  const closeStudentModal = () => {
    setIsStudentModalOpen(false);
    setStudentForm(createInitialStudent());
    setFormFeedback('');
    setModalMode('create');
    setEditingStudentUserId(null);
    setSchoolOptions([]);
    setClassOptions([]);
    setIsStudentPrefetching(false);
  };

  const toastCloseLabel = useMemo(
    () => strings?.actions?.close ?? strings?.alertCloseLabel ?? 'Cerrar',
    [strings],
  );

  const showGlobalAlert = useCallback(
    (type, message, options = {}) => {
      setGlobalAlert({
        type,
        message: message ?? '',
        id: Date.now(),
        closeLabel: options.closeLabel ?? toastCloseLabel,
        ...options,
      });
    },
    [toastCloseLabel],
  );

  useEffect(() => {
    if (!globalAlert) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setGlobalAlert(null);
    }, globalAlert.duration ?? 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [globalAlert]);

  const handleStudentSubmit = async (event) => {
    event.preventDefault();
    setIsSubmittingStudent(true);
    setFormFeedback('');

    const { student_id: studentId, user_id: userId, ...restForm } = studentForm;

    const sanitizedForm = Object.fromEntries(
      Object.entries(restForm).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    );

    try {
      if (modalMode === 'edit' && editingStudentUserId) {
        const updatePayload = {
          ...sanitizedForm,
          ...(studentId ? { student_id: studentId } : {}),
          ...(userId ? { user_id: userId } : {}),
        };

        const response = await fetch(
          `${API_BASE_URL}/students/update/${encodeURIComponent(editingStudentUserId)}?lang=${language ?? 'es'}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(updatePayload),
          },
        );

        const payload = await response.json();
        if (!payload?.success) {
          const feedbackMessage = payload?.message || strings.form.editError;
          setFormFeedback(feedbackMessage);
          showGlobalAlert('error', feedbackMessage);
          return;
        }

        const successMessage = payload?.message || strings.form.editSuccess;
        showGlobalAlert('success', successMessage);
      } else {
        const createPayload = [{ ...sanitizedForm }];

        const response = await fetch(`${API_BASE_URL}/students/create?lang=${language ?? 'es'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(createPayload),
        });

        const payload = await response.json();
        if (!payload?.success) {
          const feedbackMessage = payload?.message || strings.form.error;
          setFormFeedback(feedbackMessage);
          showGlobalAlert('error', feedbackMessage);
          return;
        }

        const successMessage = payload?.message || strings.form.success;
        showGlobalAlert('success', successMessage);
      }

      closeStudentModal();
      fetchStudents();
    } catch (error) {
      console.error('Failed to submit student', error);
      const fallbackMessage =
        modalMode === 'edit'
          ? strings.form.editError
          : strings.form.error;
      setFormFeedback(fallbackMessage);
      showGlobalAlert('error', fallbackMessage);
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleOpenCreateStudent = async () => {
    setModalMode('create');
    setEditingStudentUserId(null);
    setStudentForm(createInitialStudent());
    setFormFeedback('');
    setOpenActionsMenuId(null);
    setIsStudentPrefetching(true);

    try {
      await fetchSchools();
    } catch (error) {
      console.error('Failed to prepare student modal', error);
      showGlobalAlert('error', strings.form.loadError);
    } finally {
      setIsStudentPrefetching(false);
      setIsStudentModalOpen(true);
    }
  };

  const handleEditStudent = async (student) => {
    const studentId = student?.student_id ?? student?.id;
    if (!studentId) {
      return;
    }

    setOpenActionsMenuId(null);
    setModalMode('edit');
    setFormFeedback('');
    setIsStudentPrefetching(true);

    try {
      const detail = await fetchStudentDetail(studentId);
      const mappedForm = mapDetailToForm(detail);
      setStudentForm(mappedForm);
      setEditingStudentUserId(detail.user_id);
      await fetchSchools(mappedForm.school_id, mappedForm.group_id);
      setIsStudentModalOpen(true);
    } catch (error) {
      console.error('Failed to load student for editing', error);
      showGlobalAlert('error', strings.form.loadError);
    } finally {
      setIsStudentPrefetching(false);
    }
  };

  const handleToggleStudentStatus = async (student, shouldEnable) => {
    const studentId = student?.student_id ?? student?.id;
    if (!studentId) {
      return;
    }

    setOpenActionsMenuId(null);
    setPendingStatusStudentId(studentId);

    try {
      let userIdFromDetail = extractUserIdFromStudentDetail(student);

      if (!userIdFromDetail) {
        const detail = await fetchStudentDetail(studentId);
        userIdFromDetail = extractUserIdFromStudentDetail(detail);
      }

      if (!userIdFromDetail) {
        throw new Error('Missing user id');
      }

      const response = await fetch(
        `${API_BASE_URL}/users/update/${encodeURIComponent(userIdFromDetail)}/status?lang=${language ?? 'es'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: shouldEnable ? 1 : 0 }),
        },
      );

      const payload = await response.json();
      if (!payload?.success) {
        const errorMessage =
          payload?.message || strings.actions.statusError || strings.actions.disableError;
        showGlobalAlert('error', errorMessage);
        return;
      }

      const successMessage =
        payload?.message ||
        (shouldEnable
          ? strings.actions.enableSuccess ?? strings.actions.disableSuccess
          : strings.actions.disableSuccess);
      showGlobalAlert('success', successMessage);
      fetchStudents();
    } catch (error) {
      console.error('Failed to toggle student status', error);
      const fallbackMessage = strings.actions.statusError ?? strings.actions.disableError;
      showGlobalAlert('error', fallbackMessage);
    } finally {
      setPendingStatusStudentId(null);
    }
  };

  const toggleActionsMenu = (studentId) => {
    setOpenActionsMenuId((previous) => (previous === studentId ? null : studentId));
  };

  const handleMenuPlaceholder = () => {
    setOpenActionsMenuId(null);
    showGlobalAlert('info', strings.actions.menuPlaceholder);
  };

  const handleOpenEditGroup = (group) => {
    if (!group) {
      return;
    }

    const groupId = group.group_id ?? group.id;
    if (!groupId) {
      return;
    }

    setGroupModalMode('edit');
    setEditingGroupId(groupId);
    setGroupForm({
      scholar_level_id:
        group.scholar_level_id === null || group.scholar_level_id === undefined
          ? ''
          : String(group.scholar_level_id),
      name: group.name ?? group.grade_group ?? '',
      generation: group.generation ?? '',
      group: group.group ?? '',
      grade: group.grade === null || group.grade === undefined ? '' : String(group.grade),
    });
    setGroupFormFeedback('');
    setIsGroupModalOpen(true);
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroupId(null);
    setGroupForm(createInitialGroupForm());
    setGroupFormFeedback('');
    setGroupModalMode('edit');
  };

  const handleGroupFormChange = (event) => {
    const { name, value } = event.target;
    setGroupForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleGroupSubmit = async (event) => {
    event.preventDefault();

    const isEditGroup = groupModalMode === 'edit';
    if (isEditGroup && !editingGroupId) {
      return;
    }

    setIsSubmittingGroup(true);
    setGroupFormFeedback('');

    const normalizedScholarLevelId = groupForm.scholar_level_id.trim();
    const parsedScholarLevelId = Number(normalizedScholarLevelId);
    const bodyPayload = {
      scholar_level_id:
        normalizedScholarLevelId === ''
          ? undefined
          : Number.isNaN(parsedScholarLevelId)
          ? normalizedScholarLevelId
          : parsedScholarLevelId,
      name: groupForm.name.trim(),
      generation: groupForm.generation.trim(),
      group: groupForm.group.trim(),
      grade: groupForm.grade.trim(),
    };

    const sanitizedPayload = Object.fromEntries(
      Object.entries(bodyPayload).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );

    try {
      let response;
      if (isEditGroup) {
        response = await fetch(
          `${API_BASE_URL}/groups/update/${encodeURIComponent(editingGroupId)}?lang=${language ?? 'es'}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(sanitizedPayload),
          },
        );
      } else {
        response = await fetch(`${API_BASE_URL}/groups/create?lang=${language ?? 'es'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(sanitizedPayload),
        });
      }

      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        const feedbackMessage =
          payload?.message ||
          (isEditGroup
            ? strings.actions.groupEditError || 'No fue posible actualizar el grupo.'
            : strings.actions.groupCreateError || 'No fue posible crear el grupo.');
        setGroupFormFeedback(feedbackMessage);
        showGlobalAlert('error', feedbackMessage);
        return;
      }

      const successMessage =
        payload?.message ||
        (isEditGroup
          ? strings.actions.groupEditSuccess || 'Grupo actualizado correctamente.'
          : strings.actions.groupCreateSuccess || 'Grupo creado correctamente.');
      setGroupFormFeedback(successMessage);
      showGlobalAlert('success', successMessage);
      closeGroupModal();
      fetchGroups();
    } catch (error) {
      console.error('Failed to submit group form', error);
      const feedbackMessage = isEditGroup
        ? strings.actions.groupEditError || 'No fue posible actualizar el grupo.'
        : strings.actions.groupCreateError || 'No fue posible crear el grupo.';
      setGroupFormFeedback(feedbackMessage);
      showGlobalAlert('error', feedbackMessage);
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleToggleGroupStatus = async (group, shouldEnable) => {
    const groupId = group?.group_id ?? group?.id;
    if (!groupId) {
      return;
    }

    setPendingStatusGroupId(groupId);

    try {
      const response = await fetch(
        `${API_BASE_URL}/groups/update/${encodeURIComponent(groupId)}/status?lang=${language ?? 'es'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ enabled: shouldEnable }),
        },
      );

      const payload = await response.json();

      if (!response.ok || payload?.success === false) {
        const message =
          payload?.message || strings.actions.groupStatusError || 'No fue posible actualizar el estado del grupo.';
        showGlobalAlert('error', message);
        return;
      }

      const successMessage =
        payload?.message ||
        (shouldEnable
          ? strings.actions.groupStatusEnableSuccess
          : strings.actions.groupStatusDisableSuccess) ||
        'Estado del grupo actualizado correctamente.';
      showGlobalAlert('success', successMessage);
      fetchGroups();
    } catch (error) {
      console.error('Failed to toggle group status', error);
      const message = strings.actions.groupStatusError || 'No fue posible actualizar el estado del grupo.';
      showGlobalAlert('error', message);
    } finally {
      setPendingStatusGroupId(null);
    }
  };

  useEffect(() => {
    if (!openActionsMenuId) {
      return () => {};
    }

    const handleClickOutside = (event) => {
      if (typeof window === 'undefined') {
        return;
      }

      const target = event.target;
      if (target instanceof Element) {
        if (target.closest('.students-table__menu')) {
          return;
        }
      }

      setOpenActionsMenuId(null);
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openActionsMenuId]);

  const handleStudentDetailNavigation = (student, fallbackName) => {
    const studentId = student?.student_id ?? student?.id;
    if (!studentId) {
      return;
    }

    const fullName =
      student.full_name ??
      fallbackName ??
      [student.first_name, student.last_name_father, student.last_name_mother].filter(Boolean).join(' ');

    onStudentDetail?.({ id: studentId, name: fullName, registerId: student.register_id ?? student.registration_id });
  };

  const { description } = placeholder;
  const statusLabels = strings.status;
  const getStudentStatusValue = (student) =>
    student?.status ?? student?.enabled ?? student?.is_enabled ?? student?.user_status ?? student?.state;

  const isStudentActive = (student) => {
    const status = getStudentStatusValue(student);

    if (typeof status === 'string') {
      const normalized = status.trim().toLowerCase();

      if (!normalized) {
        return false;
      }

      const activeTokens = [
        '1',
        'true',
        'active',
        'enabled',
        'activo',
        'habilitado',
        (statusLabels?.active ?? '').toString().toLowerCase(),
      ].filter(Boolean);

      return activeTokens.includes(normalized);
    }

    return status === 1 || status === true;
  };

  const isEditMode = modalMode === 'edit';

  const activePage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil((totalStudents || 0) / pagination.limit));
  const showingFrom = Math.min(totalStudents, pagination.offset + 1);
  const showingTo = Math.min(totalStudents, pagination.offset + students.length);

  const groupActivePage = Math.floor(groupPagination.offset / groupPagination.limit) + 1;
  const groupTotalPages = Math.max(1, Math.ceil((totalGroups || 0) / groupPagination.limit));
  const groupShowingFrom = Math.min(totalGroups, groupPagination.offset + 1);
  const groupShowingTo = Math.min(totalGroups, groupPagination.offset + groups.length);

  const renderStatusPill = (student, isActive) => {
    const label =
      typeof student.user_status === 'string' && student.user_status.trim()
        ? student.user_status
        : isActive
        ? statusLabels.active
        : statusLabels.inactive;
    const tone = isActive ? 'active' : 'inactive';

    return <span className={`students-table__status students-table__status--${tone}`}>{label}</span>;
  };

  const groupStatusLabels = strings.groupsView?.status ?? {
    active: statusLabels?.active ?? 'Activo',
    inactive: statusLabels?.inactive ?? 'Inactivo',
  };

  const getGroupStatusValue = (group) =>
    group?.enabled ?? group?.group_status ?? group?.status ?? group?.state ?? group?.is_enabled;

  const isGroupActive = (group) => {
    const status = getGroupStatusValue(group);

    if (typeof status === 'string') {
      const normalized = status.trim().toLowerCase();
      if (!normalized) {
        return false;
      }

      const activeTokens = [
        '1',
        'true',
        'active',
        'enabled',
        'activo',
        'habilitado',
        (groupStatusLabels?.active ?? '').toString().toLowerCase(),
      ].filter(Boolean);

      return activeTokens.includes(normalized);
    }

    return status === 1 || status === true;
  };

  const renderGroupStatusPill = (group, isActive) => {
    const label =
      typeof group.group_status === 'string' && group.group_status.trim()
        ? group.group_status
        : isActive
        ? groupStatusLabels.active
        : groupStatusLabels.inactive;
    const tone = isActive ? 'active' : 'inactive';

    return <span className={`students-table__status students-table__status--${tone}`}>{label}</span>;
  };

  const groupFormStrings = strings.groupsView?.form ?? {};
  const isGroupEditMode = groupModalMode === 'edit';
  const groupFormTitle = isGroupEditMode
    ? groupFormStrings.title ?? 'Editar grupo'
    : groupFormStrings.createTitle ?? groupFormStrings.title ?? 'Agregar grupo';
  const groupFormSubtitle = isGroupEditMode
    ? groupFormStrings.subtitle ?? ''
    : groupFormStrings.createSubtitle ?? groupFormStrings.subtitle ?? '';
  const groupFormCloseLabel = groupFormStrings.close ?? 'Cerrar modal de grupo';
  const groupFormCancelLabel = groupFormStrings.cancel ?? 'Cancelar';
  const groupFormSavingLabel = groupFormStrings.saving ?? 'Guardando...';
  const groupFormSubmitLabel = isSubmittingGroup
    ? groupFormSavingLabel
    : isGroupEditMode
    ? groupFormStrings.submit ?? 'Guardar cambios'
    : groupFormStrings.submitCreate ?? groupFormStrings.submit ?? 'Crear grupo';

  const handleStudentFiltersBackdropClick = (event) => {
    if (event.target.dataset.dismiss === 'filters') {
      setIsFiltersOpen(false);
    }
  };

  const handleGroupFiltersBackdropClick = (event) => {
    if (event.target.dataset.dismiss === 'group-filters') {
      setIsGroupFiltersOpen(false);
    }
  };

  return (
    <div className="students-groups">
      <GlobalToast alert={globalAlert} onClose={() => setGlobalAlert(null)} />

      <header className="students-groups__header">
        <div>
          <p>{strings.header?.subtitle ?? description}</p>
        </div>
      </header>

      <div className="students-groups__tabs-row">
        <nav className="students-groups__tabs" aria-label="Tabs">
          <button
            type="button"
            className={activeTab === 'students' ? 'is-active' : ''}
            onClick={() => setActiveTab('students')}
          >
            {strings.tabs.students}
          </button>
          <button
            type="button"
            className={activeTab === 'groups' ? 'is-active' : ''}
            onClick={() => setActiveTab('groups')}
          >
            {strings.tabs.groups}
          </button>
        </nav>

        {activeTab === 'students' ? (
          <div className="students-groups__tab-actions">
            <button
              type="button"
              className="students-groups__tab-action students-groups__tab-action--secondary"
              onClick={onBulkUpload}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h16a1 1 0 0 0 1-1v-5h-2v4H5v-4H3v5a1 1 0 0 0 1 1z" />
                <path d="M12 3 7 8h3v7h4V8h3l-5-5z" />
              </svg>
              {strings.actions.bulkUpload}
            </button>
            <button
              type="button"
              className="students-groups__add"
              onClick={handleOpenCreateStudent}
              disabled={isStudentPrefetching}
            >
              <span>+</span>
              {strings.actions.addStudent}
            </button>
          </div>
        ) : (
          <div className="students-groups__tab-actions">
            <button
              type="button"
              className="students-groups__add"
              onClick={() => {
                setGroupModalMode('create');
                setEditingGroupId(null);
                setGroupForm(createInitialGroupForm());
                setGroupFormFeedback('');
                setIsGroupModalOpen(true);
              }}
            >
              <span>+</span>
              {strings.actions.addGroup}
            </button>
          </div>
        )}
      </div>

      {activeTab === 'students' ? (
        <section className="students-view">
          <div className="students-view__toolbar">
            <form className="students-view__search" onSubmit={handleSearchSubmit}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={strings.searchPlaceholder}
              />
            </form>

            <div className="students-view__actions">
              <button type="button" className="students-view__filters" onClick={() => setIsFiltersOpen(true)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 5h16M7 12h10M10 19h4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {strings.actions.filters}
                {filtersCount > 0 && <span className="students-view__filters-count">{filtersCount}</span>}
              </button>
            </div>
          </div>

          <div className="students-table__wrapper">
            <table className="students-table">
              <thead>
                <tr>
                  <th scope="col">{strings.table.student}</th>
                  <th scope="col">{strings.table.gradeGroup}</th>
                  <th scope="col">{strings.table.status}</th>
                  <th scope="col">{strings.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="students-table__empty">
                      <span className="students-table__loader" aria-hidden="true" />
                      {strings.table.loading}
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="students-table__empty">
                      {error}
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="students-table__empty">
                      {strings.table.empty}
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const fullName =
                      student.full_name ??
                      [student.first_name, student.last_name_father, student.last_name_mother]
                        .filter(Boolean)
                        .join(' ');
                    const initials = fullName
                      .split(' ')
                      .filter(Boolean)
                      .map((part) => part.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join('');
                    const gradeGroup = student.grade_group ?? student.group ?? strings.table.noGroup;
                    const scholarLevel = student.scholar_level_name ?? strings.table.noGroup;
                    const registerId = student.register_id ?? student.registration_id ?? '—';
                    const studentId = student.student_id ?? student.id ?? registerId;
                    const isStatusPending = pendingStatusStudentId === studentId;
                    const isActive = isStudentActive(student);
                    const switchTitle = isStatusPending
                      ? strings.actions.statusUpdating ?? strings.actions.disabling
                      : isActive
                      ? statusLabels.active
                      : statusLabels.inactive;
                    const switchActionLabel = isActive ? strings.actions.disable : strings.actions.enable;

                    return (
                      <tr key={studentId}>
                        <td data-title={strings.table.student} className="students-table__student">
                          <div className="students-table__student-wrapper">
                            <span className="students-table__avatar" aria-hidden="true">
                              {initials || '??'}
                            </span>
                            <div className="students-table__student-info">
                              <button
                                type="button"
                                onClick={() => handleStudentDetailNavigation(student, fullName)}
                              >
                                {fullName || strings.table.unknownStudent}
                              </button>
                              <span className="students-table__student-meta">
                                {strings.table.registrationIdLabel}
                                <strong>{registerId}</strong>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-title={strings.table.gradeGroup}>
                          {gradeGroup + " " + scholarLevel}
                        </td>
                        <td data-title={strings.table.status}>{renderStatusPill(student, isActive)}</td>
                        <td data-title={strings.table.actions} className="students-table__actions-cell">
                          <div className="students-table__actions">
                            <button
                              type="button"
                              className="students-table__icon-button"
                              onClick={() => handleEditStudent(student)}
                              aria-label={`${strings.actions.edit} ${fullName || strings.table.unknownStudent}`}
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                                <path d="M3 16.75V19h2.25l8.9-8.9-2.25-2.25Zm12.87-7.4a.75.75 0 0 0 0-1.06l-1.16-1.16a.75.75 0 0 0-1.06 0l-1.04 1.04 2.22 2.22Z" />
                              </svg>
                            </button>
                            <label
                              className={`students-table__switch ${isStatusPending ? 'is-disabled' : ''}`}
                              title={switchTitle}
                            >
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => handleToggleStudentStatus(student, !isActive)}
                                disabled={isStatusPending}
                                aria-label={`${switchActionLabel} ${fullName || strings.table.unknownStudent}`}
                              />
                              <span className="students-table__switch-track">
                                <span className="students-table__switch-thumb" />
                              </span>
                            </label>
                            <div className={`students-table__menu ${openActionsMenuId === studentId ? 'is-open' : ''}`}>
                              <button
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={openActionsMenuId === studentId}
                                onClick={() => toggleActionsMenu(studentId)}
                              >
                                <span className="visually-hidden">{strings.actions.more}</span>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="5" r="1.8" />
                                  <circle cx="12" cy="12" r="1.8" />
                                  <circle cx="12" cy="19" r="1.8" />
                                </svg>
                              </button>
                              {openActionsMenuId === studentId ? (
                                <ul role="menu">
                                  <li>
                                    <button type="button" onClick={handleMenuPlaceholder} role="menuitem">
                                      {strings.actions.registerPayment}
                                    </button>
                                  </li>
                                  <li>
                                    <button type="button" onClick={handleMenuPlaceholder} role="menuitem">
                                      {strings.actions.createPaymentRequest}
                                    </button>
                                  </li>
                                  <li>
                                    <button type="button" onClick={handleMenuPlaceholder} role="menuitem">
                                      {strings.actions.addBalance}
                                    </button>
                                  </li>
                                </ul>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="students-table__footer">
            <div>
              {totalStudents > 0 ? (
                <span>
                  {strings.pagination.showing} {showingFrom}-{showingTo} {strings.pagination.of} {totalStudents}{' '}
                  {strings.pagination.students}
                </span>
              ) : (
                <span>{strings.pagination.showing} 0 {strings.pagination.of} 0 {strings.pagination.students}</span>
              )}
            </div>
            <div className="students-table__pager">
              <button
                type="button"
                onClick={() => handlePaginationChange('prev')}
                disabled={activePage <= 1}
              >
                ←
              </button>
              <span>
                {activePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePaginationChange('next')}
                disabled={activePage >= totalPages}
              >
                →
              </button>
            </div>
          </footer>
        </section>
      ) : (
        <section className="students-view groups-view">
          <div className="groups-view__toolbar">
            <button
              type="button"
              className="students-view__filters"
              onClick={() => setIsGroupFiltersOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 5h16M7 12h10M10 19h4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {strings.actions.filters}
              {groupFiltersCount > 0 && (
                <span className="students-view__filters-count">{groupFiltersCount}</span>
              )}
            </button>
          </div>

          <div className="students-table__wrapper">
            <table className="students-table groups-table">
              <thead>
                <tr>
                  <th scope="col">{strings.groupsView.table.generation}</th>
                  <th scope="col">{strings.groupsView.table.gradeGroup}</th>
                  <th scope="col">{strings.groupsView.table.scholarLevel}</th>
                  <th scope="col">{strings.groupsView.table.status}</th>
                  <th scope="col">{strings.groupsView.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {isGroupsLoading ? (
                  <tr>
                    <td colSpan={5} className="students-table__empty">
                      <span className="students-table__loader" aria-hidden="true" />
                      {strings.groupsView.table.loading}
                    </td>
                  </tr>
                ) : groupsError ? (
                  <tr>
                    <td colSpan={5} className="students-table__empty">
                      {strings.groupsView.table.error}: {groupsError}
                    </td>
                  </tr>
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="students-table__empty">
                      {strings.groupsView.table.empty}
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => {
                    const groupId = group.group_id ?? group.id ?? group.grade_group;
                    const generation = group.generation ?? strings.groupsView.table.emptyValue;
                    const gradeGroup =
                      group.grade_group ??
                      ([group.grade, group.group].filter(Boolean).join('-') ||
                        strings.groupsView.table.emptyValue);
                    const scholarLevel =
                      group.scholar_level_name ?? strings.groupsView.table.emptyValue;
                    const isActive = isGroupActive(group);
                    const isStatusPending = pendingStatusGroupId === groupId;
                    const switchTitle = isStatusPending
                      ? (strings.actions.groupStatusUpdating ?? strings.actions.statusUpdating)
                      : isActive
                      ? groupStatusLabels.active
                      : groupStatusLabels.inactive;
                    const switchActionLabel = isActive ? strings.actions.disable : strings.actions.enable;

                    return (
                      <tr key={groupId}>
                        <td data-title={strings.groupsView.table.generation}>{generation}</td>
                        <td data-title={strings.groupsView.table.gradeGroup}>{gradeGroup}</td>
                        <td data-title={strings.groupsView.table.scholarLevel}>{scholarLevel}</td>
                        <td data-title={strings.groupsView.table.status}>
                          {renderGroupStatusPill(group, isActive)}
                        </td>
                        <td data-title={strings.groupsView.table.actions} className="students-table__actions-cell">
                          <div className="students-table__actions">
                            <button
                              type="button"
                              className="students-table__icon-button"
                              onClick={() => handleOpenEditGroup(group)}
                              aria-label={`${strings.actions.edit} ${gradeGroup}`}
                            >
                              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                                <path d="M3 16.75V19h2.25l8.9-8.9-2.25-2.25Zm12.87-7.4a.75.75 0 0 0 0-1.06l-1.16-1.16a.75.75 0 0 0-1.06 0l-1.04 1.04 2.22 2.22Z" />
                              </svg>
                            </button>
                            <label
                              className={`students-table__switch ${isStatusPending ? 'is-disabled' : ''}`}
                              title={switchTitle}
                            >
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => handleToggleGroupStatus(group, !isActive)}
                                disabled={isStatusPending}
                                aria-label={`${switchActionLabel} ${gradeGroup}`}
                              />
                              <span className="students-table__switch-track">
                                <span className="students-table__switch-thumb" />
                              </span>
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="students-table__footer">
            <div>
              {totalGroups > 0 ? (
                <span>
                  {strings.groupsView.pagination.showing} {groupShowingFrom}-{groupShowingTo}{' '}
                  {strings.groupsView.pagination.of} {totalGroups} {strings.groupsView.pagination.groups}
                </span>
              ) : (
                <span>
                  {strings.groupsView.pagination.showing} 0 {strings.groupsView.pagination.of} 0{' '}
                  {strings.groupsView.pagination.groups}
                </span>
              )}
            </div>
            <div className="students-table__pager">
              <button
                type="button"
                onClick={() => handleGroupPaginationChange('prev')}
                disabled={groupActivePage <= 1}
              >
                ←
              </button>
              <span>
                {groupActivePage} / {groupTotalPages}
              </span>
              <button
                type="button"
                onClick={() => handleGroupPaginationChange('next')}
                disabled={groupActivePage >= groupTotalPages}
              >
                →
              </button>
            </div>
          </footer>
        </section>
      )}

      {isFiltersOpen && (
        <div
          className="students-filters is-open"
          data-dismiss="filters"
          onClick={handleStudentFiltersBackdropClick}
        >
          <div className="students-filters__backdrop" aria-hidden="true" />
          <aside className="students-filters__panel" role="dialog" aria-modal="true">
            <header className="students-filters__header">
              <div>
                <h3>{strings.filters.title}</h3>
                <p>{strings.filters.subtitle}</p>
              </div>
              <button type="button" onClick={() => setIsFiltersOpen(false)} aria-label="Cerrar filtros">
                ×
              </button>
            </header>
            <form className="students-filters__form" onSubmit={handleApplyFilters}>
              <label>
                <span>{strings.filters.studentId}</span>
                <input name="student_id" value={filters.student_id} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.fullName}</span>
                <input name="full_name" value={filters.full_name} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.paymentReference}</span>
                <input name="payment_reference" value={filters.payment_reference} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.generation}</span>
                <input name="generation" value={filters.generation} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.gradeGroup}</span>
                <input name="grade_group" value={filters.grade_group} onChange={handleFilterChange} />
              </label>
              <label>
                <span>{strings.filters.enabled}</span>
                <select className='custom_select' name="enabled" value={filters.enabled} onChange={handleFilterChange}>
                  <option value="">{strings.filters.enabledOptions.all}</option>
                  <option value="true">{strings.filters.enabledOptions.enabled}</option>
                  <option value="false">{strings.filters.enabledOptions.disabled}</option>
                </select>
              </label>
              <div className="students-filters__actions">
                <button type="button" onClick={handleClearFilters} className="is-text">
                  {strings.filters.clear}
                </button>
                <button type="submit">{strings.filters.apply}</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {isGroupFiltersOpen && (
        <div
          className="students-filters is-open"
          data-dismiss="group-filters"
          onClick={handleGroupFiltersBackdropClick}
        >
          <div className="students-filters__backdrop" aria-hidden="true" />
          <aside className="students-filters__panel" role="dialog" aria-modal="true">
            <header className="students-filters__header">
              <div>
                <h3>{strings.groupsView.filters.title}</h3>
                <p>{strings.groupsView.filters.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupFiltersOpen(false)}
                aria-label={strings.groupsView.filters.close}
              >
                ×
              </button>
            </header>
            <form className="students-filters__form" onSubmit={handleApplyGroupFilters}>
              <label>
                <span>{strings.groupsView.filters.groupId}</span>
                <input name="group_id" value={groupFilters.group_id} onChange={handleGroupFilterChange} />
              </label>
              <label>
                <span>{strings.groupsView.filters.generation}</span>
                <input name="generation" value={groupFilters.generation} onChange={handleGroupFilterChange} />
              </label>
              <label>
                <span>{strings.groupsView.filters.gradeGroup}</span>
                <input name="grade_group" value={groupFilters.grade_group} onChange={handleGroupFilterChange} />
              </label>
              <label>
                <span>{strings.groupsView.filters.scholarLevel}</span>
                <input
                  name="scholar_level_name"
                  value={groupFilters.scholar_level_name}
                  onChange={handleGroupFilterChange}
                />
              </label>
              <label>
                <span>{strings.groupsView.filters.enabled}</span>
                <select
                  className="custom_select"
                  name="enabled"
                  value={groupFilters.enabled}
                  onChange={handleGroupFilterChange}
                >
                  <option value="">{strings.groupsView.filters.enabledOptions.all}</option>
                  <option value="true">{strings.groupsView.filters.enabledOptions.enabled}</option>
                  <option value="false">{strings.groupsView.filters.enabledOptions.disabled}</option>
                </select>
              </label>
              <div className="students-filters__actions">
                <button type="button" onClick={handleClearGroupFilters} className="is-text">
                  {strings.groupsView.filters.clear}
                </button>
                <button type="submit">{strings.groupsView.filters.apply}</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {isStudentModalOpen && (
        <div className="students-modal">
          <div className="students-modal__backdrop" aria-hidden="true" onClick={closeStudentModal} />
          <div className="students-modal__dialog" role="dialog" aria-modal="true">
            <header className="students-modal__header">
              <div>
                <h3>{isEditMode ? strings.form.editTitle : strings.form.title}</h3>
                <p>{isEditMode ? strings.form.editDescription : strings.form.description}</p>
              </div>
              <button type="button" onClick={closeStudentModal} aria-label="Cerrar">
                ×
              </button>
            </header>
            <form className="students-form" onSubmit={handleStudentSubmit}>
              <section>
                <h4>{strings.form.sections.personal}</h4>
                <div className="students-form__grid">
                  <label>
                    <span>{strings.form.fields.firstName}</span>
                    <input
                      name="first_name"
                      value={studentForm.first_name}
                      onChange={handleStudentFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.lastNameFather}</span>
                    <input
                      name="last_name_father"
                      value={studentForm.last_name_father}
                      onChange={handleStudentFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.lastNameMother}</span>
                    <input
                      name="last_name_mother"
                      value={studentForm.last_name_mother}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.birthDate}</span>
                    <input
                      type="date"
                      name="birth_date"
                      value={studentForm.birth_date}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.registerId}</span>
                    <input
                      name="register_id"
                      value={studentForm.register_id}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.paymentReference}</span>
                    <input
                      name="payment_reference"
                      value={studentForm.payment_reference}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                </div>
              </section>

              <section>
                <h4>{strings.form.sections.academic}</h4>
                <div className="students-form__grid">
                  <label>
                    <span>{strings.form.fields.schoolId}</span>
                    <select
                      className='custom_select'
                      name="school_id"
                      value={studentForm.school_id}
                      onChange={handleStudentFormChange}
                      disabled={!schoolOptions.length}
                      required
                    >
                      {schoolOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{strings.form.fields.groupId}</span>
                    <select
                      className='custom_select'
                      name="group_id"
                      value={studentForm.group_id}
                      onChange={handleStudentFormChange}
                      disabled={!classOptions.length}
                      required={classOptions.length > 0}
                    >
                      {classOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <h4>{strings.form.sections.contact}</h4>
                <div className="students-form__grid">
                  <label>
                    <span>{strings.form.fields.phoneNumber}</span>
                    <input
                      name="phone_number"
                      value={studentForm.phone_number}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.personalEmail}</span>
                    <input
                      type="email"
                      name="personal_email"
                      value={studentForm.personal_email}
                      onChange={handleStudentFormChange}
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.email}</span>
                    <input type="email" name="email" value={studentForm.email} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.taxId}</span>
                    <input name="tax_id" value={studentForm.tax_id} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.curp}</span>
                    <input name="curp" value={studentForm.curp} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.street}</span>
                    <input name="street" value={studentForm.street} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.extNumber}</span>
                    <input name="ext_number" value={studentForm.ext_number} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.intNumber}</span>
                    <input name="int_number" value={studentForm.int_number} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.suburb}</span>
                    <input name="suburb" value={studentForm.suburb} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.locality}</span>
                    <input name="locality" value={studentForm.locality} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.municipality}</span>
                    <input name="municipality" value={studentForm.municipality} onChange={handleStudentFormChange} />
                  </label>
                  <label>
                    <span>{strings.form.fields.state}</span>
                    <input name="state" value={studentForm.state} onChange={handleStudentFormChange} />
                  </label>
                </div>
              </section>

              {formFeedback && <p className="students-form__feedback">{formFeedback}</p>}

              <footer className="students-form__actions">
                <button type="button" onClick={closeStudentModal} className="is-secondary">
                  {strings.form.cancel}
                </button>
                <button type="submit" disabled={isSubmittingStudent}>
                  {isSubmittingStudent
                    ? '...'
                    : isEditMode
                    ? strings.form.editSubmit
                    : strings.form.submit}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {isGroupModalOpen && (
        <div className="students-modal">
          <div className="students-modal__backdrop" aria-hidden="true" onClick={closeGroupModal} />
          <div className="students-modal__dialog" role="dialog" aria-modal="true">
            <header className="students-modal__header">
              <div>
                <h3>{groupFormTitle}</h3>
                <p>{groupFormSubtitle}</p>
              </div>
              <button type="button" onClick={closeGroupModal} aria-label={groupFormCloseLabel}>
                ×
              </button>
            </header>
            <form className="students-form groups-form" onSubmit={handleGroupSubmit}>
              <div className="students-form__grid groups-form__grid">
                <label>
                  <span>{strings.groupsView.form.fields.name}</span>
                  <input name="name" value={groupForm.name} onChange={handleGroupFormChange} required />
                </label>
                <label>
                  <span>{strings.groupsView.form.fields.generation}</span>
                  <input
                    name="generation"
                    value={groupForm.generation}
                    onChange={handleGroupFormChange}
                    required
                  />
                </label>
                <label>
                  <span>{strings.groupsView.form.fields.grade}</span>
                  <input name="grade" value={groupForm.grade} onChange={handleGroupFormChange} required />
                </label>
                <label>
                  <span>{strings.groupsView.form.fields.group}</span>
                  <input name="group" value={groupForm.group} onChange={handleGroupFormChange} required />
                </label>
                <label>
                  <span>{strings.groupsView.form.fields.scholarLevelId}</span>
                  <input
                    name="scholar_level_id"
                    value={groupForm.scholar_level_id}
                    onChange={handleGroupFormChange}
                    required
                  />
                </label>
              </div>

              {groupFormFeedback && <p className="students-form__feedback">{groupFormFeedback}</p>}

              <footer className="students-form__actions">
                <button type="button" onClick={closeGroupModal} className="is-secondary">
                  {groupFormCancelLabel}
                </button>
                <button type="submit" disabled={isSubmittingGroup}>
                  {groupFormSubmitLabel}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

StudentsGroupsPage.defaultProps = {
  language: 'es',
  onStudentDetail: undefined,
  onBulkUpload: undefined,
};

export default StudentsGroupsPage;

