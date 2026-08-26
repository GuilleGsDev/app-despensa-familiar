import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, ThumbsUp, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, Utensils } from 'lucide-react';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TIPOS_COMIDA = [
  { key: 'desayuno', label: 'Desayuno', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { key: 'almuerzo', label: 'Almuerzo', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { key: 'cena', label: 'Cena', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
];

export default function MenuView() {
  const [recetas, setRecetas] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Selector de día activo (0 = Lunes, 6 = Domingo)
  const [diaOffset, setDiaOffset] = useState(0);

  // Modal para asignar receta a un bloque
  const [modalAbierto, setModalAbierto] = useState(false);
  const [comidaSeleccionada, setComidaSeleccionada] = useState('almuerzo');
  const [recetaId, setRecetaId] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Calcular la fecha del día actual de la semana
  const getFechaCalculada = (offset) => {
    const hoy = new Date();
    const diaActual = hoy.getDay(); // 0 = Domingo
    const distLunes = (diaActual + 6) % 7;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - distLunes + offset);
    return lunes.toISOString().split('T')[0];
  };

  const fechaActual = getFechaCalculada(diaOffset);

  useEffect(() => {
    cargarDatos();
  }, [fechaActual]);

  const cargarDatos = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    // Cargar todas las recetas disponibles
    const { data: recData } = await supabase
      .from('recetas')
      .select('id, nombre, tiempo_minutos, porciones')
      .order('nombre');
    if (recData) setRecetas(recData);

    // Cargar las comidas del día seleccionado con recetas y votos
    const { data: menuData } = await supabase
      .from('menu_semanal')
      .select(`
        id,
        fecha,
        tipo_comida,
        recetas (
          id,
          nombre,
          tiempo_minutos
        ),
        votos_menu (
          id,
          user_id
        )
      `)
      .eq('fecha', fechaActual);

    if (menuData) setMenuItems(menuData);
    setLoading(false);
  };

  const handleAgregarAlMenu = async (e) => {
    e.preventDefault();
    if (!recetaId) return;

    setGuardando(true);
    const { error } = await supabase
      .from('menu_semanal')
      .insert([
        {
          fecha: fechaActual,
          tipo_comida: comidaSeleccionada,
          receta_id: recetaId,
        },
      ]);

    if (!error) {
      setModalAbierto(false);
      setRecetaId('');
      cargarDatos();
    } else {
      alert(`Error al agendar: ${error.message}`);
    }
    setGuardando(false);
  };

  const handleVotar = async (menuId, yaVoto) => {
    if (yaVoto) {
      await supabase
        .from('votos_menu')
        .delete()
        .match({ menu_id: menuId, user_id: userId });
    } else {
      await supabase
        .from('votos_menu')
        .insert([{ menu_id: menuId, user_id: userId }]);
    }
    cargarDatos();
  };

  const handleEliminarMenu = async (id) => {
    const { error } = await supabase.from('menu_semanal').delete().eq('id', id);
    if (!error) {
      setMenuItems((prev) => prev.filter((m) => m.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de Días de la Semana */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-stone-900">
              {DIAS_SEMANA[diaOffset]} ({fechaActual})
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDiaOffset((prev) => Math.max(0, prev - 1))}
              disabled={diaOffset === 0}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDiaOffset((prev) => Math.min(6, prev + 1))}
              disabled={diaOffset === 6}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pestañas de días de la semana */}
        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((dia, idx) => (
            <button
              key={dia}
              onClick={() => setDiaOffset(idx)}
              className={`py-1.5 text-[11px] font-semibold rounded-xl transition ${
                diaOffset === idx
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
              }`}
            >
              {dia.substring(0, 2)}
            </button>
          ))}
        </div>
      </div>

      {/* Bloques de Comida: Desayuno, Almuerzo, Cena */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <p className="text-xs">Cargando menú...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {TIPOS_COMIDA.map((tipo) => {
            const platos = menuItems.filter((m) => m.tipo_comida === tipo.key);

            return (
              <div key={tipo.key} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${tipo.color}`}>
                    {tipo.label}
                  </span>
                  <button
                    onClick={() => {
                      setComidaSeleccionada(tipo.key);
                      setModalAbierto(true);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Proponer</span>
                  </button>
                </div>

                {platos.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-1">Sin platos asignados aún.</p>
                ) : (
                  <div className="space-y-2">
                    {platos.map((item) => {
                      const votos = item.votos_menu || [];
                      const yaVoto = votos.some((v) => v.user_id === userId);

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-stone-800 truncate">
                              {item.recetas?.nombre || 'Receta'}
                            </h4>
                            <p className="text-[10px] text-stone-400">
                              {item.recetas?.tiempo_minutos} min
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Botón de Votación */}
                            <button
                              onClick={() => handleVotar(item.id, yaVoto)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                yaVoto
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{votos.length}</span>
                            </button>

                            {/* Eliminar del menú */}
                            <button
                              onClick={() => handleEliminarMenu(item.id)}
                              className="p-1 text-stone-400 hover:text-rose-500 rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Proponer Receta */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-xl border border-stone-200">
            <h2 className="text-base font-bold text-stone-900 mb-1">
              Proponer para {TIPOS_COMIDA.find((t) => t.key === comidaSeleccionada)?.label}
            </h2>
            <p className="text-xs text-stone-500 mb-4">{fechaActual}</p>

            <form onSubmit={handleAgregarAlMenu} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Selecciona una Receta</label>
                {recetas.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    Aún no tienes recetas creadas. Ve a la pestaña "Recetas" para agregar platos primero.
                  </p>
                ) : (
                  <select
                    required
                    value={recetaId}
                    onChange={(e) => setRecetaId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Elige un plato...</option>
                    {recetas.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre} ({r.tiempo_minutos} min)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="flex-1 py-2.5 text-stone-600 bg-stone-100 hover:bg-stone-200 font-medium text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !recetaId}
                  className="flex-1 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 font-medium text-xs rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Asignar al Menú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}