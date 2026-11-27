# FaroSocial

Crea una vez. Publica en todas partes.

Versión 0.1: aplicación independiente de Metricool, con interfaz en español y primer conector real para YouTube en entorno local de un solo operador. No es un servicio público listo para producción.

## GitHub Pages
La interfaz pública se despliega en https://jeffer91.github.io/FaroSocial/ mediante GitHub Actions. En Settings > Pages > Source selecciona GitHub Actions. El flujo `pages.yml` comprueba el código y publica únicamente index.html y assets/; no incluye el servidor ni archivos de configuración privada. En Actions se puede verificar el despliegue o ejecutarlo manualmente.

La página pública es una vista estática hasta integrar un backend HTTPS con autenticación. No se guardan tokens ni contraseñas en el navegador. No se debe exponer el servidor local existente ni intentar acceder a él desde Pages.

## Inicio local
Requiere Node.js 22 o posterior. No requiere paquetes externos.
1. Copia .env.example a .env. Configura una contraseña larga y una clave de cifrado aleatoria: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. En Google Cloud crea un proyecto, habilita YouTube Data API v3, configura consentimiento OAuth y un cliente OAuth de tipo aplicación web. Registra exactamente http://localhost:8787/oauth/youtube/callback. Si está en modo pruebas, añade tu cuenta como usuario de prueba.
3. Guarda el ID y secreto del cliente en .env (nunca en GitHub).
4. Ejecuta `npm start` y abre http://localhost:8787. Autentícate como admin con tu contraseña.
5. Pulsa Conectar YouTube, concede permisos en Google y regresa. Puedes subir un MP4 privado para probar. La publicación pública está deshabilitada en esta versión.
6. Ejecuta `npm test` para las pruebas unitarias.

El usuario final no introduce claves de desarrollador en la interfaz: las configura una vez el operador. Google puede requerir verificación/auditoría. Los tokens de proyectos externos en modo pruebas pueden caducar a los siete días.

## Alcance
- OAuth real de YouTube: estado de un solo uso, PKCE, intercambio en servidor, identificación de canal, renovación y revocación.
- Carga de MP4 privada bajo confirmación explícita, hasta 100 MiB; la aplicación no promete que el procesamiento haya terminado.
- Facebook, Instagram y TikTok: tarjetas informativas, no conectores activos.
- Calendario, múltiples marcas/cuentas, colas, almacenamiento multimedia y publicación pública: pendientes.
- No se usa Metricool ni se pide la contraseña de las redes.

## Seguridad
El servidor escucha exclusivamente en loopback y valida Host y Origin. Acceso HTTP Basic local, tokens cifrados AES-256-GCM en .data con permisos restrictivos, estado OAuth ligado a cookie, expiración y consumo único. El frontend nunca recibe tokens. No desplegar este servidor local en Internet ni mediante túneles: antes de producción se requieren HTTPS, autenticación multiusuario, aislamiento por propietario, almacenamiento cifrado gestionado, auditoría y pruebas de integración. Si se pierde la clave de cifrado, será necesario revocar/reconectar.

La revocación puede retirar otros permisos concedidos al mismo proyecto de Google. Si falla, la conexión local se conserva y se informa del error. El estado de conexión refleja las credenciales locales, no una verificación permanente de Google.

## Referencias
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/youtube/v3/docs/videos/insert
- https://developers.tiktok.com/doc/content-sharing-guidelines/
- https://developers.facebook.com/
