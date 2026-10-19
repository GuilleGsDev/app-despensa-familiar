import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, ThumbsUp, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import { esAdministrador, disponibilidadIngrediente } from '../lib/familia';
import { useRealtimeQuery } from '../lib/useRealtimeQuery';

const TABLAS_MENU = ['menu_semanal', 'votos_menu', 'alimentos', 'recetas', 'receta_ingredientes', 'comidas_confirmadas'];
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TIPOS_COMIDA = [
  { key: 'desayuno', label: 'Desayuno', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { key: 'almuerzo', label: 'Almuerzo', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { key: 'once', label: 'Once', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
];

export default function MenuView({ perfil }) {
  const userId = perfil.id;
  const admin = esAdministrador(perfil);
  const [ocupado, setOcupado] = useState(false);

  // Offset de semanas respecto a la semana actual (0 = semana actual, 1 = próxima semana, -1 = semana anterior)
  const [semanaOffset, setSemanaOffset] = useState(0);

  // Índice del día seleccionado en la semana activa (0 = Lunes, ..., 6 = Domingo)
  // Inicializamos en el día de la semana actual
  const [diaSeleccionadoIdx, setDiaSeleccionadoIdx] = useState(() => {
    const diaHoy = new Date().getDay(); // 0 = Domingo, 1 = Lunes...
    return (diaHoy + 6) % 7; // Convertir a 0 = Lunes, 6 = Domingo
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [comidaSeleccionada, setComidaSeleccionada] = useState('almuerzo');
  const [recetaId, setRecetaId] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Formato YYYY-MM-DD local seguro
  const formatearFechaISO = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Obtener el objeto Date del Lunes de la semana activa
  const getLunesDeSemana = (offsetSemanas) => {
    const d = new Date();
    const dia = d.getDay();
    const distLunes = (dia + 6) % 7;
    d.setDate(d.getDate() - distLunes + (offsetSemanas * 7));
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Generar lista de los 7 días de la semana activa
  const getDiasSemanaActiva = () => {
    const lunes = getLunesDeSemana(semanaOffset);
    return DIAS_SEMANA.map((nombre, i) => {
      const fechaDia = new Date(lunes);
      fechaDia.setDate(lunes.getDate() + i);
      const iso = formatearFechaISO(fechaDia);
      const hoyISO = formatearFechaISO(new Date());

      return {
        indice: i,
        nombre,
        numeroDia: fechaDia.getDate(),
        iso,
        esHoy: iso === hoyISO,
      };
    });
  };

  const diasSemana = getDiasSemanaActiva();
  const diaActivo = diasSemana[diaSeleccionadoIdx] || diasSemana[0];
  const fechaActual = String(diaActivo.iso);

  const consultarMenu = useCallback(async () => {
    const results = await Promise.all([
      supabase.from('alimentos').select('*'),
      supabase.from('recetas').select('id, nombre, tiempo_minutos').eq('archivada', false).order('nombre'),
      supabase.from('menu_semanal').select(`
        id, fecha, tipo_comida, receta_id, creado_por,
        recetas (id, nombre, tiempo_minutos,
          receta_ingredientes (id, alimento_id, cantidad_requerida, unidad_medida)),
        votos_menu (id, user_id)
      `).eq('fecha', fechaActual),
      supabase.from('comidas_confirmadas').select('*').eq('fecha', fechaActual),
    ]);
    for (const result of results) if (result.error) throw result.error;
    return { alimentos: results[0].data, recetas: results[1].data,
      menuItems: results[2].data, confirmaciones: results[3].data };
  }, [fechaActual]);
  const { data, error, loading, refresh: cargarDatos } = useRealtimeQuery(
    consultarMenu, TABLAS_MENU, 'menu_realtime_sync'
  );
  const { alimentos = [], recetas = [], menuItems = [], confirmaciones = [] } = data || {};

  const handleIrAHoy = () => {
    setSemanaOffset(0);
    const diaHoy = new Date().getDay();
    setDiaSeleccionadoIdx((diaHoy + 6) % 7);
  };

  const handleAgregarAlMenu = async (e) => {
    e.preventDefault();
    if (!recetaId) return;

    setGuardando(true);
    try {
      const { error } = await supabase.from('menu_semanal').insert({
        fecha: fechaActual, tipo_comida: comidaSeleccionada, receta_id: recetaId, creado_por: userId,
      });
      if (error) throw error;
      setModalAbierto(false);
      setRecetaId('');
      await cargarDatos();
    } catch (error) {
      alert(`Error al proponer: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarCambio = async (operation) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const { error } = await operation();
      if (error) throw error;
      await cargarDatos();
    } catch (error) {
      alert(error.message);
    } finally {
      setOcupado(false);
    }
  };

  const handleVotar = (menuId, yaVoto) => ejecutarCambio(() => yaVoto
    ? supabase.from('votos_menu').delete().match({ menu_id: menuId, user_id: userId })
    : supabase.from('votos_menu').insert({ menu_id: menuId, user_id: userId }));

  const handleConfirmar = (item, confirmada) => {
    if (!admin) return;
    if (!confirm(confirmada ? '¿Retirar la confirmación?' : `¿Confirmar "${item.recetas?.nombre}" para esta comida?`)) return;
    return ejecutarCambio(() => confirmada
      ? supabase.from('comidas_confirmadas').delete().match({ fecha: item.fecha, tipo_comida: item.tipo_comida, propuesta_id: item.id })
      : supabase.from('comidas_confirmadas').upsert({ fecha: item.fecha, tipo_comida: item.tipo_comida,
        propuesta_id: item.id }, { onConflict: 'fecha,tipo_comida' }));
  };

  const handleEliminarMenu = (item) => {
    if ((!admin && item.creado_por !== userId) || confirmaciones.some((c) => c.propuesta_id === item.id)) return;
    if (!confirm('¿Retirar esta propuesta y sus votos?')) return;
    return ejecutarCambio(() => supabase.from('menu_semanal').delete().eq('id', item.id));
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-rose-700">No se pudo cargar el menú: {error} <button onClick={cargarDatos}>Reintentar</button></p>}
      {/* Navegador de Calendario Semanal */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-stone-900 capitalize">
                {diaActivo.nombre} {diaActivo.numeroDia}
              </h2>
              <p className="text-[10px] text-stone-400 font-mono">{fechaActual}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Botón rápido para volver al día de hoy */}
            {semanaOffset !== 0 && (
              <button
                onClick={handleIrAHoy}
                className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition flex items-center gap-1"
                title="Volver a la fecha actual"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Hoy</span>
              </button>
            )}

            {/* Navegación entre semanas */}
            <button
              onClick={() => setSemanaOffset((prev) => prev - 1)}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSemanaOffset((prev) => prev + 1)}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition"
              title="Siguiente semana"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pestañas de los 7 días de la semana activa */}
        <div className="grid grid-cols-7 gap-1">
          {diasSemana.map((dia) => {
            const activo = diaSeleccionadoIdx === dia.indice;

            return (
              <button
                key={dia.iso}
                onClick={() => setDiaSeleccionadoIdx(dia.indice)}
                className={`py-2 flex flex-col items-center justify-center rounded-xl transition cursor-pointer ${
                  activo
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : dia.esHoy
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 font-medium'
                }`}
              >
                <span className="text-[10px] uppercase">{dia.nombre.substring(0, 2)}</span>
                <span className="text-xs">{dia.numeroDia}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bloques de Comida: Desayuno, Almuerzo y Once */}
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
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Proponer</span>
                  </button>
                </div>

                {platos.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-1">Sin platos propuestos aún.</p>
                ) : (
                  <div className="space-y-2">
                    {platos.map((item) => {
                      const votos = item.votos_menu || [];
                      const yaVoto = votos.some((v) => v.user_id === userId);

                      const ingredientesReceta = item.recetas?.receta_ingredientes || [];
                      const confirmada = confirmaciones.some((c) => c.propuesta_id === item.id);
                      const puedeRetirar = !confirmada && (admin || item.creado_por === userId);

                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-stone-900 truncate">
                                {item.recetas?.nombre || 'Receta'} {confirmada && <span className="text-emerald-700">· Confirmada</span>}
                              </h4>
                              <p className="text-[10px] text-stone-400">
                                {item.recetas?.tiempo_minutos} min
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Votar */}
                              <button
                                disabled={ocupado}
                                onClick={() => handleVotar(item.id, yaVoto)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  yaVoto
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                                }`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                                <span>{votos.length}</span>
                              </button>

                              {/* Eliminar propuesta */}
                              {puedeRetirar && <button
                                disabled={ocupado}
                                onClick={() => handleEliminarMenu(item)}
                                className="p-1 text-stone-400 hover:text-rose-500 rounded-lg transition cursor-pointer"
                                title="Quitar del menú"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-stone-200 space-y-2">
                            {ingredientesReceta.length === 0 && <p className="text-xs text-amber-700">Por verificar: sin ingredientes registrados.</p>}
                            {ingredientesReceta.map((ing) => {
                              const alimento = alimentos.find((a) => a.id === ing.alimento_id);
                              return <p key={ing.id} className="text-xs text-stone-600">
                                {alimento?.nombre || 'Ingrediente'}: {ing.cantidad_requerida} {ing.unidad_medida || '—'} · {disponibilidadIngrediente(ing, alimento)}
                              </p>;
                            })}
                            {admin && <button disabled={ocupado} onClick={() => handleConfirmar(item, confirmada)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs disabled:opacity-50">
                              {confirmada ? 'Retirar confirmación' : 'Confirmar comida'}
                            </button>}
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
                  className="flex-1 py-2.5 text-stone-600 bg-stone-100 hover:bg-stone-200 font-medium text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !recetaId}
                  className="flex-1 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 font-medium text-xs rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Proponer al Menú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}