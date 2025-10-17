# Autoinforme Psicológico - Resumen del Proyecto

## Descripción General

Aplicación web completa para psicólogos que permite a los pacientes completar autoinformes psicológicos de forma remota. La aplicación incluye cuestionarios estandarizados, recopilación de datos médicos y generación automática de informes.

## Características Implementadas

### 1. **Sistema de Invitaciones**
- Los psicólogos pueden crear invitaciones únicas para cada paciente
- Cada invitación genera un enlace único y seguro
- Las invitaciones se marcan como "usadas" después de completar la evaluación
- Panel de administración para gestionar invitaciones

### 2. **Formulario de Datos Personales y Médicos**
- **Datos Descriptivos:**
  - Nombre completo
  - Edad
  - Género
  - Estado civil
  - Ocupación
  - Motivo de consulta

- **Datos Médicos y Estilo de Vida:**
  - Medicamentos actuales
  - Antecedentes médicos
  - Alergias e intolerancias
  - Experiencias traumáticas o estresantes
  - Alimentación
  - Actividad física (con campos condicionales)
  - Suplementación
  - **Analíticas recientes** (con campos condicionales):
    - Campo de texto para resultados relevantes
    - **Campo de carga de archivos** para adjuntar analíticas (PDF, imágenes, etc.)

### 3. **Cuestionarios Psicológicos Estandarizados**
- **GAD-7** (Trastorno de Ansiedad Generalizada)
- **PHQ-9** (Depresión)
- **PSS-4** (Estrés Percibido)
- **UCLA-10** (Soledad)
- **AAQ-II** (Flexibilidad Psicológica)
- **ECR-R** (Apego)
- **BFI-10** (Personalidad Big Five)

### 4. **Puntuación Automática**
- Cálculo automático de puntuaciones para cada cuestionario
- Interpretación de resultados según baremos establecidos
- Visualización de resultados en el panel de administración

### 5. **Panel de Administración para Psicólogos**
- Dashboard con estadísticas generales
- Gestión de invitaciones (crear, ver estado)
- Visualización de evaluaciones completadas
- Acceso a resultados detallados de cada paciente

### 6. **Funcionalidad de Carga de Archivos** ✅
- Los pacientes pueden adjuntar archivos de analíticas médicas
- Formatos soportados: PDF, imágenes (JPG, PNG), documentos de texto
- Los archivos se almacenan en el servidor en el directorio `uploads/`
- El nombre del archivo se guarda en la base de datos asociado a la evaluación

## Tecnologías Utilizadas

- **Backend:** Node.js + Express.js
- **Base de Datos:** SQLite
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Carga de Archivos:** Multer
- **Identificadores Únicos:** UUID v4

## Estructura de la Base de Datos

### Tabla `invitations`
- `id`: Identificador único
- `token`: Token único para acceder a la evaluación
- `email`: Email del paciente
- `created_at`: Fecha de creación
- `used`: Estado de uso (0 = no usada, 1 = usada)

### Tabla `assessments`
- `id`: Identificador único
- `invitation_id`: Referencia a la invitación
- `patient_name`: Nombre del paciente
- `age`: Edad
- `gender`: Género
- `marital_status`: Estado civil
- `occupation`: Ocupación
- `email`: Email
- `consultation_reason`: Motivo de consulta
- `medications`: Medicamentos actuales
- `medical_history`: Antecedentes médicos
- `allergies`: Alergias
- `traumas`: Experiencias traumáticas
- `diet`: Alimentación
- `exercise`: Actividad física
- `supplements`: Suplementación
- `analytics`: Resultados de analíticas (texto)
- **`analytics_file`**: Nombre del archivo de analíticas adjunto ✅
- `created_at`: Fecha de creación

### Tabla `answers`
- `id`: Identificador único
- `assessment_id`: Referencia a la evaluación
- `questionnaire_id`: Identificador del cuestionario
- `question_id`: Identificador de la pregunta
- `answer_value`: Valor de la respuesta
- `created_at`: Fecha de creación

## Instrucciones de Uso

### Para el Psicólogo:

