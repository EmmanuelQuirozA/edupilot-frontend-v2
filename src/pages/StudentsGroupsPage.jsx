import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { handleExpiredToken } from '../utils/auth';
import GlobalToast from '../components/GlobalToast.jsx';
import ActionButton from '../components/ui/ActionButton.jsx';
import AddRecordButton from '../components/ui/buttons/AddRecordButton.jsx';
import EditRecordButton from '../components/ui/buttons/EditRecordButton.jsx';
import FilterButton from '../components/ui/buttons/FilterButton.jsx';
import UiCard from '../components/ui/UiCard.jsx';
import Tabs from '../components/ui/Tabs.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import GlobalTable from '../components/ui/GlobalTable.jsx';
import SidebarModal from '../components/ui/SidebarModal.jsx';
import StudentInfo from '../components/ui/StudentInfo.jsx';

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
  school_id: '',
  scholar_level_id: '',
  name: '',
  generation: '',
  group: '',
  grade: '',
});

const UploadIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 20h16a1 1 0 0 0 1-1v-5h-2v4H5v-4H3v5a1 1 0 0 0 1 1z" />
    <path d="M12 3 7 8h3v7h4V8h3l-5-5z" />
  </svg>
);

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
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');

  const { token, logout } = useAuth();
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
  const [isGroupPrefetching, setIsGroupPrefetching] = useState(false);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupFormFeedback, setGroupFormFeedback] = useState('');
  const [groupSchoolOptions, setGroupSchoolOptions] = useState([]);
  const [scholarLevelOptions, setScholarLevelOptions] = useState([]);
  const [scholarLevelSearch, setScholarLevelSearch] = useState('');
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

  const filteredScholarLevelOptions = useMemo(() => {
    const query = scholarLevelSearch.trim().toLowerCase();
    if (!query) {
      return scholarLevelOptions;
    }

    return scholarLevelOptions.filter((option) => {
      if (!option) {
        return false;
      }

      const label = typeof option.label === 'string' ? option.label : String(option.label ?? '');
      return label.toLowerCase().includes(query);
    });
  }, [scholarLevelOptions, scholarLevelSearch]);

  const groupFormLoadErrorMessage =
    strings.groupsView?.form?.loadError ||
    strings.form?.loadError ||
    (language === 'en'
      ? 'We could not load the group information. Please try again.'
      : 'No fue posible cargar la información del grupo. Intenta nuevamente.');

  const fetchStudents = useCallback(async () => {
    setIsStudentsLoading(true);
    setStudentsError('');

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
        handleExpiredToken(response, logout);
        throw new Error('Failed to load students');
      }

      const payload = await response.json();
      const { students: normalizedStudents, total } = normalizeStudentsResponse(payload);

      setStudents(normalizedStudents);
      setTotalStudents(total);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setStudentsError(requestError.message || 'Unable to load students');
        setStudents([]);
        setTotalStudents(0);
      }
    } finally {
      setIsStudentsLoading(false);
    }

    return () => {
      controller.abort();
    };
  }, [appliedFilters, language, logout, pagination.limit, pagination.offset, token]);

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
        handleExpiredToken(response, logout);
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
  }, [
    appliedGroupFilters,
    groupPagination.limit,
    groupPagination.offset,
    language,
    logout,
    token,
  ]);

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

  const handleStudentPageChange = (page) => {
    setPagination((previous) => ({
      ...previous,
      offset: Math.max(0, (page - 1) * previous.limit),
    }));
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

  const handleGroupPageChange = (page) => {
    setGroupPagination((previous) => ({
      ...previous,
      offset: Math.max(0, (page - 1) * previous.limit),
    }));
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
          handleExpiredToken(response, logout);
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
    [language, logout, token],
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
          handleExpiredToken(response, logout);
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
    [fetchClasses, language, logout, token],
  );

  const fetchGroupSchoolOptions = useCallback(
    async (preferredSchoolId = '') => {
      try {
        const response = await fetch(`${API_BASE_URL}/schools/list?lang=${language ?? 'es'}&status_filter=-1`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error('Failed to load group schools');
        }

        const payload = await response.json();
        const schoolsList = extractListFromPayload(payload);
        let options = schoolsList
          .map((item, index) => normalizeSelectOption(item, index))
          .filter((option) => option.value !== '');

        const normalizedPreferred =
          preferredSchoolId === null || preferredSchoolId === undefined
            ? ''
            : String(preferredSchoolId);

        if (
          normalizedPreferred &&
          !options.some((option) => option.value === normalizedPreferred)
        ) {
          options = [
            ...options,
            {
              value: normalizedPreferred,
              label: normalizedPreferred,
            },
          ];
        }

        setGroupSchoolOptions(options);
        return options;
      } catch (error) {
        console.error('Failed to load group schools', error);
        setGroupSchoolOptions([]);
        throw error;
      }
    },
    [language, logout, token],
  );

  const fetchScholarLevels = useCallback(
    async (preferredScholarLevelId = '') => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/catalog/scholar-levels?lang=${language ?? 'es'}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        if (!response.ok) {
          handleExpiredToken(response, logout);
          throw new Error('Failed to load scholar levels');
        }

        const payload = await response.json();
        const levelsList = extractListFromPayload(payload);
        let options = levelsList
          .map((item, index) => normalizeSelectOption(item, index))
          .filter((option) => option.value !== '');

        const normalizedPreferred =
          preferredScholarLevelId === null || preferredScholarLevelId === undefined
            ? ''
            : String(preferredScholarLevelId);

        if (
          normalizedPreferred &&
          !options.some((option) => option.value === normalizedPreferred)
        ) {
          options = [
            ...options,
            {
              value: normalizedPreferred,
              label: normalizedPreferred,
            },
          ];
        }

        setScholarLevelOptions(options);
        return options;
      } catch (error) {
        console.error('Failed to load scholar levels', error);
        setScholarLevelOptions([]);
        throw error;
      }
    },
    [language, logout, token],
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
        handleExpiredToken(response, logout);
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
    [language, logout, token],
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

        if (!response.ok) {
          handleExpiredToken(response, logout);
        }

        const payload = await response.json();
        if (!response.ok || !payload?.success) {
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

        if (!response.ok) {
          handleExpiredToken(response, logout);
        }

        const payload = await response.json();
        if (!response.ok || !payload?.success) {
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

  const handleOpenCreateGroup = async () => {
    setGroupModalMode('create');
    setEditingGroupId(null);
    setGroupForm(createInitialGroupForm());
    setGroupFormFeedback('');
    setScholarLevelSearch('');
    setIsGroupPrefetching(true);

    try {
      const [schools, levels] = await Promise.all([
        fetchGroupSchoolOptions(),
        fetchScholarLevels(),
      ]);

      setGroupForm((previous) => ({
        ...previous,
        school_id: schools[0]?.value ?? '',
        scholar_level_id: levels[0]?.value ?? '',
      }));
      setIsGroupModalOpen(true);
    } catch (error) {
      console.error('Failed to prepare group creation form', error);
      showGlobalAlert('error', groupFormLoadErrorMessage);
    } finally {
      setIsGroupPrefetching(false);
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

      if (!response.ok) {
        handleExpiredToken(response, logout);
      }

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
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

  const handleOpenEditGroup = async (group) => {
    if (!group) {
      return;
    }

    const groupId = group.group_id ?? group.id;
    if (!groupId) {
      return;
    }

    const baseForm = {
      school_id: group.school_id === null || group.school_id === undefined ? '' : String(group.school_id),
      scholar_level_id:
        group.scholar_level_id === null || group.scholar_level_id === undefined
          ? ''
          : String(group.scholar_level_id),
      name: group.name ?? group.grade_group ?? '',
      generation: group.generation ?? '',
      group: group.group ?? '',
      grade: group.grade === null || group.grade === undefined ? '' : String(group.grade),
    };

    setGroupModalMode('edit');
    setEditingGroupId(groupId);
    setGroupFormFeedback('');
    setScholarLevelSearch('');
    setIsGroupPrefetching(true);

    try {
      const [schools, levels] = await Promise.all([
        fetchGroupSchoolOptions(baseForm.school_id),
        fetchScholarLevels(baseForm.scholar_level_id),
      ]);

      const nextSchoolId =
        baseForm.school_id && schools.some((option) => option.value === baseForm.school_id)
          ? baseForm.school_id
          : schools[0]?.value ?? '';

      const nextScholarLevelId =
        baseForm.scholar_level_id &&
        levels.some((option) => option.value === baseForm.scholar_level_id)
          ? baseForm.scholar_level_id
          : levels[0]?.value ?? '';

      setGroupForm({
        ...baseForm,
        school_id: nextSchoolId,
        scholar_level_id: nextScholarLevelId,
      });
      setIsGroupModalOpen(true);
    } catch (error) {
      console.error('Failed to open group for editing', error);
      showGlobalAlert('error', groupFormLoadErrorMessage);
      setEditingGroupId(null);
    } finally {
      setIsGroupPrefetching(false);
    }
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroupId(null);
    setGroupForm(createInitialGroupForm());
    setGroupFormFeedback('');
    setGroupModalMode('edit');
    setScholarLevelSearch('');
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

    const normalizedScholarLevelId = (groupForm.scholar_level_id ?? '').toString().trim();
    const normalizedSchoolId = (groupForm.school_id ?? '').toString().trim();
    const parsedScholarLevelId = Number(normalizedScholarLevelId);
    const parsedSchoolId = Number(normalizedSchoolId);
    const bodyPayload = {
      school_id:
        normalizedSchoolId === ''
          ? undefined
          : Number.isNaN(parsedSchoolId)
          ? normalizedSchoolId
          : parsedSchoolId,
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

      if (!response.ok) {
        handleExpiredToken(response, logout);
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

  useEffect(() => {
    if (!isGroupModalOpen) {
      return;
    }

    if (groupSchoolOptions.length === 0) {
      if (groupForm.school_id !== '') {
        setGroupForm((previous) => ({ ...previous, school_id: '' }));
      }
      return;
    }

    if (
      groupForm.school_id &&
      groupSchoolOptions.some((option) => option.value === groupForm.school_id)
    ) {
      return;
    }

    setGroupForm((previous) => ({
      ...previous,
      school_id: groupSchoolOptions[0].value,
    }));
  }, [groupSchoolOptions, groupForm.school_id, isGroupModalOpen]);

  useEffect(() => {
    if (!isGroupModalOpen) {
      return;
    }

    if (filteredScholarLevelOptions.length === 0) {
      if (groupForm.scholar_level_id !== '') {
        setGroupForm((previous) => ({ ...previous, scholar_level_id: '' }));
      }
      return;
    }

    if (
      groupForm.scholar_level_id &&
      filteredScholarLevelOptions.some((option) => option.value === groupForm.scholar_level_id)
    ) {
      return;
    }

    setGroupForm((previous) => ({
      ...previous,
      scholar_level_id: filteredScholarLevelOptions[0].value,
    }));
  }, [filteredScholarLevelOptions, groupForm.scholar_level_id, isGroupModalOpen]);

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

      if (!response.ok) {
        handleExpiredToken(response, logout);
      }

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
  const getStudentFilterFieldId = (name) => `student-filter-${name}`;
  const getGroupFilterFieldId = (name) => `group-filter-${name}`;
  const getStudentFieldId = (name) => `student-form-${name}`;
  const getGroupFieldId = (name) => `group-form-${name}`;
  const studentModalTitleId = 'student-modal-title';
  const studentModalDescriptionId = 'student-modal-description';
  const groupModalTitleId = 'group-modal-title';
  const groupModalDescriptionId = 'group-modal-description';

  const studentLimit = Number(pagination.limit) || DEFAULT_PAGINATION.limit;
  const activePage = Math.floor((pagination.offset ?? 0) / studentLimit) + 1;

  const groupLimit = Number(groupPagination.limit) || DEFAULT_PAGINATION.limit;
  const groupActivePage = Math.floor((groupPagination.offset ?? 0) / groupLimit) + 1;

  const tableStrings = strings.table ?? {};
  const tablePaginationStrings = tableStrings.pagination ?? {};

  const studentColumns = useMemo(
    () => [
      { key: 'student', header: tableStrings.student },
      { key: 'gradeGroup', header: tableStrings.gradeGroup },
      { key: 'status', header: tableStrings.status, headerClassName: 'text-center', align: 'center' },
      { key: 'actions', header: tableStrings.actions, headerClassName: 'text-end', align: 'end' },
    ],
    [tableStrings.actions, tableStrings.gradeGroup, tableStrings.status, tableStrings.student],
  );

  const groupTableStrings = strings.groupsView?.table ?? {};
  const groupColumns = useMemo(
    () => [
      { key: 'generation', header: groupTableStrings.generation },
      { key: 'gradeGroup', header: groupTableStrings.gradeGroup },
      { key: 'scholarLevel', header: groupTableStrings.scholarLevel },
      { key: 'status', header: groupTableStrings.status, headerClassName: 'text-center', align: 'center' },
      { key: 'actions', header: groupTableStrings.actions, headerClassName: 'text-end', align: 'end' },
    ],
    [groupTableStrings],
  );

  const studentSummary = useCallback(
    ({ from, to, total }) => {
      const paginationStrings = strings.pagination ?? {};
      const showingLabel = paginationStrings.showing ?? 'Mostrando';
      const ofLabel = paginationStrings.of ?? 'de';
      const studentsLabel = paginationStrings.students ?? 'registros';

      if (!total) {
        return `${showingLabel} 0 ${ofLabel} 0 ${studentsLabel}`;
      }

      return `${showingLabel} ${from}-${to} ${ofLabel} ${total} ${studentsLabel}`;
    },
    [strings.pagination],
  );

  const groupSummary = useCallback(
    ({ from, to, total }) => {
      const paginationStrings = strings.groupsView?.pagination ?? {};
      const globalPagination = strings.pagination ?? {};

      const showingLabel = paginationStrings.showing ?? globalPagination.showing ?? 'Mostrando';
      const ofLabel = paginationStrings.of ?? globalPagination.of ?? 'de';
      const groupsLabel =
        paginationStrings.groups ??
        strings.groupsView?.table?.groups ??
        globalPagination.students ??
        'registros';

      if (!total) {
        return `${showingLabel} 0 ${ofLabel} 0 ${groupsLabel}`;
      }

      return `${showingLabel} ${from}-${to} ${ofLabel} ${total} ${groupsLabel}`;
    },
    [strings],
  );

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
  const studentFormCloseLabel = strings.form?.close ?? strings.form?.closeLabel ?? 'Cerrar modal de estudiante';
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

  return (
    <div className="page">
      <GlobalToast alert={globalAlert} onClose={() => setGlobalAlert(null)} />

      <header className="page__header">
        <div>
          <p>{strings.header?.subtitle ?? description}</p>
        </div>
      </header>

      <Tabs
        navClassName="tabs nav-pills flex-wrap gap-2"
        actionsClassName="d-flex align-items-center gap-2 flex-wrap"
        tabs={[
          { key: 'students', label: strings.tabs.students },
          { key: 'groups', label: strings.tabs.groups },
        ]}
        activeKey={activeTab}
        onSelect={setActiveTab}
        renderActions={({ activeKey }) =>
          activeKey === 'students' ? (
            <>
              <ActionButton
                variant="upload"
                onClick={onBulkUpload}
                icon={UploadIcon}
              >
                {strings.actions.bulkUpload}
              </ActionButton>
              <AddRecordButton
                type="button"
                onClick={handleOpenCreateStudent}
                disabled={isStudentPrefetching}
              >
                {strings.actions.addStudent}
              </AddRecordButton>
            </>
          ) : (
            <AddRecordButton
              type="button"
              onClick={handleOpenCreateGroup}
              disabled={isGroupPrefetching}
            >
              {strings.actions.addGroup}
            </AddRecordButton>
          )
        }
      />

      {activeTab === 'students' ? (
        <UiCard className="mb-4">
          <div className="d-flex flex-column flex-lg-row gap-3 align-items-lg-center justify-content-between">
            <SearchInput
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onSubmit={handleSearchSubmit}
              placeholder={strings.searchPlaceholder}
              className="flex-grow-1"
              wrapperProps={{ role: 'search' }}
            />

            <div className="d-flex align-items-center gap-2">
              <FilterButton
                type="button"
                onClick={() => setIsFiltersOpen(true)}
                className="rounded-pill d-inline-flex align-items-center gap-2"
              >
                <span className="fw-semibold">{strings.actions.filters}</span>
                {filtersCount > 0 && (
                  <span className="badge text-bg-primary rounded-pill">{filtersCount}</span>
                )}
              </FilterButton>
            </div>
          </div>
          <GlobalTable
            className="table__wrapper"
            tableClassName="table mb-0"
            columns={studentColumns}
            data={students}
            getRowId={(student) =>
              student.student_id ?? student.id ?? student.register_id ?? student.registration_id ?? ''
            }
            renderRow={(student) => {
              const fullName =
                student.full_name ??
                [student.first_name, student.last_name_father, student.last_name_mother].filter(Boolean).join(' ');
              const gradeGroup = student.grade_group ?? student.group ?? tableStrings.noGroup;
              const scholarLevel = student.scholar_level_name ?? tableStrings.noGroup;
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
                  <td data-title={tableStrings.student} className="table__student">
                    <StudentInfo
                      name={fullName}
                      fallbackName={tableStrings.unknownStudent}
                      metaLabel={tableStrings.registrationIdLabel}
                      metaValue={registerId}
                      onClick={() => handleStudentDetailNavigation(student, fullName)}
                    />
                  </td>
                  <td data-title={tableStrings.gradeGroup}>{`${gradeGroup} ${scholarLevel}`}</td>
                  <td data-title={tableStrings.status}>{renderStatusPill(student, isActive)}</td>
                  <td data-title={tableStrings.actions} className="table__actions-cell">
                    <div className="table__actions">
                      <EditRecordButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="table__icon-button"
                        onClick={() => handleEditStudent(student)}
                        aria-label={`${strings.actions.edit} ${fullName || tableStrings.unknownStudent}`}
                      />
                      <label
                        className={`table__switch ${isStatusPending ? 'is-disabled' : ''}`}
                        title={switchTitle}
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => handleToggleStudentStatus(student, !isActive)}
                          disabled={isStatusPending}
                          aria-label={`${switchActionLabel} ${fullName || tableStrings.unknownStudent}`}
                        />
                        <span className="table__switch-track">
                          <span className="table__switch-thumb" />
                        </span>
                      </label>
                      <div className={`table__menu ${openActionsMenuId === studentId ? 'is-open' : ''}`}>
                        <ActionButton
                          variant="ghost"
                          size="icon"
                          aria-haspopup="menu"
                          aria-expanded={openActionsMenuId === studentId}
                          onClick={() => toggleActionsMenu(studentId)}
                          className="table__icon-button"
                          icon={
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="5" r="1.8" />
                              <circle cx="12" cy="12" r="1.8" />
                              <circle cx="12" cy="19" r="1.8" />
                            </svg>
                          }
                        >
                          <span className="visually-hidden">{strings.actions.more}</span>
                        </ActionButton>
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
            }}
            loading={isStudentsLoading}
            loadingMessage={tableStrings.loading}
            error={studentsError ? `${tableStrings.error}: ${studentsError}` : null}
            emptyMessage={tableStrings.empty}
            pagination={{
              currentPage: activePage,
              pageSize: studentLimit,
              totalItems: totalStudents,
              onPageChange: handleStudentPageChange,
              previousLabel: tablePaginationStrings.previous ?? '←',
              nextLabel: tablePaginationStrings.next ?? '→',
              summary: studentSummary,
            }}
          />

        </UiCard>
      ) : (
        <UiCard className="mb-4">
          <div className="d-flex justify-content-end">
            <FilterButton
              type="button"
              onClick={() => setIsGroupFiltersOpen(true)}
              className="rounded-pill d-inline-flex align-items-center gap-2"
            >
              <span className="fw-semibold">{strings.actions.filters}</span>
              {groupFiltersCount > 0 && (
                <span className="badge text-bg-primary rounded-pill">{groupFiltersCount}</span>
              )}
            </FilterButton>
          </div>

          <GlobalTable
            className="table__wrapper"
            tableClassName="table groups-table mb-0"
            columns={groupColumns}
            data={groups}
            getRowId={(group) => group.group_id ?? group.id ?? group.grade_group ?? ''}
            renderRow={(group) => {
              const groupId = group.group_id ?? group.id ?? group.grade_group;
              const generation = group.generation ?? strings.groupsView.table.emptyValue;
              const gradeGroup =
                group.grade_group ??
                ([group.grade, group.group].filter(Boolean).join('-') || strings.groupsView.table.emptyValue);
              const scholarLevel = group.scholar_level_name ?? strings.groupsView.table.emptyValue;
              const isActive = isGroupActive(group);
              const isStatusPending = pendingStatusGroupId === groupId;
              const switchTitle = isStatusPending
                ? strings.actions.groupStatusUpdating ?? strings.actions.statusUpdating
                : isActive
                ? groupStatusLabels.active
                : groupStatusLabels.inactive;
              const switchActionLabel = isActive ? strings.actions.disable : strings.actions.enable;

              return (
                <tr key={groupId}>
                  <td data-title={strings.groupsView.table.generation}>{generation}</td>
                  <td data-title={strings.groupsView.table.gradeGroup}>{gradeGroup}</td>
                  <td data-title={strings.groupsView.table.scholarLevel}>{scholarLevel}</td>
                  <td data-title={strings.groupsView.table.status}>{renderGroupStatusPill(group, isActive)}</td>
                  <td data-title={strings.groupsView.table.actions} className="table__actions-cell">
                    <div className="table__actions">
                      <EditRecordButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="table__icon-button"
                        onClick={() => handleOpenEditGroup(group)}
                        aria-label={`${strings.actions.edit} ${gradeGroup}`}
                        disabled={isGroupPrefetching}
                      />
                      <label
                        className={`table__switch ${isStatusPending ? 'is-disabled' : ''}`}
                        title={switchTitle}
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => handleToggleGroupStatus(group, !isActive)}
                          disabled={isStatusPending}
                          aria-label={`${switchActionLabel} ${gradeGroup}`}
                        />
                        <span className="table__switch-track">
                          <span className="table__switch-thumb" />
                        </span>
                      </label>
                    </div>
                  </td>
                </tr>
              );
            }}
            loading={isGroupsLoading}
            loadingMessage={strings.groupsView.table.loading}
            error={groupsError ? `${strings.groupsView.table.error}: ${groupsError}` : null}
            emptyMessage={strings.groupsView.table.empty}
            pagination={{
              currentPage: groupActivePage,
              pageSize: groupLimit,
              totalItems: totalGroups,
              onPageChange: handleGroupPageChange,
              previousLabel: '←',
              nextLabel: '→',
              summary: groupSummary,
            }}
          />

        </UiCard>
      )}

      <SidebarModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        title={strings.filters.title}
        description={strings.filters.subtitle}
        id="students-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton
              variant="text"
              onClick={handleClearFilters}
              type="button"
            >
              {strings.filters.clear}
            </ActionButton>
            <ActionButton type="submit" form="students-filters-form">
              {strings.filters.apply}
            </ActionButton>
          </div>
        }
      >
        <form id="students-filters-form" className="row g-3" onSubmit={handleApplyFilters}>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getStudentFilterFieldId('student_id')}>
              {strings.filters.studentId}
            </label>
            <input
              id={getStudentFilterFieldId('student_id')}
              name="student_id"
              value={filters.student_id}
              onChange={handleFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getStudentFilterFieldId('full_name')}>
              {strings.filters.fullName}
            </label>
            <input
              id={getStudentFilterFieldId('full_name')}
              name="full_name"
              value={filters.full_name}
              onChange={handleFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getStudentFilterFieldId('payment_reference')}>
              {strings.filters.paymentReference}
            </label>
            <input
              id={getStudentFilterFieldId('payment_reference')}
              name="payment_reference"
              value={filters.payment_reference}
              onChange={handleFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getStudentFilterFieldId('generation')}>
              {strings.filters.generation}
            </label>
            <input
              id={getStudentFilterFieldId('generation')}
              name="generation"
              value={filters.generation}
              onChange={handleFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getStudentFilterFieldId('grade_group')}>
              {strings.filters.gradeGroup}
            </label>
            <input
              id={getStudentFilterFieldId('grade_group')}
              name="grade_group"
              value={filters.grade_group}
              onChange={handleFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getStudentFilterFieldId('enabled')}>
              {strings.filters.enabled}
            </label>
            <select
              id={getStudentFilterFieldId('enabled')}
              className="form-select"
              name="enabled"
              value={filters.enabled}
              onChange={handleFilterChange}
            >
              <option value="">{strings.filters.enabledOptions.all}</option>
              <option value="true">{strings.filters.enabledOptions.enabled}</option>
              <option value="false">{strings.filters.enabledOptions.disabled}</option>
            </select>
          </div>
        </form>
      </SidebarModal>

      <SidebarModal
        isOpen={isGroupFiltersOpen}
        onClose={() => setIsGroupFiltersOpen(false)}
        title={strings.groupsView.filters.title}
        description={strings.groupsView.filters.subtitle}
        id="groups-filters"
        footer={
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <ActionButton
              variant="text"
              onClick={handleClearGroupFilters}
              type="button"
            >
              {strings.groupsView.filters.clear}
            </ActionButton>
            <ActionButton type="submit" form="groups-filters-form">
              {strings.groupsView.filters.apply}
            </ActionButton>
          </div>
        }
      >
        <form id="groups-filters-form" className="row g-3" onSubmit={handleApplyGroupFilters}>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getGroupFilterFieldId('group_id')}>
              {strings.groupsView.filters.groupId}
            </label>
            <input
              id={getGroupFilterFieldId('group_id')}
              name="group_id"
              value={groupFilters.group_id}
              onChange={handleGroupFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getGroupFilterFieldId('generation')}>
              {strings.groupsView.filters.generation}
            </label>
            <input
              id={getGroupFilterFieldId('generation')}
              name="generation"
              value={groupFilters.generation}
              onChange={handleGroupFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getGroupFilterFieldId('grade_group')}>
              {strings.groupsView.filters.gradeGroup}
            </label>
            <input
              id={getGroupFilterFieldId('grade_group')}
              name="grade_group"
              value={groupFilters.grade_group}
              onChange={handleGroupFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getGroupFilterFieldId('scholar_level_name')}>
              {strings.groupsView.filters.scholarLevel}
            </label>
            <input
              id={getGroupFilterFieldId('scholar_level_name')}
              name="scholar_level_name"
              value={groupFilters.scholar_level_name}
              onChange={handleGroupFilterChange}
              className="form-control"
            />
          </div>
          <div className="col-sm-12">
            <label className="form-label" htmlFor={getGroupFilterFieldId('enabled')}>
              {strings.groupsView.filters.enabled}
            </label>
            <select
              id={getGroupFilterFieldId('enabled')}
              className="form-select"
              name="enabled"
              value={groupFilters.enabled}
              onChange={handleGroupFilterChange}
            >
              <option value="">{strings.groupsView.filters.enabledOptions.all}</option>
              <option value="true">{strings.groupsView.filters.enabledOptions.enabled}</option>
              <option value="false">{strings.groupsView.filters.enabledOptions.disabled}</option>
            </select>
          </div>
        </form>
      </SidebarModal>

      {isStudentModalOpen && (
        <>
          <div className="modal-backdrop fade show" onClick={closeStudentModal} />
          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby={studentModalTitleId}
            aria-describedby={studentModalDescriptionId}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeStudentModal();
              }
            }}
          >
            <div className="modal-dialog modal-dialog-scrollable modal-xl">
              <form className="modal-content border-0 shadow" onSubmit={handleStudentSubmit}>
                <div className="modal-header">
                  <div>
                    <h3 id={studentModalTitleId} className="modal-title h4 mb-1">
                      {isEditMode ? strings.form.editTitle : strings.form.title}
                    </h3>
                    <p id={studentModalDescriptionId} className="text-muted mb-0">
                      {isEditMode ? strings.form.editDescription : strings.form.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeStudentModal}
                    aria-label={studentFormCloseLabel}
                  />
                </div>
                <div className="modal-body">
                  <section className="mb-4">
                    <h4 className="h6 text-primary fw-semibold mb-3">{strings.form.sections.personal}</h4>
                    <div className="row g-3">
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('first_name')}>
                          {strings.form.fields.firstName}
                        </label>
                        <input
                          id={getStudentFieldId('first_name')}
                          name="first_name"
                          value={studentForm.first_name}
                          onChange={handleStudentFormChange}
                          required
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('last_name_father')}>
                          {strings.form.fields.lastNameFather}
                        </label>
                        <input
                          id={getStudentFieldId('last_name_father')}
                          name="last_name_father"
                          value={studentForm.last_name_father}
                          onChange={handleStudentFormChange}
                          required
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('last_name_mother')}>
                          {strings.form.fields.lastNameMother}
                        </label>
                        <input
                          id={getStudentFieldId('last_name_mother')}
                          name="last_name_mother"
                          value={studentForm.last_name_mother}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('birth_date')}>
                          {strings.form.fields.birthDate}
                        </label>
                        <input
                          id={getStudentFieldId('birth_date')}
                          type="date"
                          name="birth_date"
                          value={studentForm.birth_date}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('register_id')}>
                          {strings.form.fields.registerId}
                        </label>
                        <input
                          id={getStudentFieldId('register_id')}
                          name="register_id"
                          value={studentForm.register_id}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('payment_reference')}>
                          {strings.form.fields.paymentReference}
                        </label>
                        <input
                          id={getStudentFieldId('payment_reference')}
                          name="payment_reference"
                          value={studentForm.payment_reference}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="mb-4">
                    <h4 className="h6 text-primary fw-semibold mb-3">{strings.form.sections.academic}</h4>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label" htmlFor={getStudentFieldId('school_id')}>
                          {strings.form.fields.schoolId}
                        </label>
                        <select
                          id={getStudentFieldId('school_id')}
                          className="form-select"
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
                      </div>
                      <div className="col-md-6">
                        <label className="form-label" htmlFor={getStudentFieldId('group_id')}>
                          {strings.form.fields.groupId}
                        </label>
                        <select
                          id={getStudentFieldId('group_id')}
                          className="form-select"
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
                      </div>
                    </div>
                  </section>

                  <section className="mb-4">
                    <h4 className="h6 text-primary fw-semibold mb-3">{strings.form.sections.contact}</h4>
                    <div className="row g-3">
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('phone_number')}>
                          {strings.form.fields.phoneNumber}
                        </label>
                        <input
                          id={getStudentFieldId('phone_number')}
                          name="phone_number"
                          value={studentForm.phone_number}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('personal_email')}>
                          {strings.form.fields.personalEmail}
                        </label>
                        <input
                          id={getStudentFieldId('personal_email')}
                          type="email"
                          name="personal_email"
                          value={studentForm.personal_email}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('email')}>
                          {strings.form.fields.email}
                        </label>
                        <input
                          id={getStudentFieldId('email')}
                          type="email"
                          name="email"
                          value={studentForm.email}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('tax_id')}>
                          {strings.form.fields.taxId}
                        </label>
                        <input
                          id={getStudentFieldId('tax_id')}
                          name="tax_id"
                          value={studentForm.tax_id}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('curp')}>
                          {strings.form.fields.curp}
                        </label>
                        <input
                          id={getStudentFieldId('curp')}
                          name="curp"
                          value={studentForm.curp}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('street')}>
                          {strings.form.fields.street}
                        </label>
                        <input
                          id={getStudentFieldId('street')}
                          name="street"
                          value={studentForm.street}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('ext_number')}>
                          {strings.form.fields.extNumber}
                        </label>
                        <input
                          id={getStudentFieldId('ext_number')}
                          name="ext_number"
                          value={studentForm.ext_number}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('int_number')}>
                          {strings.form.fields.intNumber}
                        </label>
                        <input
                          id={getStudentFieldId('int_number')}
                          name="int_number"
                          value={studentForm.int_number}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('suburb')}>
                          {strings.form.fields.suburb}
                        </label>
                        <input
                          id={getStudentFieldId('suburb')}
                          name="suburb"
                          value={studentForm.suburb}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('locality')}>
                          {strings.form.fields.locality}
                        </label>
                        <input
                          id={getStudentFieldId('locality')}
                          name="locality"
                          value={studentForm.locality}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('municipality')}>
                          {strings.form.fields.municipality}
                        </label>
                        <input
                          id={getStudentFieldId('municipality')}
                          name="municipality"
                          value={studentForm.municipality}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-6 col-xl-4">
                        <label className="form-label" htmlFor={getStudentFieldId('state')}>
                          {strings.form.fields.state}
                        </label>
                        <input
                          id={getStudentFieldId('state')}
                          name="state"
                          value={studentForm.state}
                          onChange={handleStudentFormChange}
                          className="form-control"
                        />
                      </div>
                    </div>
                  </section>

                  {formFeedback && (
                    <div className="alert alert-danger mb-0" role="alert">
                      {formFeedback}
                    </div>
                  )}
                </div>
                <div className="modal-footer d-flex justify-content-end gap-2">
                  <ActionButton type="button" variant="secondary" onClick={closeStudentModal}>
                    {strings.form.cancel}
                  </ActionButton>
                  <ActionButton type="submit" disabled={isSubmittingStudent}>
                    {isSubmittingStudent
                      ? '...'
                      : isEditMode
                      ? strings.form.editSubmit
                      : strings.form.submit}
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {isGroupModalOpen && (
        <>
          <div className="modal-backdrop fade show" onClick={closeGroupModal} />
          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby={groupModalTitleId}
            aria-describedby={groupModalDescriptionId}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeGroupModal();
              }
            }}
          >
            <div className="modal-dialog modal-dialog-scrollable modal-lg">
              <form className="modal-content border-0 shadow" onSubmit={handleGroupSubmit}>
                <div className="modal-header">
                  <div>
                    <h3 id={groupModalTitleId} className="modal-title h4 mb-1">
                      {groupFormTitle}
                    </h3>
                    <p id={groupModalDescriptionId} className="text-muted mb-0">
                      {groupFormSubtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeGroupModal}
                    aria-label={groupFormCloseLabel}
                  />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor={getGroupFieldId('name')}>
                        {strings.groupsView.form.fields.name}
                      </label>
                      <input
                        id={getGroupFieldId('name')}
                        name="name"
                        value={groupForm.name}
                        onChange={handleGroupFormChange}
                        required
                        className="form-control"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor={getGroupFieldId('generation')}>
                        {strings.groupsView.form.fields.generation}
                      </label>
                      <input
                        id={getGroupFieldId('generation')}
                        name="generation"
                        value={groupForm.generation}
                        onChange={handleGroupFormChange}
                        required
                        className="form-control"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor={getGroupFieldId('grade')}>
                        {strings.groupsView.form.fields.grade}
                      </label>
                      <input
                        id={getGroupFieldId('grade')}
                        name="grade"
                        value={groupForm.grade}
                        onChange={handleGroupFormChange}
                        required
                        className="form-control"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor={getGroupFieldId('group')}>
                        {strings.groupsView.form.fields.group}
                      </label>
                      <input
                        id={getGroupFieldId('group')}
                        name="group"
                        value={groupForm.group}
                        onChange={handleGroupFormChange}
                        required
                        className="form-control"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor={getGroupFieldId('school_id')}>
                        {strings.groupsView.form.fields.schoolId}
                      </label>
                      <select
                        id={getGroupFieldId('school_id')}
                        className="form-select"
                        name="school_id"
                        value={groupForm.school_id}
                        onChange={handleGroupFormChange}
                        disabled={!groupSchoolOptions.length}
                        required
                      >
                        {groupSchoolOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor={getGroupFieldId('scholar_level_id')}>
                        {strings.groupsView.form.fields.scholarLevel}
                      </label>
                      <select
                        id={getGroupFieldId('scholar_level_id')}
                        className="form-select"
                        name="scholar_level_id"
                        value={groupForm.scholar_level_id}
                        onChange={handleGroupFormChange}
                        disabled={!filteredScholarLevelOptions.length}
                        required
                      >
                        {filteredScholarLevelOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {groupFormFeedback && (
                    <div className="alert alert-danger mb-0 mt-3" role="alert">
                      {groupFormFeedback}
                    </div>
                  )}
                </div>
                <div className="modal-footer d-flex justify-content-end gap-2">
                  <ActionButton type="button" variant="secondary" onClick={closeGroupModal}>
                    {groupFormCancelLabel}
                  </ActionButton>
                  <ActionButton type="submit" disabled={isSubmittingGroup}>
                    {groupFormSubmitLabel}
                  </ActionButton>
                </div>
              </form>
            </div>
          </div>
        </>
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

