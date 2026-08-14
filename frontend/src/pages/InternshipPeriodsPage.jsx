import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../App.css';
import { createPeriod, deletePeriod, getAllPeriods, updatePeriod } from '../services/periodService';

const emptyForm = {
  name: '',
  academicYear: '',
  startDate: '',
  endDate: '',
  description: '',
};

const statusOptions = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'UPCOMING', label: 'Sắp diễn ra' },
  { value: 'ONGOING', label: 'Đang diễn ra' },
  { value: 'COMPLETED', label: 'Đã kết thúc' },
];

const sortOptions = [
  { value: 'startDate', label: 'Ngày bắt đầu' },
  { value: 'endDate', label: 'Ngày kết thúc' },
  { value: 'name', label: 'Tên kỳ' },
  { value: 'academicYear', label: 'Năm học' },
];

function PeriodBadge({ period }) {
  const status = period.computedStatus || 'UPCOMING';
  const label = period.statusLabel || (status === 'UPCOMING' ? 'Sắp diễn ra' : status === 'ONGOING' ? 'Đang diễn ra' : 'Đã kết thúc');
  return <span className={`status-chip ${status === 'ONGOING' ? 'status-done' : status === 'COMPLETED' ? 'status-pending' : ''}`}>{label}</span>;
}

function InternshipPeriodsPage() {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1, limit: 8 });
  const [query, setQuery] = useState({ search: '', status: 'ALL', sortBy: 'startDate', sortOrder: 'asc', page: 1, limit: 8 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    setUser(stored ? JSON.parse(stored) : null);
  }, []);

  const location = useLocation();

  useEffect(() => {
    // open create modal when route is /periods/new or query openCreate=1
    try {
      const params = new URLSearchParams(location.search);
      if (location.pathname && location.pathname.endsWith('/new')) {
        openCreate();
      } else if (params.get('openCreate') === '1') {
        openCreate();
      }
    } catch (e) {
      // ignore
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const loadPeriods = async () => {
      setLoading(true);
      try {
        const res = await getAllPeriods({
          search: query.search,
          status: query.status === 'ALL' ? '' : query.status,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          page: query.page,
          limit: query.limit,
        });

        const data = res?.data;
        if (Array.isArray(data)) {
          setPeriods(data);
          setPagination((current) => ({ ...current, totalItems: data.length, totalPages: 1, currentPage: 1 }));
        } else {
          setPeriods(data?.items || []);
          setPagination(data?.pagination || { totalItems: 0, totalPages: 1, currentPage: 1, limit: query.limit });
        }
      } catch (error) {
        setMessage(error.response?.data?.message || 'Không tải được kỳ thực tập.');
        setPeriods([]);
      } finally {
        setLoading(false);
      }
    };

    loadPeriods();
  }, [query]);

  const openCreate = () => {
    setEditingPeriod(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (period) => {
    setEditingPeriod(period);
    setForm({
      name: period.name || '',
      academicYear: period.academicYear || '',
      startDate: period.startDate || '',
      endDate: period.endDate || '',
      description: period.description || '',
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPeriod(null);
    setForm(emptyForm);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    
    // Client-side validation
    if (!form.name || !form.name.trim()) {
      setMessage('Vui lòng nhập tên kỳ');
      return;
    }
    if (!form.startDate) {
      setMessage('Vui lòng chọn ngày bắt đầu');
      return;
    }
    if (!form.endDate) {
      setMessage('Vui lòng chọn ngày kết thúc');
      return;
    }
    
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end <= start) {
      setMessage('Ngày kết thúc phải sau ngày bắt đầu');
      return;
    }
    
    try {
      // Auto-generate academicYear from startDate if empty
      const payload = { 
        ...form,
        academicYear: form.academicYear || `${start.getFullYear()}-${end.getFullYear()}`
      };
      
      const res = editingPeriod
        ? await updatePeriod(editingPeriod.id, payload)
        : await createPeriod(payload);

      if (res?.success) {
        setMessage(editingPeriod ? 'Đã cập nhật kỳ thực tập.' : 'Đã tạo kỳ thực tập mới.');
        closeForm();
        setQuery((current) => ({ ...current }));
      } else {
        setMessage(res?.message || 'Không thể lưu kỳ thực tập.');
      }
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || 'Không thể lưu kỳ thực tập.');
    }
  };

  const handleDelete = async (period) => {
    if (!window.confirm(`Xóa kỳ thực tập "${period.name}"?`)) return;
    try {
      const res = await deletePeriod(period.id);
      if (res?.success) {
        setMessage('Đã xóa kỳ thực tập.');
        setQuery((current) => ({ ...current }));
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Không thể xóa kỳ thực tập.');
    }
  };

  const changeQuery = (name, value) => {
    setQuery((current) => ({ ...current, [name]: value, page: name === 'page' ? value : 1 }));
  };

  return (
    <div className="page-shell period-page">
      <section className="hero-card period-hero">
        <div className="period-hero-top">
          <div>
            <div className="eyebrow">Danh sách kỳ thực tập</div>
            <h1>Quản lý tất cả các kỳ thực tập</h1>
            <p>Tìm kiếm, lọc, phân trang và thao tác nhanh theo từng kỳ.</p>
          </div>
          {isAdmin && <button className="btn" type="button" onClick={openCreate}>Thêm kỳ thực tập</button>}
        </div>

        <div className="period-toolbar">
          <input
            type="text"
            placeholder="Tìm theo tên kỳ hoặc năm học"
            value={query.search}
            onChange={(e) => changeQuery('search', e.target.value)}
          />
          <select value={query.status} onChange={(e) => changeQuery('status', e.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select value={query.sortBy} onChange={(e) => changeQuery('sortBy', e.target.value)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>Sắp xếp: {option.label}</option>
            ))}
          </select>
          <select value={query.sortOrder} onChange={(e) => changeQuery('sortOrder', e.target.value)}>
            <option value="asc">Tăng dần</option>
            <option value="desc">Giảm dần</option>
          </select>
        </div>
      </section>

      {message && <div className="info-card"><p>{message}</p></div>}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Danh sách kỳ</h3>
            <p>{pagination.totalItems} kỳ thực tập</p>
          </div>
          <div className="period-page-size">
            <label>
              Hiển thị
              <select value={query.limit} onChange={(e) => changeQuery('limit', Number(e.target.value))}>
                {[5, 8, 10, 20].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <p>Đang tải...</p>
        ) : periods.length === 0 ? (
          <p>Chưa có kỳ thực tập nào.</p>
        ) : (
          <div className="table-wrapper">
            <table className="simple-table period-table">
              <thead>
                <tr>
                  <th>Tên kỳ</th>
                  <th>Năm học</th>
                  <th>Ngày bắt đầu</th>
                  <th>Ngày kết thúc</th>
                  <th>Trạng thái</th>
                  <th>Tiến độ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td>
                      <div className="period-name-cell">
                        <strong>{period.name}</strong>
                        {period.description && <span>{period.description}</span>}
                      </div>
                    </td>
                    <td>{period.academicYear}</td>
                    <td>{period.startDate}</td>
                    <td>{period.endDate}</td>
                    <td><PeriodBadge period={period} /></td>
                    <td>
                      <div className="period-progress-cell">
                        <div className="progress-bar"><span style={{ width: `${period.progress?.percentComplete || 0}%` }} /></div>
                        <small>{period.progress?.percentComplete || 0}% · {period.progress?.passedDays || 0}/{period.progress?.totalDays || 0} ngày</small>
                      </div>
                    </td>
                    <td>
                      <div className="button-row period-actions">
                        <button className="btn" type="button" onClick={() => navigate(`/periods/${period.id}`)}>Chi tiết</button>
                        {isAdmin && <button className="btn outline" type="button" onClick={() => openEdit(period)} disabled={period.computedStatus === 'COMPLETED'}>Sửa</button>}
                        {isAdmin && <button className="btn outline danger" type="button" onClick={() => handleDelete(period)}>Xóa</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-row">
          <button className="btn outline" type="button" onClick={() => changeQuery('page', Math.max(1, query.page - 1))} disabled={query.page <= 1}>Trước</button>
          <span>Trang {pagination.currentPage} / {pagination.totalPages}</span>
          <button className="btn outline" type="button" onClick={() => changeQuery('page', Math.min(pagination.totalPages, query.page + 1))} disabled={query.page >= pagination.totalPages}>Sau</button>
        </div>
      </section>

      {isFormOpen && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal period-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPeriod ? 'Sửa kỳ thực tập' : 'Thêm kỳ thực tập'}</h3>
              <button className="modal-close" onClick={closeForm}>×</button>
            </div>

            <form className="form-stack" onSubmit={handleSubmit}>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Tên kỳ" required />
              <input name="academicYear" value={form.academicYear} onChange={handleChange} placeholder="Năm học (tự động nếu trống)" />
              <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required />
              <input type="date" name="endDate" value={form.endDate} onChange={handleChange} required />
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Mô tả kỳ thực tập" rows="4" />
              <div className="button-row">
                <button className="btn" type="submit">Lưu</button>
                <button className="btn outline" type="button" onClick={closeForm}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InternshipPeriodsPage;