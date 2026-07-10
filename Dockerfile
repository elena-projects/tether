# Serve the pre-built Vite static app (dist/) on Cloud Run.
FROM nginx:1.27-alpine
# nginx.conf is a template: the base image runs envsubst on /etc/nginx/templates/*.template
# at start-up, injecting ${GEMINI_API_KEY} (a Cloud Run env var) into the config.
# NGINX_ENVSUBST_FILTER limits substitution to that one var so nginx's own $host/$request_uri stay intact.
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_FILTER=GEMINI_API_KEY
COPY dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
