export const UNIDADES_RECETA = ['taza', 'un', 'paq', 'g', 'kg', 'ml', 'L'];

export function esFamiliar(perfil) {
  return Boolean(perfil?.id && perfil.activo === true && ['admin', 'miembro'].includes(perfil.rol));
}

export function esAdministrador(perfil) {
  return esFamiliar(perfil) && perfil.rol === 'admin';
}

export function puedeEditarReceta(perfil, receta) {
  return esFamiliar(perfil) && (esAdministrador(perfil) || receta.creado_por === perfil.id);
}

// No suponemos equivalencias entre paquetes, tazas o unidades.
export function disponibilidadIngrediente(ingrediente, alimento) {
  if (!alimento || !ingrediente.unidad_medida ||
      ingrediente.unidad_medida !== alimento.unidad_medida ||
      alimento.cantidad_actual == null || ingrediente.cantidad_requerida == null) {
    return 'Por verificar';
  }
  const disponible = Number(alimento.cantidad_actual);
  const requerido = Number(ingrediente.cantidad_requerida);
  if (!Number.isFinite(disponible) || !Number.isFinite(requerido) || disponible < 0 || requerido <= 0) {
    return 'Por verificar';
  }
  return disponible >= requerido ? 'Disponible aprox.' : 'Falta aprox.';
}
