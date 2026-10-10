# PostgreSQL 16 with WAL-G, for continuous archiving and point-in-time
# recovery (plan v10 DR-02, KARAR-DR-2: WAL-G).
#
# The same Debian (trixie) base the development stack runs, so the two sort
# text the same way (glibc collations); the official WAL-G binary is built
# against glibc and would not run on Alpine. WAL-G's archive is off until
# PG_ARCHIVE_MODE=on and its storage settings are given
# (docker-compose.prod.yml, docs/disaster-recovery.md).
#
# Built and pushed by the release workflow as
# ghcr.io/<owner>/supportio-postgres:16.15-walg-3.0.9; the server only pulls.
ARG POSTGRES_IMAGE=postgres:16.15-trixie@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65
FROM ${POSTGRES_IMAGE}

COPY init-roles.sh /docker-entrypoint-initdb.d/010-supportio-roles.sh
RUN chmod 0755 /docker-entrypoint-initdb.d/010-supportio-roles.sh

ARG TARGETARCH=amd64
ARG WALG_VERSION=v3.0.9
ARG WALG_SHA256_AMD64=444ce216230c254edef803e098a59a1746806da3e0d55671d7b0f0082db14ef4
ARG WALG_SHA256_ARM64=cb37c5f8391bd8ef2efceeb9c6995059c0abf2fa74b9b717b42a16a7c93cfde1

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) arch=amd64; sum="${WALG_SHA256_AMD64}" ;; \
      arm64) arch=aarch64; sum="${WALG_SHA256_ARM64}" ;; \
      *) echo "unsupported architecture ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    name="wal-g-pg-24.04-${arch}"; \
    curl -fsSL -o /tmp/walg.tar.gz \
      "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/${name}.tar.gz"; \
    echo "${sum}  /tmp/walg.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/walg.tar.gz -C /tmp; \
    install -m 0755 "/tmp/${name}" /usr/local/bin/wal-g; \
    apt-get purge -y curl; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/* /tmp/*; \
    wal-g --version
