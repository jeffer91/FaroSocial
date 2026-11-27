# FaroSocial — arquitectura comercial 0.4

Prototipo sin clientes reales, cobros ni publicaciones web. Cada cuenta beta autorizada crea un espacio de trabajo con marcas propias. Los equipos, las invitaciones y los roles son una fase posterior.

| Plan de referencia | Marcas | Conexiones | Publicaciones mensuales |
|---|---:|---:|---:|
| Free | 1 | 2 | 10 |
| Pro | 3 | 12 | 100 |
| Business | 10 | 40 | 500 |

Cupos propuestos, sin precios aprobados. El cupo de marcas se diseña con slots únicos y RLS, aún sin pruebas SQL. No hay cuotas operativas de conexiones/publicaciones ni cambios de plan en cliente. Para producción: webhooks de cobro verificados, idempotencia, límites en servidor y reglas de cancelación.

## Puertas de salida a producción
- Proyecto dedicado, dominio exclusivo, hosting comercial permitido y HTTPS. GitHub Pages solo para prototipo.
- Registro automático comercial, controles de abuso, renovación de sesiones y recuperación.
- Pruebas RLS con dos clientes, anónimo y beta denegado. Rechazar owner_id o plan_code proporcionados por cliente, slots fuera de cupo, duplicados y peticiones simultáneas.
- OAuth de redes con credenciales cifradas y permisos independientes; aprobación de plataformas.
- Colas, reintentos idempotentes, auditoría, alertas, retención y copias de seguridad.
- Facturación, cancelación y política de privacidad, términos y eliminación de cuenta/datos.
- Pruebas de extremo a extremo antes de aceptar clientes.

No desplegar el servidor Node local como servicio comercial.
