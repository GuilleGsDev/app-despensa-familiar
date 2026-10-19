# 🍽️ App Despensa Familiar

Aplicación web personal creada para facilitar la **organización de las comidas, las recetas y los alimentos disponibles en el hogar**.

Nace de una necesidad cotidiana: decidir en familia qué comer durante la semana, conocer qué ingredientes tenemos y anticipar lo que necesitamos comprar.

El objetivo es contar con una herramienta sencilla, colaborativa y útil para la vida diaria.

## 🏠 ¿Cómo funciona?

La aplicación reúne tres áreas principales:

- **Menú semanal:** permite proponer recetas, votar por las preferencias familiares y organizar las comidas. La visión del proyecto contempla desayuno, almuerzo y once, sin obligación de completar todos los espacios.
- **Recetario:** catálogo compartido de preparaciones e ingredientes para utilizar en la planificación.
- **Despensa:** registro de alimentos y cantidades disponibles para consultar existencias y detectar productos faltantes.

La idea es que todos participen en las decisiones y que los administradores confirmen el menú y mantengan actualizado el inventario. Este modelo de permisos está pendiente de implementación y validación.

## ✨ Funcionalidades

El repositorio incluye código para:

- Inicio de sesión de usuarios.
- Registro y actualización de alimentos.
- Creación y administración de recetas.
- Planificación semanal de comidas.
- Propuestas y votaciones familiares.
- Consulta de ingredientes disponibles.
- Descuento de ingredientes al cocinar.
- Sincronización mediante Supabase Realtime.

Estas funcionalidades están en revisión; su funcionamiento y seguridad todavía no se han validado completamente. Actualmente el menú utiliza la categoría «cena», que se planea adaptar a «once».

## 🛠️ Tecnologías

- **React + Vite:** interfaz web.
- **JavaScript:** lógica de la aplicación.
- **Tailwind CSS:** estilos adaptables.
- **Supabase + PostgreSQL:** autenticación, datos y sincronización.

## 🌱 Posibles mejoras

Según las necesidades reales de la familia, se consideran:

- Simplificar usuarios y permisos, incluyendo la confirmación del menú por administradores.
- Adaptar las unidades de los alimentos a su uso cotidiano.
- Mostrar faltantes por receta **sin impedir** elegir una preparación.
- Consolidar los ingredientes faltantes de las comidas confirmadas en un resumen semanal para facilitar las compras.
- Explorar recomendaciones de recetas e inteligencia artificial si aportan valor.

Estas ideas no representan funcionalidades terminadas ni compromisos de implementación.

## 📚 Aprendizajes

Además de su uso familiar, el proyecto permite experimentar con React, Supabase, bases de datos y sincronización, y aprender a construir soluciones proporcionadas a problemas cotidianos.

## 👨‍💻 Autor

Desarrollado por [Guillermo González](https://github.com/GuilleGsDev) como proyecto personal.

**App Despensa Familiar — Planificar en familia, aprovechar lo que tenemos.**
