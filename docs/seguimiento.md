# Seguimiento — App Despensa Familiar

**Última actualización:** 2026-10-18  
**Propósito:** registro interno y liviano de decisiones, hallazgos y próximos trabajos. Este documento no describe funcionalidades ya verificadas salvo indicación expresa.

## PM0 — Visión y alcance

**Estado:** definición funcional acordada; README redactado. Quedan detalles por diseñar.

### Visión

Herramienta personal para que la familia proponga y vote recetas, planifique comidas y sepa qué ingredientes tiene y cuáles necesita comprar. No se prioriza la comercialización ni añadir complejidad por motivos de portafolio.

### Decisiones acordadas

| ID | Decisión |
|---|---|
| DF-01 | El menú semanal es el centro de la experiencia; la despensa ayuda a planificar. |
| DF-02 | Se contemplan desayuno, almuerzo y once; ninguno es obligatorio, aunque el almuerzo es el foco habitual. |
| DF-03 | Todos los familiares pueden proponer comidas y votar. |
| DF-04 | Un administrador confirma la opción elegida; los votos no asignan el menú automáticamente. |
| DF-05 | La falta de ingredientes se advierte; no debe bloquear una propuesta o elección. |
| DF-06 | Se mostrarán faltantes por receta y un resumen semanal a partir de las comidas confirmadas y del inventario disponible. |
| DF-07 | Se privilegian unidades domésticas prácticas; cantidades y equivalencias imprecisas requieren diseño. |
| DF-08 | El proyecto se mantiene personal y familiar, con prioridad en simplicidad y herramientas de bajo costo. |
| DF-09 | Mantener React, Vite y Supabase mientras resulten suficientes; evaluar las limitaciones del plan gratuito antes de migrar. |
| DF-10 | IA, nutrición y comercialización son ideas futuras, fuera del alcance inicial. |

### Propuestas aún no cerradas

- Dos o tres administradores podrían gestionar alimentos; definir los permisos exactos para editar recetas, confirmar comidas y marcar platos preparados.
- Tratar porciones como dato opcional; no decidir aún cómo calcular equivalencias o escalado.
- Mantener menú, recetas y despensa como vistas principales, priorizando el menú.
- Definir cómo se modifica una comida ya confirmada y cómo evitar duplicaciones.

## Estado observado del repositorio (revisión estática)

- React, Vite, JavaScript, Tailwind y Supabase.
- Código para autenticación por correo y PIN, alimentos, recetas, menú semanal, votaciones, descuento al cocinar y suscripciones Realtime.
- La interfaz actual distingue desayuno, almuerzo y **cena**, no once.
- El código actual no demuestra confirmación administrativa ni resumen consolidado semanal.
- No se ejecutaron pruebas locales ni se validaron los flujos completos en esta revisión.

## PM1 — Auditoría de Supabase (siguiente etapa)

**Estado:** pendiente, sin cambios de configuración.

- Inspeccionar Auth: usuarios permitidos, registro, PIN/contraseña, límites y sesiones.
- Revisar RLS, políticas, privilegios de las tablas y pertenencia al grupo familiar.
- Investigar pausas por inactividad y límites del plan gratuito; evaluar alternativas solo si existe un problema concreto.
- Documentar hallazgos y acordar correcciones antes de ejecutarlas.

## PM2 — Consistencia y uso familiar (posterior)

**Estado:** pendiente.

- Revisar descuento atómico de ingredientes y evitar cocinar dos veces la misma preparación.
- Revisar concurrencia en cambios de stock y reemplazo de ingredientes de recetas.
- Ajustar el flujo de propuestas, votaciones y confirmación manual.
- Diferenciar ingredientes faltantes de disponibilidad desconocida y preparar resumen semanal.
- Validar el flujo con familiares y priorizar mejoras a partir del uso real.

## Ideas por evaluar

- Exportación de recetas a Markdown, sin datos personales o de inventario; decidir alcance, formato y si será exportación manual o mediante la app.
- Lista de compras compartida.
- Recomendaciones asistidas por IA o información nutricional, solo si resultan útiles.
- Posible versión reutilizable/comercial en un futuro; distinguir recetas familiares de material autorizado para publicar.

## Registro de cambios

| Fecha | Cambio | Estado |
|---|---|---|
| 2026-10-18 | Se definió la visión familiar y la planificación colaborativa (PM0). | Registrado |
| 2026-10-18 | Se acordó confirmación administrativa y faltantes por receta + resumen semanal. | Registrado |
| 2026-10-18 | Se preparó un README breve y se creó este seguimiento. | Documentación |

**Regla de trabajo:** revisar y aprobar cambios relevantes antes de implementarlos; no introducir tecnologías o funcionalidades sin una necesidad concreta. Una autorización puntual para actualizar `main` no implica autorización general para hacerlo en el futuro.
