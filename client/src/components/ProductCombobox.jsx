import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Combobox de selección estricta de producto:
 * Permite escribir y filtrar por nombre, código interno o MTX,
 * pero exige elegir una opción del catálogo; si pierde el foco sin seleccionar, blanquea lo escrito.
 */
export default function ProductCombobox({
  productos = [],
  value,
  selectedLabel = '',
  onSelect,
  placeholder = 'Escribí para buscar producto...'
}) {
  const [query, setQuery] = useState(selectedLabel || '');
  const [isOpen, setIsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      if (value) {
        const found = productos.find((p) => Number(p.id_producto) === Number(value));
        setQuery(found ? found.nombre : selectedLabel || '');
      } else {
        setQuery('');
      }
    }
  }, [value, selectedLabel, productos, dirty]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !dirty) {
      return productos.slice(0, 40);
    }
    return productos
      .filter(
        (p) =>
          String(p.nombre || '').toLowerCase().includes(q) ||
          String(p.codigo || '').toLowerCase().includes(q) ||
          String(p.codigomtx || '').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [productos, query, dirty]);

  const handleInputFocus = (e) => {
    setIsOpen(true);
    const input = e.target;
    input.select();
    requestAnimationFrame(() => input.select());
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setDirty(true);
    setIsOpen(true);
  };

  const handlePickOption = (prod) => {
    setDirty(false);
    setQuery(prod.nombre || '');
    setIsOpen(false);
    if (onSelect) onSelect(prod);
  };

  const handleBlur = () => {
    setIsOpen(false);
    if (dirty) {
      setDirty(false);
      setQuery('');
      if (onSelect) onSelect(null);
    } else if (!value) {
      setQuery('');
    }
  };

  return (
    <div className="product-combobox">
      <div className="product-combobox-input-wrap">
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className={`dev-select-plain product-combobox-input ${!value ? 'empty' : ''}`}
          placeholder={placeholder}
          value={query}
          onFocus={handleInputFocus}
          onChange={handleInputChange}
          onBlur={handleBlur}
        />
        <ChevronDown size={15} className="product-combobox-chevron" />
      </div>

      {isOpen && (
        <div className="product-combobox-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="product-combobox-empty">
              Sin coincidencias en el catálogo
            </div>
          ) : (
            filtered.map((cp) => {
              const isSelected = Number(cp.id_producto) === Number(value);
              return (
                <button
                  key={cp.id_producto}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`product-combobox-item ${isSelected ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePickOption(cp);
                  }}
                >
                  <span className="product-combobox-name">{cp.nombre}</span>
                  {(cp.codigomtx || cp.codigo) && (
                    <span className="product-combobox-meta">
                      {cp.codigomtx ? `MTX: ${cp.codigomtx}` : ''}
                      {cp.codigomtx && cp.codigo ? ' • ' : ''}
                      {cp.codigo ? `Cód: ${cp.codigo}` : ''}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
