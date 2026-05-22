# RehabWeb BACK + FRONT

Monorepo para ejecutar RehabWeb con Docker:

- `RehabWeb-Api`: backend Django REST Framework.
- `RehabWeb-WebApp`: frontend Angular.
- `docker-compose.yml`: orquesta MySQL, backend y frontend.

## Requisitos

- Docker Desktop.
- Git.

## Levantar el proyecto

1. Copia el archivo de variables si todavia no existe:

   ```bash
   cp .env.example .env
   ```

   En este equipo ya se dejo un `.env` local listo para desarrollo.

2. Construye y levanta los contenedores:

   ```bash
   docker compose up --build
   ```

3. Abre la app:

   - Frontend: http://localhost:4201
   - Backend: http://localhost:8000
   - Admin Django: http://localhost:8000/admin

## Crear superusuario

Con los contenedores levantados:

```bash
docker compose exec backend python manage.py createsuperuser
```

## Base de datos

Docker crea una base MySQL con los valores definidos en `.env`.

El puerto interno usado por Django es `3306`, pero en tu maquina se publica como `3308` para evitar choque con XAMPP u otro MySQL local.

Datos de desarrollo por defecto:

```text
Database: rehab_db
User: rehab_user
Password: rehab_password
Host desde contenedores: db:3306
Host desde tu maquina: localhost:3308
```

## Desarrollo sin Docker

Backend:

```bash
cd RehabWeb-Api
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Frontend:

```bash
cd RehabWeb-WebApp
npm install
npm start
```

El frontend usa `/api` y `/media` con `proxy.conf.json` hacia `http://localhost:8000`.

## Publicar como repositorio nuevo

```bash
git add .
git commit -m "chore: dockerizar backend y frontend"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin develop
```

No subas `.env`; comparte `.env.example`.
