# Autoinforme Psicológico

Aplicación web completa para psicólogos que permite a los pacientes completar autoinformes psicológicos de forma remota.

## Características Principales

La aplicación proporciona un sistema integral para la evaluación psicológica remota, incluyendo la recopilación de datos personales y médicos, cuestionarios estandarizados y generación automática de informes. Los psicólogos pueden crear invitaciones únicas para cada paciente, quienes acceden mediante un enlace seguro para completar el formulario. El sistema incluye siete cuestionarios psicológicos validados (GAD-7, PHQ-9, PSS-4, UCLA-10, AAQ-II, ECR-R, BFI-10) con puntuación automática e interpretación de resultados.

El formulario de datos médicos permite a los pacientes proporcionar información detallada sobre su salud, incluyendo medicamentos, antecedentes, alergias, alimentación y actividad física. Una característica destacada es la posibilidad de adjuntar archivos de analíticas médicas (PDF, imágenes) directamente en el formulario, facilitando la recopilación de información clínica completa.

## Instalación Local

Para ejecutar la aplicación en tu máquina local, sigue estos pasos:

```bash
# Clonar el repositorio
git clone [URL_DEL_REPOSITORIO]
cd autoinforme-simple

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

El servidor se ejecutará en `http://localhost:3000`

## Uso

### Para Psicólogos

Accede al panel de administración en `http://localhost:3000/admin` para crear invitaciones y gestionar evaluaciones. Cada invitación genera un enlace único que puedes enviar al paciente por email. Una vez que el paciente completa la evaluación, podrás ver los resultados detallados en el panel de administración, incluyendo las puntuaciones de los cuestionarios y la interpretación automática.

### Para Pacientes

Los pacientes reciben un enlace único del psicólogo y acceden introduciendo su email. El proceso incluye completar un formulario de datos personales y médicos, donde pueden adjuntar archivos de analíticas si disponen de ellos, seguido de siete cuestionarios psicológicos. Al finalizar, se muestran los resultados de la evaluación.

## Estructura del Proyecto

El proyecto se organiza en varios componentes clave. El archivo `server.js` contiene el servidor Express con todas las rutas y la lógica de negocio. El directorio `public/` incluye `index.html` para la interfaz del paciente y `admin.html` para el panel de administración. La base de datos SQLite (`database.sqlite`) se crea automáticamente al iniciar el servidor, y el directorio `uploads/` almacena los archivos adjuntos por los pacientes.

## Tecnologías

La aplicación está construida con Node.js y Express.js en el backend, utilizando SQLite como base de datos. El frontend emplea HTML5, CSS3 y JavaScript vanilla para una experiencia de usuario fluida. La librería Multer gestiona la carga de archivos, y UUID v4 proporciona identificadores únicos seguros para invitaciones y evaluaciones.

## Despliegue en Railway

Para desplegar la aplicación en Railway, primero asegúrate de tener el código en un repositorio Git. Luego, inicia sesión en Railway (https://railway.app), crea un nuevo proyecto y conecta tu repositorio. Railway detectará automáticamente la configuración de Node.js y desplegará la aplicación. Una vez completado el despliegue, obtendrás una URL pública para compartir con tus pacientes.

El proyecto ya incluye todos los archivos necesarios para el despliegue: `package.json` con las dependencias, `Procfile` para Railway, y `.gitignore` configurado correctamente. No es necesario configurar variables de entorno manualmente, ya que Railway las configura automáticamente.

## Seguridad y Privacidad

La aplicación implementa varias medidas de seguridad para proteger la información de los pacientes. Los tokens de invitación son UUID v4, proporcionando un alto nivel de seguridad y evitando accesos no autorizados. Cada invitación solo puede usarse una vez, y los archivos adjuntos se almacenan con nombres únicos para evitar colisiones. Para entornos de producción, se recomienda implementar autenticación adicional para psicólogos y considerar la encriptación de datos sensibles.

## Licencia

Este proyecto está desarrollado para uso profesional en el ámbito de la psicología clínica.

---

**Consulta el archivo `RESUMEN_PROYECTO.md` para información técnica detallada.**

