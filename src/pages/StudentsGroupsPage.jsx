import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
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

const StudentsGroupsPage = ({ language, placeholder, strings, onStudentDetail }) => {
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
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [isStudentPrefetching, setIsStudentPrefetching] = useState(false);
  const [openActionsMenuId, setOpenActionsMenuId] = useState(null);
  const [pendingStatusStudentId, setPendingStatusStudentId] = useState(null);

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

  useEffect(() => {
    const abort = fetchStudents();
    return () => {
      if (typeof abort === 'function') {
        abort();
      }
    };
  }, [fetchStudents]);

  useEffect(() => {
    setSearchValue(appliedFilters.full_name ?? '');
  }, [appliedFilters.full_name]);

  useEffect(() => {
    if (isFiltersOpen) {
      setFilters(appliedFilters);
    }
  }, [appliedFilters, isFiltersOpen]);

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
          `${API_BASE_URL}/classes?lang=en&school_id=${encodeURIComponent(schoolId)}`,
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
    [token],
  );

  const fetchSchools = useCallback(
    async (preferredSchoolId = '', preferredGroupId = '') => {
      try {
        const response = await fetch(`${API_BASE_URL}/schools/list?lang=es&status_filter=-1`, {
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
    [fetchClasses, token],
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
    setEditingStudentId(null);
    setSchoolOptions([]);
    setClassOptions([]);
    setIsStudentPrefetching(false);
  };

  const handleStudentSubmit = async (event) => {
    event.preventDefault();
    setIsSubmittingStudent(true);
    setFormFeedback('');

    const { student_id: studentId, user_id: userId, ...restForm } = studentForm;

    const sanitizedForm = Object.fromEntries(
      Object.entries(restForm).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    );

    try {
      if (modalMode === 'edit' && editingStudentId) {
        const updatePayload = {
          ...sanitizedForm,
          ...(studentId ? { student_id: studentId } : {}),
          ...(userId ? { user_id: userId } : {}),
        };

        const response = await fetch(
          `${API_BASE_URL}/students/admin/update/${encodeURIComponent(editingStudentId)}?lang=${language ?? 'es'}`,
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
          throw new Error('Failed to update student');
        }

        setGlobalAlert({ type: 'success', message: strings.form.editSuccess });
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
          throw new Error('Failed to create student');
        }

        setGlobalAlert({ type: 'success', message: strings.form.success });
      }

      closeStudentModal();
      fetchStudents();
    } catch (error) {
      console.error('Failed to submit student', error);
      const feedbackMessage = modalMode === 'edit' ? strings.form.editError : strings.form.error;
      setFormFeedback(feedbackMessage);
      setGlobalAlert({ type: 'error', message: feedbackMessage });
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleOpenCreateStudent = async () => {
    setModalMode('create');
    setEditingStudentId(null);
    setStudentForm(createInitialStudent());
    setFormFeedback('');
    setOpenActionsMenuId(null);
    setIsStudentPrefetching(true);

    try {
      await fetchSchools();
    } catch (error) {
      console.error('Failed to prepare student modal', error);
      setGlobalAlert({ type: 'error', message: strings.form.loadError });
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
      setEditingStudentId(studentId);
      await fetchSchools(mappedForm.school_id, mappedForm.group_id);
      setIsStudentModalOpen(true);
    } catch (error) {
      console.error('Failed to load student for editing', error);
      setGlobalAlert({ type: 'error', message: strings.form.loadError });
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
      const detail = await fetchStudentDetail(studentId);
      const userIdCandidate =
        detail?.user_id ??
        detail?.userId ??
        detail?.user?.user_id ??
        detail?.user?.id ??
        student?.user_id ??
        student?.userId;

      if (!userIdCandidate) {
        throw new Error('Missing user id');
      }

      const response = await fetch(
        `${API_BASE_URL}/users/update/${encodeURIComponent(userIdCandidate)}/status?lang=en`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: shouldEnable ? 1 : 0 }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      setGlobalAlert({
        type: 'success',
        message: shouldEnable
          ? strings.actions.enableSuccess ?? strings.actions.disableSuccess
          : strings.actions.disableSuccess,
      });
      fetchStudents();
    } catch (error) {
      console.error('Failed to toggle student status', error);
      setGlobalAlert({
        type: 'error',
        message: strings.actions.statusError ?? strings.actions.disableError,
      });
    } finally {
      setPendingStatusStudentId(null);
    }
  };

  const toggleActionsMenu = (studentId) => {
    setOpenActionsMenuId((previous) => (previous === studentId ? null : studentId));
  };

  const handleMenuPlaceholder = () => {
    setOpenActionsMenuId(null);
    setGlobalAlert({ type: 'info', message: strings.actions.menuPlaceholder });
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

  const handleBackdropClick = (event) => {
    if (event.target.dataset.dismiss === 'filters') {
      setIsFiltersOpen(false);
    }
  };

  return (
    <div className="students-groups">
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
            <button type="button" className="students-groups__tab-action students-groups__tab-action--secondary">
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
        ) : null}
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

          {globalAlert && (
            <div className={`students-groups__alert students-groups__alert--${globalAlert.type}`}>
              {globalAlert.message}
            </div>
          )}

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
                          {gradeGroup}
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
        <section className="students-groups__placeholder">
          <div>
            <h3>{strings.groupsPlaceholder.title}</h3>
            <p>{strings.groupsPlaceholder.description}</p>
          </div>
        </section>
      )}

      {isFiltersOpen && (
        <div className="students-filters is-open" data-dismiss="filters" onClick={handleBackdropClick}>
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
                    <span>{strings.form.fields.username}</span>
                    <input
                      name="username"
                      value={studentForm.username}
                      onChange={handleStudentFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>{strings.form.fields.password}</span>
                    <input
                      type="password"
                      name="password"
                      value={studentForm.password}
                      onChange={handleStudentFormChange}
                      required
                    />
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

              <section>
                <h4>{strings.form.sections.academic}</h4>
                <div className="students-form__grid">
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
    </div>
  );
};

StudentsGroupsPage.defaultProps = {
  language: 'es',
  onStudentDetail: undefined,
};

export default StudentsGroupsPage;

