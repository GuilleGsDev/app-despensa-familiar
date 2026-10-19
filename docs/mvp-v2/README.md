# MVP v2.0 — preparación para revisión

Estado: archivos preparados; NO se ejecutó SQL, no se consultó la base remota y no se verificó un respaldo. No desplegar aún la nueva interfaz sobre el esquema anterior.

## Alcance

- Se conservan Auth, los tres UUID, las credenciales y todas las tablas actuales.
- Tita y Guillermo: admin. Natalia: miembro. La asignación requiere UUID verificados; no se buscan usuarios por nombre ni se inventan IDs.
- Familiares activos crean recetas y editan/archivan las propias; administradores también editan las ajenas y las antiguas sin autor.
- Todos proponen y votan. Se permite votar distintas propuestas, una vez por propuesta.
- Una confirmación por fecha/comida (desayuno, almuerzo, once). Administradores pueden sustituir o retirar la selección. En confirmaciones simultáneas prevalece la última escritura; la clave primaria impide dos filas.
- Inventario manual y orientativo, con paquetes por defecto para nuevos alimentos. No se convierten cantidades antiguas ni se descuenta al confirmar.
- Los ingredientes tienen su propia unidad. Solo unidades idénticas se comparan: paquete frente a taza muestra «Por verificar». No se incorpora un motor de equivalencias.
- Se preservan todas las recetas y productos. No hay seed destructivo, TRUNCATE ni eliminación de cuentas. Archivar conserva las propuestas existentes.

## Archivos SQL y condiciones pendientes

`00_inspeccion.sql` prepara la revisión de tipos, relaciones, políticas, privilegios por columna, triggers, funciones e índices. No se ha ejecutado.

`01_migracion_borrador.sql` es una transacción de revisión, no una migración aplicada. No se añadió a `supabase/migrations`: falta el esquema real y no hay CLI Supabase instalado disponible. Después de validar el borrador, generar el archivo de migración con `supabase migration new` y trasladar el SQL revisado; no instalar dependencias de la app para este paso.

Antes de aplicar, comprobar:

1. Exportar y restaurar el respaldo en un entorno de prueba; registrar referencia, fecha, resultado y conteos. Respaldar definiciones de políticas, grants, triggers y funciones, además de datos. Comprobar por separado cómo el respaldo preserva Auth y permitir iniciar sesión con las tres cuentas.
2. Verificar los UUID de Tita, Guillermo y Natalia en Auth y sus perfiles. Este borrador exige perfiles ya existentes. No cambia correos ni credenciales.
3. Comparar la inspección con el borrador. Se asume `perfiles.id` UUID enlazado a Auth, claves `id` con valor por defecto en recetas/ingredientes/votos/alimentos/menú, `menu_semanal.fecha` date, `tipo_comida` text o varchar y los campos usados por React. Si hay enums, columnas nuevas ya existentes o nombres/tipos distintos, adaptar antes de ejecutar.
4. Verificar FKs de ingredientes a recetas/alimentos, propuestas a recetas y votos a perfiles/Auth; deben existir y no permitir huérfanos. El borrador añade explícitamente la FK de votos a propuestas y la de confirmaciones a propuestas, pero no inventa las otras relaciones del esquema original.
5. Revisar TODOS los triggers y RPC actuales: ninguna ruta debe descontar stock al confirmar ni permitir saltarse la nueva autorización. No se eliminan funciones/triggers desconocidos automáticamente. Si existen, adaptar el borrador y sus pruebas primero.
6. Revisar y aprobar el reemplazo de políticas/grants de las siete tablas. Se revocan permisos amplios y por columna para PUBLIC/anon/authenticated; no se tocan otras tablas. Verificar que `despensa_private` no se exponga por la Data API. Los helpers son SECURITY INVOKER y consultan exclusivamente el perfil propio; no hay recursión ni SECURITY DEFINER.
7. Revisar votos duplicados, referencias huérfanas y restricciones previas. El borrador aborta ante votos duplicados y tipos de comida desconocidos; no limpia datos silenciosamente. Las propuestas duplicadas existentes se conservan; no se añade una unicidad nueva que bloquee o borre historial.
8. Revisar unidades antiguas. Se copia la unidad del alimento a sus ingredientes, conservando el significado de v1. Las restricciones nuevas de cantidad/unidad usan NOT VALID para no borrar registros históricos inválidos: inventariarlos y corregirlos expresamente, luego validar las restricciones. La RPC exige valores válidos para recetas nuevas/editadas.

Tras esas comprobaciones, un operador autorizado deberá establecer en LA MISMA sesión de la migración estas variables (valores deliberadamente no incluidos):

- `app.mvp_v2_respaldo`: referencia del respaldo cuya restauración se comprobó.
- `app.mvp_v2_revision`: `verificada`.
- `app.mvp_v2_tita`: UUID real.
- `app.mvp_v2_guillermo`: UUID real.
- `app.mvp_v2_natalia`: UUID real.

Se pueden establecer con `set_config(..., false)` en una sesión administrativa. El guard comprueba su presencia y que las tres cuentas/perfiles existan; NO certifica por sí mismo la integridad del respaldo ni la identidad humana. No cambiar las variables para saltarse la revisión.

## Cambio de datos y seguridad

