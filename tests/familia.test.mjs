import test from 'node:test';
import assert from 'node:assert/strict';
import { esFamiliar, esAdministrador, puedeEditarReceta, disponibilidadIngrediente } from '../src/lib/familia.js';

const natalia = { id: 'natalia', activo: true, rol: 'miembro' };
const tita = { id: 'tita', activo: true, rol: 'admin' };
const guillermo = { id: 'guillermo', activo: true, rol: 'admin' };

test('solo perfiles familiares activos reciben permisos', () => {
  for (const perfil of [null, {}, { ...natalia, activo: false }, { ...tita, rol: 'externo' }]) {
    assert.equal(esFamiliar(perfil), false);
    assert.equal(esAdministrador(perfil), false);
    assert.equal(puedeEditarReceta(perfil, { creado_por: 'natalia' }), false);
  }
});
test('los administradores editan todas; Natalia solo sus recetas', () => {
  assert.equal(esAdministrador(natalia), false);
  for (const perfil of [tita, guillermo]) {
    assert.equal(esAdministrador(perfil), true);
    assert.equal(puedeEditarReceta(perfil, { creado_por: 'natalia' }), true);
    assert.equal(puedeEditarReceta(perfil, { creado_por: null }), true);
  }
  assert.equal(puedeEditarReceta(natalia, { creado_por: 'natalia' }), true);
  assert.equal(puedeEditarReceta(natalia, { creado_por: 'tita' }), false);
  assert.equal(puedeEditarReceta(natalia, { creado_por: null }), false);
});
test('paquetes y tazas no se comparan ni modifican', () => {
  const alimento = Object.freeze({ cantidad_actual: 3, unidad_medida: 'paq' });
  const ingrediente = Object.freeze({ cantidad_requerida: 2, unidad_medida: 'taza' });
  assert.equal(disponibilidadIngrediente(ingrediente, alimento), 'Por verificar');
  assert.equal(alimento.cantidad_actual, 3);
});
test('cantidades compatibles permiten una orientación, incluido cero', () => {
  const ingrediente = { cantidad_requerida: 0.5, unidad_medida: 'un' };
  assert.equal(disponibilidadIngrediente(ingrediente, { cantidad_actual: 1, unidad_medida: 'un' }), 'Disponible aprox.');
  assert.equal(disponibilidadIngrediente(ingrediente, { cantidad_actual: 0, unidad_medida: 'un' }), 'Falta aprox.');
});
test('datos desconocidos, cantidades inválidas y unidades sin equivalencia requieren revisión', () => {
  const ingrediente = { cantidad_requerida: 2, unidad_medida: 'taza' };
  for (const alimento of [null, { unidad_medida: 'taza', cantidad_actual: null },
    { unidad_medida: 'taza', cantidad_actual: 'desconocida' },
    { unidad_medida: 'taza', cantidad_actual: -1 }, { unidad_medida: 'kg', cantidad_actual: 3 }]) {
    assert.equal(disponibilidadIngrediente(ingrediente, alimento), 'Por verificar');
  }
  assert.equal(disponibilidadIngrediente({ cantidad_requerida: 1 }, { cantidad_actual: 5 }), 'Por verificar');
});