1. **Acceder al Panel de Administración:**
   - Navegar a `https://[URL_DE_LA_APP]/admin`

2. **Crear una Invitación:**
   - Hacer clic en "+ Nueva Invitación"
   - Introducir el email del paciente
   - Copiar el enlace generado y enviarlo al paciente

3. **Ver Resultados:**
   - En el panel de administración, navegar a la sección "Evaluaciones"
   - Hacer clic en una evaluación para ver los resultados detallados

### Para el Paciente:

1. **Acceder a la Evaluación:**
   - Hacer clic en el enlace recibido del psicólogo

2. **Validar Acceso:**
   - Introducir el email proporcionado

3. **Completar el Formulario:**
   - Rellenar todos los campos requeridos
   - Si dispone de analíticas recientes:
     - Seleccionar "Sí" en la pregunta sobre analíticas
     - Introducir los resultados relevantes en el campo de texto
     - **Adjuntar el archivo de analíticas** usando el botón "Choose File"
   - Hacer clic en "Continuar a Cuestionarios"

4. **Completar los Cuestionarios:**
   - Responder a todas las preguntas de cada cuestionario
   - Navegar entre cuestionarios usando los botones "Anterior" y "Siguiente"

5. **Ver Resultados:**
   - Al finalizar, se mostrarán los resultados de la evaluación

## Despliegue en Railway

### Requisitos:
- Cuenta en Railway (https://railway.app)
- Repositorio Git con el código del proyecto

### Pasos:

1. **Preparar el Proyecto:**
   - El proyecto ya está configurado con:
     - `package.json` con todas las dependencias
     - `Procfile` para Railway
     - `.gitignore` para excluir `node_modules` y la base de datos

2. **Subir a Git:**
   ```bash
   cd /home/ubuntu/autoinforme-simple
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin [URL_DEL_REPOSITORIO]
   git push -u origin main
   ```

3. **Desplegar en Railway:**
   - Iniciar sesión en Railway
   - Crear un nuevo proyecto
   - Conectar el repositorio Git
   - Railway detectará automáticamente la configuración de Node.js
   - Esperar a que se complete el despliegue
   - Copiar la URL pública generada

4. **Configurar Variables de Entorno (opcional):**
   - `PORT`: Puerto del servidor (Railway lo configura automáticamente)
   - `BASE_URL`: URL base de la aplicación (se configura automáticamente)

## Archivos Importantes

- `server.js`: Servidor Express con todas las rutas y lógica de negocio
- `public/index.html`: Interfaz de usuario para pacientes
- `public/admin.html`: Panel de administración para psicólogos
- `database.sqlite`: Base de datos SQLite (se crea automáticamente)
- `uploads/`: Directorio para almacenar archivos adjuntos
- `package.json`: Dependencias del proyecto
- `Procfile`: Configuración para Railway

## Notas Técnicas

### Seguridad:
- Los tokens de invitación son UUID v4 (altamente seguros)
- Las invitaciones solo se pueden usar una vez
- Los archivos se almacenan con nombres únicos para evitar colisiones

### Escalabilidad:
- SQLite es adecuado para aplicaciones pequeñas a medianas
- Para mayor escalabilidad, considerar migrar a PostgreSQL o MySQL
- Los archivos adjuntos se almacenan localmente; para producción, considerar usar un servicio de almacenamiento en la nube (S3, Google Cloud Storage)

### Mejoras Futuras Sugeridas:
- Autenticación de psicólogos con usuario y contraseña
- Exportación de informes en PDF
- Notificaciones por email cuando un paciente completa la evaluación
- Gráficos de evolución para pacientes recurrentes
- Almacenamiento de archivos en la nube
- Encriptación de datos sensibles

## Soporte

Para cualquier problema o pregunta, consultar la documentación de las tecnologías utilizadas:
- Express.js: https://expressjs.com/
- Multer: https://github.com/expressjs/multer
- SQLite: https://www.sqlite.org/docs.html
- Railway: https://docs.railway.app/

---

**Desarrollado para facilitar el trabajo de psicólogos y mejorar la experiencia de los pacientes en el proceso de evaluación psicológica.**

