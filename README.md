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

## Versión web 0.3: Google y marcas
- Inicio de sesión exclusivo con Google a través de Supabase Auth, PKCE S256, sin contraseñas en la interfaz. No pide permisos de YouTube.
- El verificador temporal de PKCE se guarda durante cinco minutos en sessionStorage y se consume al volver. Tokens de sesión solo en memoria, sin persistencia ni renovación automática. Al recargar o vencer la sesión hay que volver a ingresar.
- El código y la pantalla están preparados; el acceso no está habilitado hasta configurar el proyecto dedicado de FaroSocial.

### Activación
1. Crear un proyecto exclusivo de FaroSocial y aplicar supabase/schema-draft.sql al proyecto correcto. Verificar RLS con dos cuentas y una sesión anónima.
2. En Google Cloud, configurar Google Auth Platform con el nombre FaroSocial, audiencia de prueba y usuarios autorizados. Crear cliente OAuth de tipo web y registrar como URI de redirección https://<project-ref>.supabase.co/auth/v1/callback (usar el valor exacto que muestra Supabase).
3. En Supabase Auth, habilitar Google, guardar Client ID y Client Secret en el panel de proveedor (nunca en GitHub). Configurar Site URL y URL de redirección exacta https://jeffer91.github.io/FaroSocial/. Evitar comodines.
4. Autorizar la creación inicial de la identidad Google de los probadores. Tras su primer intento, un administrador debe asignar app_metadata.farosocial_access=true al usuario mediante la API administrativa de Auth; no usar user_metadata. El primer intento sin autorización será rechazado. Volver a iniciar sesión para recibir la nueva autorización. Desactivar proveedores no utilizados. Los datos quedan restringidos por RLS al propietario con permiso explícito; una identidad creada no implica acceso a los datos.
5. Configurar solo URL de Supabase y clave publicable en assets/cloud-config.js. Nunca service_role, sb_secret ni secretos de Google.
6. Antes de habilitar el acceso real, aislar el sitio con un dominio exclusivo y actualizar CALLBACK y las URLs en Google/Supabase según corresponda: GitHub Pages de la misma cuenta comparte origen entre repositorios. Verificar el flujo real, expiración, cierre, usuarios no autorizados y separación de cuentas. No es aún un despliegue de producción.
7. La conexión de YouTube y las otras redes se autorizará después, por separado.

Docs: https://supabase.com/docs/guides/auth/social-sign-in/auth-google y https://supabase.com/docs/guides/auth/sessions/pkce-flow

## Versión web 0.4: base SaaS
El borrador SQL anterior, nunca aplicado, se reemplaza por espacios de trabajo, planes, marcas y conexiones. Cada cuenta beta autorizada puede crear un espacio Free; las marcas tienen slots únicos limitados por el plan y RLS por propietario. No se admiten pagos, equipos ni conexiones web. Los límites de publicaciones y conexiones son propuestas. Ver [arquitectura comercial](docs/saas-architecture.md). GitHub Pages es únicamente un entorno de prototipo; antes de producción usar alojamiento comercial y dominio exclusivo.

## Versión web 0.5: administración general
Reporte de solo lectura para administradores beta. El rol `farosocial_admin=true` se asigna exclusivamente mediante administración de Auth en app_metadata; además se requiere `farosocial_access=true`. La función privada verifica los permisos vigentes y la existencia de la sesión en cada solicitud, sin ampliar las políticas de lectura de clientes. No exponer el esquema faro_private. Sin acceso a contraseñas, tokens sociales ni datos de facturación. No asignar roles desde el navegador. Antes de activar: verificar el SQL en proyecto dedicado, ejecutar advisors y probar rol ordinario, administrador, anónimo, revocación, sesión cerrada y paginación. No se han realizado pruebas de base de datos porque el proyecto no existe.

## Versión web 0.6: editor y calendario
El prototipo en Pages permite probar borradores ficticios en memoria sin iniciar sesión. No introducir datos reales en la demo. El modo autenticado requiere el proyecto dedicado, las políticas RLS y la tabla faro_drafts del borrador SQL. Permite crear y editar títulos, descripción, redes objetivo y fechas/horas editoriales. Las fechas son datos editoriales, sin zona horaria ni ejecución automática. No hay envío, carga multimedia, cuotas de publicación ni conexiones activas. Se muestran hasta 200 registros del mes y sin fecha por marca; la lista de resultados advierte cuando supera ese límite. Límites de caracteres internos del editor, no certificación de las reglas de las plataformas. Se corrigen delimitadores del SQL administrativo. Las pruebas SQL y de extremo a extremo siguen pendientes.

## Versión web 0.7: biblioteca multimedia
En GitHub Pages, la demo permite seleccionar archivos locales, previsualizarlos y referenciar uno por borrador. Los archivos no se transmiten ni persisten al recargar. Formatos de demo: JPEG, PNG, WebP (10 MiB) y MP4 (30 MiB), hasta 20 archivos y 60 MiB en total. Estos límites son de prueba, no comerciales. El modo autenticado incorpora listado de metadatos y descarga privada autenticada de archivos registrados, con controles de MIME y tamaño. El borrador SQL añade faro_media, una referencia por marca en faro_drafts y política de lectura del bucket privado faro-media. Crear el bucket mediante el panel/API de Storage; no se ha creado ni ejecutado SQL. La carga, eliminación, cuotas de almacenamiento, análisis de archivos y limpieza requieren un servicio seguro antes de activar producción. No habilitar subida directa al cliente. Un archivo adjunto no equivale a una publicación.

## Versión web 0.8: motor de cola (simulación)
Desde un borrador guardado con fecha y hora futuras se pueden crear trabajos por red en la demo, eligiendo un desfase UTC explícito (no zona IANA ni ajuste automático de horario de verano). Avanzar el reloj y procesar un trabajo simula resultados. La máquina de estados limita reintentos a tres intentos totales, evita duplicados por borrador/red, permite cancelar trabajos pendientes y separa resultados inciertos para revisión. No hay envío ni temporizador real. La propuesta supabase/queue-draft.sql define persistencia privada futura; no se ha aplicado. Faltan servicio de encolado autenticado, cuotas, validación de pertenencia y conexión, trabajador transaccional, credenciales, reconciliación con proveedores, auditoría y pruebas SQL/concurrencia. No desplegar un cron de producción ni activar envíos todavía.

## Etapa 0.9: infraestructura independiente
Se ha creado y verificado una base PostgreSQL dedicada en Neon. El prototipo web 0.8 se mantiene en modo demo hasta adaptar la autenticación y el backend. Los SQL de Supabase no son ejecutables directamente en Neon. Ver [decisión y pasos de integración](docs/infrastructure-0.9.md).
