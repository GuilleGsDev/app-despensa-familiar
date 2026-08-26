import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, Minus, PlusCircle, AlertTriangle, PackageOpen, Loader2 } from 'lucide-react';

const CATEGORIAS = ['Todos', 'Despensa', 'Refrigerador', 'Congelador', 'Verdulería', 'Limpieza'];

export default function DespensaView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('Todos');
  const [mostrarModal, setMostrarModal] = useState(false);

  // Formulario nuevo item
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Despensa');
  const [cantidad, setCantidad] = useState(1);
  const [unidad, setUnidad] = useState('un');
  const [cantMin, setCantMin] = useState(1);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetchItems();

    // Suscripción Realtime a cambios en alimentos
    const channel = supabase
      .channel('alimentos_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alimentos' },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('alimentos')
      .select('*')
      .order('nombre', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const modificarStock = async (id, delta, actual) => {
    const stockBase = Number(actual) || 0;
    const nuevaCantidad = Math.max(0, parseFloat((stockBase + delta).toFixed(2)));

    // Actualización optimista inmediata en UI
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, cantidad_actual: nuevaCantidad } : it))
    );

    const { error } = await supabase
      .from('alimentos')
      .update({ cantidad_actual: nuevaCantidad })
      .eq('id', id);

    if (error) {
      console.error('Error al actualizar stock:', error);
      fetchItems();
    }
  };

  const handleCrearItem = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from('alimentos')
        .insert([
          {
            nombre: nombre.trim(),
            categoria,
            cantidad_actual: Number(cantidad) || 0,
            unidad_medida: unidad,
            cantidad_minima: Number(cantMin) || 0,
          },
        ])
        .select();

      if (error) {
        alert(`Error al guardar: ${error.message}`);
      } else if (data && data.length > 0) {
        setNombre('');
        setCantidad(1);
        setCantMin(1);
        setMostrarModal(false);
        fetchItems();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const itemsFiltrados = items.filter((item) => {
    const cumpleFiltro = categoriaSel === 'Todos' || item.categoria === categoriaSel;
    const cumpleBusqueda = item.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return cumpleFiltro && cumpleBusqueda;
  });

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y botón */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar alimento..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-sm"
          />
        </div>
        <button
          onClick={() => setMostrarModal(true)}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition flex items-center gap-1 text-xs font-semibold shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Agregar</span>
        </button>
      </div>

      {/* Categorías */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {CATEGORIAS.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoriaSel(cat)}
            className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition ${
              categoriaSel === cat
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Listado */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <p className="text-xs">Cargando despensa...</p>
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-6">
          <PackageOpen className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-700">No hay alimentos registrados</p>
          <p className="text-xs text-stone-400 mt-1">Usa el botón "Agregar" para ingresar los insumos del hogar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {itemsFiltrados.map((item) => {
            const stockActualNum = Number(item.cantidad_actual ?? 0);
            const stockMinNum = Number(item.cantidad_minima ?? 0);
            const stockBajo = stockActualNum <= stockMinNum;

            return (
              <div
                key={item.id}
                className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-stone-800 truncate">{item.nombre}</h3>
                    {stockBajo && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Bajo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {item.categoria} • Mínimo: {stockMinNum} {item.unidad_medida}
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-xl border border-stone-200 shrink-0">
                  <button
                    onClick={() => modificarStock(item.id, -1, stockActualNum)}
                    className="w-7 h-7 flex items-center justify-center bg-white hover:bg-stone-200 text-stone-700 rounded-lg shadow-2xs active:scale-95 transition"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[45px] text-center text-xs font-bold text-stone-800">
                    {stockActualNum}{' '}
                    <span className="text-[10px] font-normal text-stone-500">{item.unidad_medida}</span>
                  </span>
                  <button
                    onClick={() => modificarStock(item.id, 1, stockActualNum)}
                    className="w-7 h-7 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs active:scale-95 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-xl border border-stone-200">
            <h2 className="text-base font-bold text-stone-900 mb-4">Nuevo Alimento / Insumo</h2>

            <form onSubmit={handleCrearItem} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Leche entera, Arroz, Huevos..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Categoría</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CATEGORIAS.filter((c) => c !== 'Todos').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Unidad</label>
                  <select
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="un">Unidades (un)</option>
                    <option value="kg">Kilos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="L">Litros (L)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="paq">Paquetes (paq)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={cantMin}
                    onChange={(e) => setCantMin(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="flex-1 py-2.5 text-stone-600 bg-stone-100 hover:bg-stone-200 font-medium text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex-1 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 font-medium text-xs rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Alimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}