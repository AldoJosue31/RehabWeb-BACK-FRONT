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

   - Frontend en esta maquina: https://localhost:4200
   - Frontend desde otra maquina en la misma red: `https://IP_DE_ESTA_PC:4200`
   - Backend: http://localhost:8000
   - Admin Django: http://localhost:8000/admin

   Nota: no uses la IP interna del contenedor, por ejemplo `172.18.0.4`, desde el navegador del host. Esa IP pertenece a la red bridge de Docker y puede cambiar; Docker publica el frontend hacia tu maquina por el puerto `4200`. Para camara y microfono desde movil usa HTTPS y acepta el certificado local del entorno de desarrollo.

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

## Jitsi como anfitrion automatico

`meet.jit.si` requiere que el primer usuario autentique una cuenta externa para crear la sala. Para que RehabWeb inicie automaticamente al terapeuta como anfitrion, configura Jitsi as a Service o un servidor Jitsi propio con JWT en `.env`:

```text
JITSI_DOMAIN=8x8.vc
JITSI_APP_ID=tu-app-id
JITSI_KID=tu-app-id/tu-key-id
JITSI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JITSI_JWT_ISSUER=chat
JITSI_JWT_TTL_SECONDS=7200
```

Con esas variables, el backend firma la entrada del terapeuta como moderador y la del paciente como participante.

## Publicar como repositorio nuevo

```bash
git add .
git commit -m "chore: dockerizar backend y frontend"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin develop
```

No subas `.env`; comparte `.env.example`.
