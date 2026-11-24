import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminUsuarios,
  fetchAdminOrganizaciones,
  createAdminUsuario,
  updateAdminUsuario,
  deleteAdminUsuario
} from '../../services/api';
import { useAuth } from '../../config/AuthContext';
import AdminPagination from './AdminPagination';
import {
  UserPlus,
  Edit2,
  Trash2,
  Search,
  X,
  Check,
  Building2,
  ShieldCheck
} from 'lucide-react';

const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_ADMIN_PAGE_SIZE || 15);

export default function AdminUsuarios({ currentUser }) {
  const { refreshAvailableUsers } = useAuth();
  const isSysAdmin = currentUser?.rol === 'sysadmin';

  const [usuarios, setUsuarios] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({ page: 1, page_size: DEFAULT_PAGE_SIZE, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formEmail, setFormEmail] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formRol, setFormRol] = useState('chofer');
  const [formOrgId, setFormOrgId] = useState('');
  const [formCodigoChofer, setFormCodigoChofer] = useState('');
  const [formOrgLabel, setFormOrgLabel] = useState('');
  const [formActivo, setFormActivo] = useState(true);

  const [orgQuery, setOrgQuery] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);

  const loadUsuarios = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);
      const nextPage = overrides.page !== undefined ? overrides.page : page;
      const nextSize = overrides.pageSize !== undefined ? overrides.pageSize : pageSize;
      const nextQ = overrides.q !== undefined ? overrides.q : q;
      const res = await fetchAdminUsuarios({
        q: nextQ,
        page: nextPage,
        page_size: nextSize
      });
      setUsuarios(res.usuarios || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al obtener la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  }, [q, page, pageSize]);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  const searchOrgs = useCallback(async (queryText = '') => {
    try {
      setOrgsLoading(true);
      const res = await fetchAdminOrganizaciones({ q: queryText });
      setOrgs(res.organizaciones || []);
    } catch (err) {
      console.warn('Error buscando organizaciones:', err.message);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormNombre('');
    setFormRol('chofer');
    setFormOrgId('');
    setFormCodigoChofer('');
    setFormOrgLabel('');
    setFormActivo(true);
    setOrgQuery('');
    setModalOpen(true);
    searchOrgs('');
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setFormEmail(u.email || '');
    setFormNombre(u.nombre || '');
    setFormRol(u.rol || 'chofer');
    setFormOrgId(u.organizacion_id ? String(u.organizacion_id) : '');
    setFormCodigoChofer(u.codigo_chofer || '');
    setFormOrgLabel(
      u.organizacion_id
        ? `#${u.organizacion_id} • ${u.organizacion_nombre || 'Organización'} (${u.organizacion_codigo || u.codigo_chofer || ''})`
        : ''
    );
    setFormActivo(u.activo === 1 || u.activo === true);
    setOrgQuery('');
    setModalOpen(true);
    searchOrgs('');
  };

  const handleSelectOrg = (org) => {
    setFormOrgId(String(org.Organizacionid));
    setFormCodigoChofer(org.Codigo || '');
    setFormOrgLabel(`#${org.Organizacionid} • ${org.Nombre} (${org.Codigo || 'S/C'})`);
  };

  const handleClearOrg = () => {
    setFormOrgId('');
    setFormCodigoChofer('');
    setFormOrgLabel('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      const payload = {
        nombre: formNombre.trim(),
        rol: isSysAdmin ? formRol : 'chofer',
        organizacion_id: formOrgId ? Number(formOrgId) : null,
        codigo_chofer: formCodigoChofer ? formCodigoChofer.trim() : null,
        activo: formActivo ? 1 : 0
      };

      if (editingUser) {
        await updateAdminUsuario(editingUser.id, payload);
        setSuccessMsg(`Usuario ${editingUser.email} actualizado correctamente.`);
      } else {
        await createAdminUsuario({
          email: formEmail.trim().toLowerCase(),
          ...payload
        });
        setSuccessMsg(`Usuario ${formEmail.trim().toLowerCase()} dado de alta correctamente.`);
      }

      setModalOpen(false);
      await loadUsuarios();
      if (refreshAvailableUsers) refreshAvailableUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    const actionLabel = isSysAdmin ? 'eliminar definitivamente' : 'desactivar';
    if (!window.confirm(`¿Desea ${actionLabel} al usuario ${u.nombre} (${u.email})?`)) {
      return;
    }
    try {
      setError(null);
      setSuccessMsg(null);
      const res = await deleteAdminUsuario(u.id);
      setSuccessMsg(res.message || 'Operación completada.');
      await loadUsuarios();
      if (refreshAvailableUsers) refreshAvailableUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar la acción.');
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-info-banner">
        <ShieldCheck size={18} />
        <span>
          Los usuarios inician sesión únicamente mediante <strong>SSO Microsoft 365</strong>. Para que un chofer visualice solo sus hojas de ruta, debe estar mapeado a su <code>Organizacionid</code> en el ERP.
        </span>
      </div>

      <form
        className="admin-filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          loadUsuarios({ page: 1 });
        }}
      >
        <div className="admin-input-icon-wrap" style={{ flex: '1 1 260px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, email u organización..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="admin-input"
          />
        </div>
        <button type="submit" className="admin-btn admin-btn-secondary">Buscar</button>
        {q && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setQ('');
              setPage(1);
              loadUsuarios({ q: '', page: 1 });
            }}
          >
            Limpiar
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={openCreateModal}
        >
          <UserPlus size={16} />
          <span>{isSysAdmin ? 'Nuevo Usuario' : 'Nuevo Chofer'}</span>
        </button>
      </form>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {successMsg && <div className="admin-alert admin-alert-success">{successMsg}</div>}

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email Microsoft 365</th>
                <th>Rol</th>
                <th>Mapeo ERP (Organización / Clave)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="admin-empty-cell">Cargando usuarios...</td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty-cell">No hay usuarios cargados.</td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.nombre}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`admin-role-badge role-${u.rol}`}>{u.rol}</span>
                    </td>
                    <td>
                      {u.organizacion_id ? (
                        <div>
                          <strong>#{u.organizacion_id}</strong> {u.organizacion_nombre || ''}
                          <div className="admin-muted-text" style={{ fontSize: '0.76rem' }}>
                            Código: {u.organizacion_codigo || u.codigo_chofer || '—'}
                          </div>
                        </div>
                      ) : (
                        <span className="admin-muted-text">
                          {u.rol === 'chofer' ? 'Sin mapear (requerido)' : 'No aplica'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-badge ${u.activo ? 'admin-badge-green' : 'admin-badge-red'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-secondary"
                          onClick={() => openEditModal(u)}
                          title="Editar usuario"
                        >
                          <Edit2 size={14} />
                          <span>Editar</span>
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-danger-outline"
                            onClick={() => handleDelete(u)}
                            title={isSysAdmin ? 'Eliminar usuario' : 'Desactivar chofer'}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          pagination={pagination}
          loading={loading}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
        />
      </div>

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ margin: 0 }}>
                {editingUser ? `Editar usuario: ${editingUser.email}` : 'Alta de Usuario Microsoft 365'}
              </h3>
              <button type="button" className="admin-icon-btn" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>Email corporativo (Microsoft 365)</label>
                    <input
                      type="email"
                      required
                      disabled={Boolean(editingUser)}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="usuario@donyeyo.com.ar"
                      className="admin-input"
                    />
                  </div>

                  <div className="admin-field">
                    <label>Nombre completo</label>
                    <input
                      type="text"
                      required
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      placeholder="Nombre y Apellido"
                      className="admin-input"
                    />
                  </div>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>Rol asignado</label>
                    {isSysAdmin ? (
                      <select
                        value={formRol}
                        onChange={(e) => setFormRol(e.target.value)}
                        className="admin-input"
                      >
                        <option value="chofer">chofer (Solo App Móvil)</option>
                        <option value="logistica">logistica (Gestor + Alta Choferes)</option>
                        <option value="sysadmin">sysadmin (Control Total + Auditoría)</option>
                      </select>
                    ) : (
                      <input type="text" value="chofer (Solo App Móvil)" disabled className="admin-input" />
                    )}
                  </div>

                  <div className="admin-field">
                    <label>Estado de la cuenta</label>
                    <label className="admin-checkbox-label" style={{ height: '40px' }}>
                      <input
                        type="checkbox"
                        checked={formActivo}
                        onChange={(e) => setFormActivo(e.target.checked)}
                      />
                      <span>Usuario habilitado para ingresar</span>
                    </label>
                  </div>
                </div>

                <div className="admin-subcard">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={16} style={{ color: 'var(--dy-blue)' }} />
                      <strong>Mapeo con Organización / Chofer del ERP</strong>
                    </div>
                    {formOrgId && (
                      <button type="button" className="admin-link-btn" onClick={handleClearOrg}>
                        Quitar mapeo
                      </button>
                    )}
                  </div>

                  <div style={{ marginBottom: '10px', fontSize: '0.84rem' }}>
                    {formOrgId ? (
                      <span className="admin-badge admin-badge-green">
                        Mapeado a: {formOrgLabel || `Organizacionid #${formOrgId}`}
                      </span>
                    ) : (
                      <span className="admin-muted-text">
                        Sin organización asignada. Buscá debajo el chofer/transporte del ERP para vincularlo.
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <div className="admin-input-icon-wrap" style={{ flex: 1 }}>
                      <Search size={15} />
                      <input
                        type="text"
                        placeholder="Buscar organización ERP por nombre, código o ID..."
                        value={orgQuery}
                        onChange={(e) => setOrgQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchOrgs(orgQuery);
                          }
                        }}
                        className="admin-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => searchOrgs(orgQuery)}
                      disabled={orgsLoading}
                    >
                      Buscar ERP
                    </button>
                  </div>

                  <div className="admin-org-picker-list">
                    {orgsLoading ? (
                      <div className="admin-empty-cell">Buscando en ORGANIZACION...</div>
                    ) : orgs.length === 0 ? (
                      <div className="admin-empty-cell">Sin resultados. Probá con otro nombre o código.</div>
                    ) : (
                      orgs.map((org) => {
                        const selected = String(org.Organizacionid) === String(formOrgId);
                        return (
                          <button
                            key={org.Organizacionid}
                            type="button"
                            className={`admin-org-option ${selected ? 'selected' : ''}`}
                            onClick={() => handleSelectOrg(org)}
                          >
                            <div>
                              <strong>{org.Nombre}</strong>
                              <div className="admin-muted-text" style={{ fontSize: '0.75rem' }}>
                                ID: {org.Organizacionid} • Código: {org.Codigo || 'S/C'}
                                {org.es_chofer_hr ? ' • Figura como Chofer en HR' : ''}
                                {org.es_transportista_hr ? ' • Transporte en HR' : ''}
                              </div>
                            </div>
                            {selected && <Check size={17} style={{ color: 'var(--dy-blue)' }} />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
