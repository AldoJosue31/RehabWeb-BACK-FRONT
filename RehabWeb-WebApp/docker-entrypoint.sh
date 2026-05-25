#!/bin/sh
set -eu

APP_PORT="${APP_PORT:-4200}"
NG_ARGS="--host 0.0.0.0 --port ${APP_PORT} --proxy-config proxy.docker.conf.json --allowed-hosts --poll 2000"

if [ "${FRONTEND_HTTPS:-true}" = "true" ]; then
  CERT_DIR="${FRONTEND_CERT_DIR:-/app/.certs}"
  CERT_FILE="${CERT_DIR}/rehabweb-local.crt"
  KEY_FILE="${CERT_DIR}/rehabweb-local.key"
  CONFIG_FILE="${CERT_DIR}/openssl.cnf"

  mkdir -p "${CERT_DIR}"

  if [ ! -f "${CERT_FILE}" ] || [ ! -f "${KEY_FILE}" ]; then
    {
      echo "[req]"
      echo "default_bits = 2048"
      echo "prompt = no"
      echo "default_md = sha256"
      echo "distinguished_name = dn"
      echo "x509_extensions = v3_req"
      echo
      echo "[dn]"
      echo "CN = localhost"
      echo
      echo "[v3_req]"
      echo "basicConstraints = critical,CA:TRUE"
      echo "keyUsage = critical,digitalSignature,keyEncipherment,keyCertSign"
      echo "extendedKeyUsage = serverAuth"
      echo "subjectAltName = @alt_names"
      echo
      echo "[alt_names]"
      echo "DNS.1 = localhost"
      echo "IP.1 = 127.0.0.1"
      if [ -n "${FRONTEND_LAN_IP:-}" ]; then
        echo "IP.2 = ${FRONTEND_LAN_IP}"
      fi
    } > "${CONFIG_FILE}"

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "${KEY_FILE}" \
      -out "${CERT_FILE}" \
      -config "${CONFIG_FILE}"
  fi

  exec npx ng serve ${NG_ARGS} --ssl --ssl-cert "${CERT_FILE}" --ssl-key "${KEY_FILE}"
fi

exec npx ng serve ${NG_ARGS}
