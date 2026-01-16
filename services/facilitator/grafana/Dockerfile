# Grafana custom image for T402 Facilitator monitoring
FROM grafana/grafana:11.4.0

# Switch to root for setup
USER root

# Create directories
RUN mkdir -p /var/lib/grafana/dashboards \
    && mkdir -p /etc/grafana/provisioning/datasources \
    && mkdir -p /etc/grafana/provisioning/dashboards \
    && mkdir -p /etc/grafana/provisioning/alerting

# Copy provisioning configurations
COPY provisioning/datasources/prometheus.yml /etc/grafana/provisioning/datasources/
COPY provisioning/dashboards/default.yml /etc/grafana/provisioning/dashboards/
COPY provisioning/alerting/alerts.yml /etc/grafana/provisioning/alerting/
COPY provisioning/alerting/contact-points.yml /etc/grafana/provisioning/alerting/
COPY provisioning/alerting/notification-policies.yml /etc/grafana/provisioning/alerting/

# Copy dashboards
COPY dashboards/facilitator.json /var/lib/grafana/dashboards/

# Set correct permissions
RUN chown -R grafana:root /var/lib/grafana \
    && chown -R grafana:root /etc/grafana/provisioning \
    && chmod -R 755 /var/lib/grafana/dashboards \
    && chmod -R 755 /etc/grafana/provisioning

# Switch back to grafana user
USER grafana

# Environment variables for anonymous access (can be overridden)
ENV GF_AUTH_ANONYMOUS_ENABLED=true \
    GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer \
    GF_AUTH_DISABLE_LOGIN_FORM=false \
    GF_USERS_ALLOW_SIGN_UP=false \
    GF_SERVER_ROOT_URL=https://grafana.facilitator.t402.io

# Expose Grafana port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1
