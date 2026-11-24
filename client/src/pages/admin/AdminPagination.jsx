import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

export default function AdminPagination({ pagination, onPageChange, onPageSizeChange, loading }) {
  const page = Number(pagination?.page || 1);
  const pageSize = Number(pagination?.page_size || 15);
  const total = Number(pagination?.total || 0);
  const totalPages = Math.max(1, Number(pagination?.total_pages || Math.ceil(total / pageSize) || 1));

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Construir ventana de hasta 5 botones de página visibles
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let first = Math.max(1, page - Math.floor(maxVisible / 2));
    let last = Math.min(totalPages, first + maxVisible - 1);
    if (last - first + 1 < maxVisible) {
      first = Math.max(1, last - maxVisible + 1);
    }
    for (let p = first; p <= last; p += 1) {
      pages.push(p);
    }
    return { first, last, pages };
  };

  const { first, last, pages } = getPageNumbers();

  return (
    <div className="admin-pagination">
      <div className="admin-pagination-info">
        {total === 0 ? (
          <span>0 registros encontrados</span>
        ) : (
          <span>
            Mostrando <strong>{start}–{end}</strong> de <strong>{total.toLocaleString('es-AR')}</strong> registros
          </span>
        )}

        {onPageSizeChange && (
          <label className="admin-page-size-wrap">
            <span>Filas:</span>
            <select
              value={pageSize}
              disabled={loading}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="admin-page-size-select"
            >
              {!PAGE_SIZE_OPTIONS.includes(pageSize) && (
                <option value={pageSize}>{pageSize}</option>
              )}
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-page-btn"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Página anterior"
        >
          <ChevronLeft size={16} />
          <span>Anterior</span>
        </button>

        {first > 1 && (
          <>
            <button
              type="button"
              className="admin-page-btn"
              disabled={loading}
              onClick={() => onPageChange(1)}
            >
              1
            </button>
            {first > 2 && <span className="admin-page-ellipsis">…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`admin-page-btn ${p === page ? 'active' : ''}`}
            disabled={loading}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}

        {last < totalPages && (
          <>
            {last < totalPages - 1 && <span className="admin-page-ellipsis">…</span>}
            <button
              type="button"
              className="admin-page-btn"
              disabled={loading}
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          className="admin-page-btn"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="Página siguiente"
        >
          <span>Siguiente</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
