# RehabWeb-WebApp

Frontend para la webapp de fisioterapia **RehabWeb**, construido con Angular 20, Angular Material, Bootstrap 5 y SCSS.

---

## 📋 Tabla de Tecnologías

| Tecnología | Versión |
|---|---|
| Angular | 20 |
| Angular Material | ^20.2.14 |
| Angular CDK | ^20.2.14 |
| Bootstrap | ^5.3.8 |
| Bootstrap Icons | ^1.13.1 |
| Material Icons | ^1.13.14 |
| jQuery | ^4.0.0 |
| TypeScript | ~5.8 |
| SCSS | (integrado con Angular CLI) |

---

## 🚀 Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd RehabWeb-WebApp
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Iniciar servidor de desarrollo

```bash
ng serve
```

La aplicación estará disponible en: `http://localhost:4200/`

### 4. Compilar para producción (opcional)

```bash
ng build
```

Los archivos generados se almacenarán en la carpeta `dist/`.

---

## 📁 Estructura del proyecto

```
src/app/
├── guards/          ← Auth guards
├── interceptors/    ← HTTP interceptors (auth token)
├── models/          ← Interfaces TypeScript
├── screens/         ← Componentes de pantalla (páginas)
├── services/        ← Servicios HTTP por rol
├── shared/          ← Componentes reutilizables
└── partials/        ← Componentes parciales (navbar, sidebar, footer)
```

### Archivos clave

| Archivo | Descripción |
|---|---|
| `app.config.ts` | Configuración de la app (providers: zoneless, HttpClient, router, SSR) |
| `app.routes.ts` | Definición de rutas de la aplicación |
| `app.html` | Template principal de la aplicación |
| `app.scss` | Estilos globales de la aplicación |

---

## 🔗 Conexión con el Backend

Este frontend se conecta a la API REST de **RehabWeb-Api** (Django REST Framework).

- Backend URL: `http://127.0.0.1:8000/`
- El backend tiene CORS configurado para aceptar peticiones desde `http://localhost:4200`.

---

## 🌿 Estrategia de Branching

Este proyecto sigue una estrategia de branching por equipos con revisión en staging.

### Diagrama de flujo

```
main ← staging ← equipo/{nombre} ← dev/{nombre-desarrollador}
```

### Ramas principales

| Rama | Propósito | ¿Quién hace merge aquí? |
|------|-----------|-------------------------|
| `main` | Producción estable. Solo código probado y aprobado. | Líder del proyecto tras aprobación en staging |
| `staging` | Rama de integración y pruebas. Aquí se valida que todos los equipos funcionen juntos. | Líderes de equipo |
| `equipo/equipo-1` | Rama principal del Equipo 1. | Los desarrolladores del Equipo 1 |
| `equipo/equipo-2` | Rama principal del Equipo 2. | Los desarrolladores del Equipo 2 |
| `equipo/equipo-3` | Rama principal del Equipo 3. | Los desarrolladores del Equipo 3 |
| `equipo/equipo-4` | Rama principal del Equipo 4. | Los desarrolladores del Equipo 4 |
| `equipo/equipo-5` | Rama principal del Equipo 5. | Los desarrolladores del Equipo 5 |
| `equipo/equipo-6` | Rama principal del Equipo 6. | Los desarrolladores del Equipo 6 |
| `dev/{nombre}` | Rama personal de cada desarrollador (ej: `dev/juan-lopez`). | El desarrollador individual |

### Flujo de trabajo

1. **Cada desarrollador** trabaja en su rama personal `dev/{nombre}`.
2. Al terminar su sprint o tarea asignada, el desarrollador crea un **Pull Request** hacia la rama de su equipo `equipo/{nombre}`.
3. El **líder de equipo** revisa el PR y hace merge a `equipo/{nombre}`.
4. Cuando el equipo completa su sprint, el líder crea un **Pull Request** de `equipo/{nombre}` → `staging`.
5. En `staging` se ejecutan **pruebas de integración** para verificar que todo funcione en conjunto.
6. Si las pruebas pasan, se crea un **Pull Request** de `staging` → `main`.

### Convención de commits

Usar el formato **Conventional Commits**:

```
<tipo>(<alcance>): <descripción corta>

[cuerpo opcional]
```

#### Tipos permitidos

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Cambios en documentación |
| `style` | Formato, punto y coma faltantes, etc. (no cambia lógica) |
| `refactor` | Refactorización de código (no agrega ni corrige) |
| `test` | Agregar o corregir tests |
| `chore` | Tareas de mantenimiento (dependencias, configs) |

#### Ejemplos

```
feat(auth): agregar endpoint de login con JWT
fix(formulario): corregir validación de email en registro
docs(readme): actualizar instrucciones de instalación
refactor(servicios): extraer lógica de HTTP a servicio base
chore(deps): actualizar Angular a v20.3
```

### Reglas importantes

> ⚠️ **NUNCA** hacer push directo a `main` o `staging`.
>
> ⚠️ **SIEMPRE** crear Pull Requests para cualquier merge entre ramas.
>
> ⚠️ Antes de crear un PR, hacer `git pull` de la rama destino para evitar conflictos.