- Añade `perfiles.activo` con default false; activa únicamente los tres UUID verificados. Otros perfiles se conservan sin acceso familiar.
- Añade autor a recetas/propuestas. Los registros anteriores permanecen sin autor y son administrables por los administradores. No atribuye contenido antiguo arbitrariamente.
- Añade `recetas.archivada` y `receta_ingredientes.unidad_medida`.
- Convierte `cena` a `once` sin eliminar propuestas. Solo sustituye CHECK simples de `tipo_comida`; restricciones compuestas requieren revisión.
- Añade `comidas_confirmadas`, clave `(fecha,tipo_comida)` y FK compuesta que impide confirmar una propuesta de otra fecha/comida. Su FK RESTRICT protege una propuesta confirmada.
- Los triggers fijan el autor de altas y la identidad/fecha de confirmación, e impiden cambiar autor. Los roles no son editables desde el cliente.
- La RPC `guardar_receta_v2` guarda receta e ingredientes en una transacción y respeta RLS. Reemplaza ingredientes solo durante una edición solicitada; un error revierte todo. No elimina recetas ni productos.
- Retirar una propuesta no confirmada elimina sus votos por FK CASCADE; esto solo ocurre en futuras acciones explícitas, no durante la migración.
- La migración publica las tablas necesarias para Realtime, sin duplicarlas. Las consultas de lectura siguen sujetas a RLS.

## React

- `App`: admite únicamente un perfil activo que coincida con la sesión; transmite identidad y rol. `LoginPin` conserva su flujo.
- `MenuView`: once, autor de propuestas, votos propios, confirmación administrativa y disponibilidad por ingrediente. No escribe inventario.
- `RecetasView`: unidades familiares, permisos por autor, guardado atómico por RPC y archivado.
- `DespensaView`: lectura compartida, edición manual de administradores; detecta ajustes concurrentes comparando la cantidad leída.
- `familia.js`: reglas de UI y disponibilidad. RLS sigue siendo la autoridad.
- `useRealtimeQuery`: un canal por vista, limpieza al desmontar y descarte de respuestas anteriores cuando cambia la fecha o se inicia otra recarga. Errores visibles y reintento.

## Verificación

Pruebas locales: `node --test tests/familia.test.mjs`, `npm run lint`, `npm run build`, `git diff --check`.

Pruebas obligatorias en el entorno restaurado antes de producción:

| Caso | Resultado esperado |
|---|---|
| Login de las tres cuentas | Mismos UUID y credenciales; roles previstos |
| Visitante/cuenta sin perfil activo | Sin acceso al catálogo, menú o inventario |
| Natalia crea y edita receta propia | Éxito |
| Natalia edita receta ajena o sin autor, por API directa | Denegado |
| Natalia cambia rol/activo/autor por API | Denegado |
| Tita/Guillermo editan receta antigua sin autor | Éxito |
| Ingrediente inválido en RPC al editar | Reversión de toda la edición, ingredientes anteriores intactos |
| Voto propio, repetido, ajeno | Primero válido, duplicado rechazado, suplantación rechazada |
| Confirmación por Natalia, por API | Denegada |
| Confirmación por admin, sustitución y retirada | Éxito; inventario idéntico antes/después |
| Propuesta de otra fecha en confirmación | Rechazo por FK compuesta |
| Borrar propuesta confirmada | Rechazado; primero retirar confirmación |
| Confirmaciones simultáneas | Una sola selección; última escritura válida |
| Archivar receta propuesta | Propuesta e historial conservados; no disponible para propuestas nuevas |
| Cantidad en paquetes vs tazas | «Por verificar», sin bloquear propuesta/confirmación |
| Dos sesiones; navegar rápidamente entre días | Realtime sin canales acumulados ni datos de otra fecha |
| Cambio manual concurrente del inventario | No sobrescribir silenciosamente el cambio previo |

Probar permisos con JWT reales de los roles o sesiones `authenticated` simuladas en pruebas, nunca solo con service_role (omite RLS). Incluir INSERT/UPDATE/DELETE directos y las RPC existentes.

## Despliegue y reversión

No desplegar este frontend hasta aprobar y probar el esquema. Coordinar la migración y la nueva versión; cerrar/recargar las pestañas antiguas para evitar que el código v1 siga intentando descontar inventario. Verificar que no haya triggers de descuento en la base.

Antes del commit de implementación, comprobar respaldo, SQL en pruebas, RLS y flujo en navegador. La reversión previa al COMMIT es transaccional. Después de aplicar, usar una corrección hacia delante o restauración probada; no ejecutar un downgrade destructivo que elimine confirmaciones o cuentas. Conservar la versión previa del frontend y coordinar cualquier reversión con el esquema.

## Resultado local de esta preparación (2026-10-19)

- ESLint: 0 errores y 0 advertencias.
- Build de Vite: correcto.
- Pruebas de permisos de UI y disponibilidad: 5/5.
- `git diff --check`: correcto.
- SQL, RLS remota, respaldo e integración en navegador: pendientes; ninguna consulta SQL fue ejecutada.

Referencias usadas para diseñar el borrador: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [permisos por columna](https://supabase.com/docs/guides/database/postgres/column-level-security) y [funciones de base de datos](https://supabase.com/docs/guides/database/functions).
