# CEUTA militares

Plataforma web para el estudio **Impacto de la crisis migratoria de Ceuta a nivel psicofisiológico, cognitivo y funcional** en personal militar.

## Funciones
- Consentimiento informado y código anónimo.
- Perfil militar, unidad, empleo y experiencia.
- Exposición a la crisis, carga de servicio, familia, seguridad e impacto sobre la vida.
- Sueño, fatiga y somnolencia.
- DASS-21 y Copenhagen Burnout Inventory.
- Preparación operativa, instrucción específica de combate, mando y apoyo institucional.
- Pruebas cognitivas en navegador: vigilancia psicomotora, Go/No-Go, discriminación/elección y memoria de trabajo 2-back.
- Registro ensayo a ensayo.
- Panel privado en /admin.
- Exportación CSV analítica, CSV de ensayos y JSON completo.

## Variables de entorno
DATABASE_URL y ADMIN_KEY son obligatorias. PORT es suministrado por el proveedor de alojamiento.

## Despliegue
La aplicación está preparada para Railway u otro servicio compatible con Docker/Node y PostgreSQL. El directorio raíz del servicio debe establecerse en /ceuta-militares.
