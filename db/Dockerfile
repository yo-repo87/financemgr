FROM postgres:16-alpine

# Self-signed cert baked into the image so backend<->db traffic is encrypted
# even though both containers sit on the same host/network (defense in depth
# for financial data). Not meant to be publicly trusted - only backend talks to this.
RUN apk add --no-cache openssl \
  && mkdir -p /etc/postgresql/certs \
  && openssl req -new -x509 -days 3650 -nodes \
       -subj "/CN=financemgr-db" \
       -out /etc/postgresql/certs/server.crt \
       -keyout /etc/postgresql/certs/server.key \
  && chown postgres:postgres /etc/postgresql/certs/server.crt /etc/postgresql/certs/server.key \
  && chmod 644 /etc/postgresql/certs/server.crt \
  && chmod 600 /etc/postgresql/certs/server.key
