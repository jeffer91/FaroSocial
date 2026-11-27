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

## Versión web 0.2: acceso y marcas
Se preparó un módulo de inicio de sesión y creación/listado de marcas usando Supabase Auth y PostgREST, sin dependencias externas. No se habilita hasta registrar un proyecto exclusivo de FaroSocial, configurar su URL y clave publicable en assets/cloud-config.js y aplicar el borrador supabase/schema-draft.sql al proyecto correcto. Crear usuarios autorizados y desactivar registro público antes de habilitar el acceso. El token de sesión permanece en memoria (no en localStorage); al recargar hay que iniciar sesión otra vez. No se implementa aún renovación de sesión ni conexión social web. Las claves de servidor y tokens sociales nunca deben ir en el navegador. Antes del acceso real se recomienda un dominio exclusivo, ya que los sitios de GitHub Pages de una misma cuenta comparten origen. Verificar permisos con dos cuentas y una sesión anónima antes de publicar funciones de escritura.
