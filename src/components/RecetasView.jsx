import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Users, PlusCircle, Loader2, ChefHat, Trash2, Edit3, X } from 'lucide-react';

export default function RecetasView() {
  const [recetas, setRecetas] = useState([]);
  const [alimentos, setAlimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [idEditando, setIdEditando] = useState(null);

  // Formulario receta
  const [nombre, setNombre] = useState('');
  const [tiempo, setTiempo] = useState(30);
  const [porciones, setPorciones] = useState(2);
  const [ingredientes, setIngredientes] = useState([{ alimento_id: '', cantidad_requerida: 1 }]);

  useEffect(() => {
    cargarDatos();

    const channel = supabase
      .channel('recetas_catalog_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alimentos' }, () => cargarDatos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recetas' }, () => cargarDatos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receta_ingredientes' }, () => cargarDatos())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cargarDatos = async () => {
    const { data: dataAlimentos } = await supabase
      .from('alimentos')
      .select('*')
      .order('nombre', { ascending: true });

    if (dataAlimentos) setAlimentos(dataAlimentos);

    const { data: dataRecetas } = await supabase
      .from('recetas')
      .select(`
        *,
        receta_ingredientes (
          id,
          alimento_id,
          cantidad_requerida,
          alimentos (
            id,
            nombre,
            unidad_medida
          )
        )
      `)
      .order('nombre', { ascending: true });

    if (dataRecetas) setRecetas(dataRecetas);
    setLoading(false);
  };

  const abrirModalCrear = () => {
    setIdEditando(null);
    setNombre('');
    setTiempo(30);
    setPorciones(2);
    setIngredientes([{ alimento_id: '', cantidad_requerida: 1 }]);
    setMostrarModal(true);
  };

  const abrirModalEditar = (receta) => {
    setIdEditando(receta.id);
    setNombre(receta.nombre || '');
    setTiempo(receta.tiempo_minutos || 30);
    setPorciones(receta.porciones || 2);

    if (receta.receta_ingredientes && receta.receta_ingredientes.length > 0) {
      setIngredientes(
        receta.receta_ingredientes.map((ri) => ({
          alimento_id: ri.alimento_id,
          cantidad_requerida: ri.cantidad_requerida,
        }))
      );
    } else {
      setIngredientes([{ alimento_id: '', cantidad_requerida: 1 }]);
    }
    setMostrarModal(true);
  };

  const agregarFilaIngrediente = () => {
    setIngredientes([...ingredientes, { alimento_id: '', cantidad_requerida: 1 }]);
  };

  const actualizarIngrediente = (index, campo, valor) => {
    const list = [...ingredientes];
    list[index][campo] = valor;
    setIngredientes(list);
  };

  const eliminarFilaIngrediente = (index) => {
    setIngredientes(ingredientes.filter((_, i) => i !== index));
  };

  const handleGuardarReceta = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || ingredientes.some((i) => !i.alimento_id)) {
      alert('Por favor selecciona todos los alimentos requeridos.');
      return;
    }

    setGuardando(true);
    try {
      if (idEditando) {
        // Actualizar receta existente
        const { error: recError } = await supabase
          .from('recetas')
          .update({
            nombre: nombre.trim(),
            tiempo_minutos: Number(tiempo),
            porciones: Number(porciones),
          })
          .eq('id', idEditando);

        if (recError) throw recError;

        // Reemplazar ingredientes
        await supabase.from('receta_ingredientes').delete().eq('receta_id', idEditando);

        const payloadIngredientes = ingredientes.map((i) => ({
          receta_id: idEditando,
          alimento_id: i.alimento_id,
          cantidad_requerida: Number(i.cantidad_requerida),
        }));

        const { error: ingError } = await supabase
          .from('receta_ingredientes')
          .insert(payloadIngredientes);

        if (ingError) throw ingError;
      } else {
        // Crear nueva receta
        const { data: recData, error: recError } = await supabase
          .from('recetas')
          .insert([{ nombre: nombre.trim(), tiempo_minutos: Number(tiempo), porciones: Number(porciones) }])
          .select()
          .single();

        if (recError) throw recError;

        const payloadIngredientes = ingredientes.map((i) => ({
          receta_id: recData.id,
          alimento_id: i.alimento_id,
          cantidad_requerida: Number(i.cantidad_requerida),
        }));

        const { error: ingError } = await supabase
          .from('receta_ingredientes')
          .insert(payloadIngredientes);

        if (ingError) throw ingError;
      }

      setMostrarModal(false);
      cargarDatos();
    } catch (err) {
      alert(`Error al guardar receta: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarReceta = async (id, nombreReceta) => {
    if (!confirm(`¿Eliminar la receta "${nombreReceta}"?`)) return;

    setRecetas((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from('recetas').delete().eq('id', id);

    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      cargarDatos();
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-stone-900">Catálogo de Recetas</h1>
        <button
          onClick={abrirModalCrear}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 text-xs font-semibold"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nueva Receta</span>
        </button>
      </div>

      {/* Listado de Recetas */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <p className="text-xs">Cargando recetas...</p>
        </div>
      ) : recetas.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-6">
          <ChefHat className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-700">No hay recetas registradas</p>
          <p className="text-xs text-stone-400 mt-1">Crea tus platos favoritos para usarlos en el menú semanal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recetas.map((receta) => (
            <div
              key={receta.id}
              className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-stone-900">{receta.nombre}</h3>
                  <div className="flex items-center gap-3 text-xs text-stone-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {receta.tiempo_minutos || 30} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {receta.porciones || 2} porciones
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirModalEditar(receta)}
                    className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    title="Editar receta"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => eliminarReceta(receta.id, receta.nombre)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Eliminar receta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ingredientes de la receta */}
              <div className="bg-stone-50 rounded-xl p-2.5 space-y-1 text-xs">
                <p className="font-semibold text-stone-600 mb-1">Ingredientes requeridos:</p>
                {(receta.receta_ingredientes || []).length === 0 ? (
                  <p className="text-stone-400 italic">No se especificaron ingredientes.</p>
                ) : (
                  receta.receta_ingredientes.map((ri) => (
                    <div key={ri.id} className="flex justify-between items-center text-stone-700">
                      <span>{ri.alimentos?.nombre || 'Alimento no encontrado'}</span>
                      <span className="font-mono text-stone-500">
                        {ri.cantidad_requerida} {ri.alimentos?.unidad_medida}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Receta */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900">
                {idEditando ? 'Modificar Receta' : 'Nueva Receta'}
              </h2>
              <button
                onClick={() => setMostrarModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarReceta} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Nombre del plato</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Fideos con salsa, Lentejas..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Tiempo (min)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={tiempo}
                    onChange={(e) => setTiempo(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Porciones</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={porciones}
                    onChange={(e) => setPorciones(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-stone-600">Ingredientes requeridos</label>
                  <button
                    type="button"
                    onClick={agregarFilaIngrediente}
                    className="text-xs text-emerald-600 font-semibold hover:underline"
                  >
                    + Añadir otro
                  </button>
                </div>

                <div className="space-y-2">
                  {ingredientes.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        required
                        value={ing.alimento_id}
                        onChange={(e) => actualizarIngrediente(idx, 'alimento_id', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Selecciona alimento</option>
                        {alimentos.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre} ({a.unidad_medida})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        required
                        placeholder="Cant."
                        value={ing.cantidad_requerida}
                        onChange={(e) => actualizarIngrediente(idx, 'cantidad_requerida', e.target.value)}
                        className="w-16 px-2 py-1.5 text-xs text-center bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />

                      {ingredientes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarFilaIngrediente(idx)}
                          className="p-1 text-stone-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
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
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}