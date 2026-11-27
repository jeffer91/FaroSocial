# Decisión de infraestructura — etapa 0.9 (2026-11-27)

Se ha creado un proyecto exclusivo FaroSocial en Neon, en la organización gratuita existente, región aws-us-east-1, PostgreSQL 17. Base farosocial, rama main. Se verificó una consulta SELECT de conexión. Sin tablas de aplicación ni usuarios reales todavía.

Motivo: Supabase rechazó el tercer proyecto gratuito. No se han pausado, eliminado ni reutilizado proyectos ajenos. Neon fue elegido para la fase beta sin costo base dentro de sus límites. No se contrató un plan de pago. Revisar cuotas y precios antes del lanzamiento.

## Compatibilidad
Los borradores de supabase/ se conservan como especificaciones históricas; NO ejecutarlos en Neon tal como están. Usan auth.uid(), auth.jwt(), auth.sessions y storage.objects específicos de Supabase. El frontend 0.8 de GitHub Pages sigue en modo demostración, con configuración vacía. No activar las llamadas antiguas de Supabase ni sustituir el endpoint por una URL de Neon.

## Pasos de integración
1. Diseñar identidad y autorización para Neon Auth / Managed Better Auth; configurar Google y un origen exclusivo de prueba. Verificar sesión real y cierre de sesión; no usar metadatos editables por el cliente para privilegios.
2. Adaptar modelo SQL a PostgreSQL de Neon y ejecutar pruebas en una rama de desarrollo. Separar tablas de clientes, roles administrativos, credenciales y cola; aplicar controles de pertenencia en backend y defensa en profundidad en SQL.
3. Implementar API HTTPS con autorización por solicitud y rol de base de datos de mínimos permisos; no entregar DATABASE_URL ni secretos al navegador. Mantener el prototipo separado hasta tener pruebas de extremo a extremo.
4. Almacenamiento privado, validación de archivos, cuotas y limpieza.
5. Trabajador de publicación y OAuth de redes, con pruebas de duplicados y reconciliación.
6. Hosting apto para SaaS, dominio exclusivo, pagos, observabilidad, copias de seguridad y políticas legales.

No hay aún autenticación activa, persistencia editorial, API de producción, cargas, ni publicación automática. La conexión SQL confirmada no certifica seguridad o disponibilidad de un SaaS.