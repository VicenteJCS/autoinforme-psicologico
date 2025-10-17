
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

// Database setup
const db = new sqlite3.Database("database.sqlite");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads/"); // Files will be stored in the 'public/uploads' directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname); // Unique filename
  },
});
const upload = multer({ storage: storage });

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Initialize database
db.serialize(() => {
  // Tabla de invitaciones
  db.run(`CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT 0,
    used_at DATETIME
  )`);

  // Tabla de evaluaciones
  db.run(`CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL,
    patient_name TEXT,
    age INTEGER,
    gender TEXT,
    marital_status TEXT,
    occupation TEXT,
    email TEXT,
    consultation_reason TEXT,
    medications TEXT,
    medical_history TEXT,
    allergies TEXT,
    traumas TEXT,
    diet TEXT,
    exercise TEXT,
    supplements TEXT,
    analytics TEXT,
    analytics_file TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    FOREIGN KEY(invitation_id) REFERENCES invitations(id)
  )`);

  // Tabla de respuestas
  db.run(`CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    questionnaire_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answer_value INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assessment_id) REFERENCES assessments(id)
  )`);

  // Tabla de puntuaciones
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    questionnaire_id TEXT NOT NULL,
    total_score INTEGER,
    max_score INTEGER,
    percentage REAL,
    interpretation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assessment_id) REFERENCES assessments(id)
  )`);

  // Tabla de informes
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    content TEXT,
    recommendations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY(assessment_id) REFERENCES assessments(id)
  )`);
});

// ============= CUESTIONARIOS =============

const questionnaires = [
  {
    id: 'GAD-7',
    name: 'Ansiedad Generalizada',
    questions: [
      'Me he sentido nervioso, ansioso o al borde de un ataque de pánico',
      'No he podido dejar de preocuparme o la preocupación ha sido difícil de controlar',
      'He estado preocupado por varias cosas',
      'He tenido dificultad para relajarme',
      'He estado tan inquieto que me resulta difícil estar quieto',
      'He estado irritable',
      'He sentido miedo como si algo malo fuera a suceder'
    ],
    scale: { min: 0, max: 3, labels: ['Nunca', 'Varios días', 'Más de la mitad de los días', 'Casi todos los días'] }
  },
  {
    id: 'PHQ-9',
    name: 'Depresión',
    questions: [
      'Poco interés o placer en hacer cosas',
      'Me he sentido deprimido, triste o sin esperanza',
      'He tenido dificultad para dormir o he dormido demasiado',
      'Me he sentido cansado o sin energía',
      'He tenido poco apetito o he comido en exceso',
      'Me he sentido mal conmigo mismo',
      'He tenido dificultad para concentrarme',
      'He hablado o actuado tan lentamente que otros lo han notado, o lo opuesto',
      'He pensado que sería mejor estar muerto o he pensado en hacerme daño'
    ],
    scale: { min: 0, max: 3, labels: ['Nunca', 'Varios días', 'Más de la mitad de los días', 'Casi todos los días'] }
  },
  {
    id: 'PSS-4',
    name: 'Estrés Percibido',
    questions: [
      'En el último mes, ¿con qué frecuencia ha sentido que no podía controlar las cosas importantes de su vida?',
      'En el último mes, ¿con qué frecuencia se ha sentido confiado en su capacidad para manejar sus problemas personales?',
      'En el último mes, ¿con qué frecuencia ha sentido que las cosas iban según lo planeado?',
      'En el último mes, ¿con qué frecuencia se ha sentido nervioso o estresado?'
    ],
    scale: { min: 0, max: 4, labels: ['Nunca', 'Casi nunca', 'A veces', 'Frecuentemente', 'Muy frecuentemente'] }
  },
  {
    id: 'UCLA-10',
    name: 'Soledad',
    questions: [
      'Me siento en sintonía con la gente que me rodea',
      'Me falta compañía',
      'Me siento dejado fuera',
      'Mis intereses y ideas no son compartidos por quienes me rodean',
      'Me siento cercano a otras personas',
      'Siento que hay personas que realmente me entienden',
      'Me siento aislado de otros',
      'Puedo encontrar compañerismo cuando lo deseo',
      'Hay personas que realmente me entienden',
      'Me siento solo'
    ],
    scale: { min: 1, max: 4, labels: ['Nunca', 'Raramente', 'A veces', 'Frecuentemente'] },
    reversed: [0, 3, 5, 7, 8]
  },
  {
    id: 'AAQ-II',
    name: 'Flexibilidad Psicológica',
    questions: [
      'Mi vida sería mucho mejor si pudiera dejar de preocuparme por ciertas cosas',
      'Estoy dispuesto a experimentar pensamientos y sentimientos desagradables si eso me ayuda a vivir una vida que es importante para mí',
      'Tengo miedo de mis sentimientos',
      'Estoy en control de mi vida',
      'Frecuentemente me encuentro preocupado por cosas que no puedo controlar',
      'Mis creencias y pensamientos hacen difícil vivir una vida que me gustaría vivir',
      'Estoy dispuesto a hacer lo que sea necesario para lograr mis objetivos'
    ],
    scale: { min: 1, max: 6, labels: ['Muy en desacuerdo', 'En desacuerdo', 'Algo en desacuerdo', 'Algo de acuerdo', 'De acuerdo', 'Muy de acuerdo'] },
    reversed: [0, 2, 4, 5]
  },
  {
    id: 'ECR-R',
    name: 'Relaciones y Apego',
    questions: [
      'Prefiero no mostrar a otros cómo me siento por dentro',
      'Me preocupa que otros no me vean como yo me veo',
      'Tengo miedo de ser abandonado',
      'Deseo ser completamente íntimo emocionalmente con otros',
      'Tengo miedo de que otros no me valoren tanto como yo los valoro',
      'Me resulta difícil permitir que otros se acerquen a mí',
      'Me preocupa mucho mis relaciones',
      'Cuando no estoy con mi pareja, me preocupa que esté con otras personas',
      'Necesito mucha seguridad de que soy amado',
      'Quiero fusionarme completamente con otros y esto a veces asusta a la gente',
      'Cambio mis comportamientos para evitar ser rechazado',
      'Tengo miedo de ser rechazado'
    ],
    scale: { min: 1, max: 7, labels: ['Muy en desacuerdo', 'En desacuerdo', 'Algo en desacuerdo', 'Neutral', 'Algo de acuerdo', 'De acuerdo', 'Muy de acuerdo'] }
  },
  {
    id: 'BFI-10',
    name: 'Personalidad Big Five',
    questions: [
      'Soy extrovertido, entusiasta',
      'Soy crítico, discutidor',
      'Soy confiable, disciplinado',
      'Soy ansioso, fácilmente alterado',
      'Soy abierto a nuevas experiencias, complejo',
      'Soy reservado, tímido',
      'Soy compasivo, tiene un corazón tierno',
      'Soy desorganizado, descuidado',
      'Soy tranquilo, emocionalmente estable',
      'Soy convencional, poco creativo'
    ],
    scale: { min: 1, max: 5, labels: ['Muy en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Muy de acuerdo'] },
    reversed: [1, 5, 7, 8, 9]
  }
];

// ============= RUTAS =============

// Crear invitación (para el psicólogo)
// Obtener todas las invitaciones (para el psicólogo)
app.get('/api/admin/invitations', (req, res) => {
  db.all('SELECT * FROM invitations', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener invitaciones' });
    }
    res.json(rows);
  });
});

// Crear invitación (para el psicólogo)
app.post('/api/invitations', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  const id = uuidv4();
  const token = uuidv4();

  db.run(
    'INSERT INTO invitations (id, token, email) VALUES (?, ?, ?)',
    [id, token, email],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al crear invitación' });
      }
      res.json({ 
        id, 
        token, 
        link: `${process.env.BASE_URL || 'https://3000-i8j0hexxi08vibidsmoqc-9c8fa666.manusvm.computer'}/invite/${token}` 
      });
    }
  );
});

// Validar token de invitación
app.post("/api/validate-token/:token", (req, res) => {
  const { email } = req.body;
  const { token } = req.params;

  db.get(
    'SELECT * FROM invitations WHERE token = ? AND email = ? AND used = 0',
    [token, email],
    (err, row) => {
      if (err || !row) {
        return res.status(400).json({ error: 'Token inválido o expirado' });
      }
      res.json({ valid: true, email: row.email });
    }
  );
});

// Obtener cuestionarios
app.get('/api/questionnaires', (req, res) => {
  res.json(questionnaires);
});

// Crear evaluación
app.post("/api/assessments", upload.single("analytics_file"), (req, res) => {
  console.log('POST /api/assessments - Body:', req.body);
  console.log('POST /api/assessments - File:', req.file);
  const { token, patientName, age, gender, maritalStatus, occupation, email, consultationReason, medications, medicalHistory, allergies, traumas, diet, exercise, exerciseType, exerciseFrequency, exerciseDuration, exerciseIntensity, supplementation, analytics } = req.body;

  if (!token) {
    console.log('Error: Token requerido');
    return res.status(400).json({ error: 'Token requerido' });
  }

  db.get('SELECT * FROM invitations WHERE token = ? AND used = 0', [token], (err, invitation) => {
    if (err || !invitation) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const assessmentId = uuidv4();

    db.run(
      `INSERT INTO assessments (id, invitation_id, patient_name, age, gender, marital_status, occupation, email, consultation_reason, medications, medical_history, allergies, traumas, diet, exercise, exercise_type, exercise_frequency, exercise_duration, exercise_intensity, supplementation, analytics, analytics_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [
        assessmentId,
        invitation.id,
        patientName,
        age,
        gender,
        maritalStatus,
        occupation,
        email,
        consultationReason,
        medications,
        medicalHistory,
        allergies,
        traumas,
        diet,
        exercise === 'true' ? 1 : 0,
        exerciseType,
        exerciseFrequency,
        exerciseDuration,
        exerciseIntensity,
        supplementation,
        analytics,
        req.file ? req.file.filename : null
      ],
      function(err) {
        if (err) {
          console.error("Error al insertar evaluación en la base de datos:", err);
          return res.status(500).json({ error: 'Error al crear evaluación' });
        }
        res.json({ id: assessmentId });
      }
    );
  });
});

// Obtener todas las evaluaciones (para el psicólogo)
app.get("/api/admin/assessments", (req, res) => {
  db.all(
    `SELECT 
      a.id, a.patient_name, a.email, a.created_at, a.completed, 
      (SELECT COUNT(*) FROM answers WHERE assessment_id = a.id) as answer_count,
      (SELECT COUNT(DISTINCT questionnaire_id) FROM answers WHERE assessment_id = a.id) as questionnaire_count
    FROM assessments a`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error al obtener evaluaciones" });
      }
      res.json(rows);
    }
  );
});

// Obtener una evaluación por ID
app.get("/api/assessments/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM assessments WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Error al obtener la evaluación" });
    }
    if (!row) {
      return res.status(404).json({ error: "Evaluación no encontrada" });
    }
    res.json(row);
  });
});


// Enviar respuestas de un cuestionario
app.post("/api/answers", (req, res) => {
  const { assessmentId, questionnaireId, answers } = req.body;

  if (!assessmentId || !questionnaireId || !answers) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  const stmt = db.prepare(
    "INSERT INTO answers (id, assessment_id, questionnaire_id, question_id, answer_value) VALUES (?, ?, ?, ?, ?)"
  );

  answers.forEach((ans) => {
    stmt.run(uuidv4(), assessmentId, questionnaireId, ans.questionId, ans.answerValue);
  });

  stmt.finalize((err) => {
    if (err) {
      return res.status(500).json({ error: "Error al guardar respuestas" });
    }
    res.json({ success: true });
  });
});

// Marcar evaluación como completada y calcular puntuaciones
app.post("/api/assessments/:id/complete", (req, res) => {
  const { id } = req.params;

  // 1. Marcar como completada
  db.run(
    "UPDATE assessments SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Error al completar evaluación" });
      }

      // 2. Calcular y guardar puntuaciones
      calculateAndSaveScores(id, (err) => {
        if (err) {
          return res.status(500).json({ error: "Error al calcular puntuaciones" });
        }
        res.json({ success: true });
      });
    }
  );
});

// Función para calcular y guardar las puntuaciones
function calculateAndSaveScores(assessmentId, callback) {
  db.all(
    "SELECT questionnaire_id, question_id, answer_value FROM answers WHERE assessment_id = ?",
    [assessmentId],
    (err, answers) => {
      if (err) return callback(err);

      const scoresByQuestionnaire = {};

      answers.forEach((ans) => {
        if (!scoresByQuestionnaire[ans.questionnaire_id]) {
          scoresByQuestionnaire[ans.questionnaire_id] = [];
        }
        scoresByQuestionnaire[ans.questionnaire_id].push(ans);
      });

      const stmt = db.prepare(
        "INSERT INTO scores (id, assessment_id, questionnaire_id, total_score, max_score, percentage, interpretation) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );

      for (const questionnaireId in scoresByQuestionnaire) {
        const questionnaire = questionnaires.find((q) => q.id === questionnaireId);
        if (!questionnaire) continue;

        let totalScore = 0;
        let maxScore = 0;

        scoresByQuestionnaire[questionnaireId].forEach((ans) => {
          let value = ans.answer_value;
          if (questionnaire.reversed && questionnaire.reversed.includes(parseInt(ans.question_id))) {
            value = questionnaire.scale.max - value + questionnaire.scale.min;
          }
          totalScore += value;
          maxScore += questionnaire.scale.max;
        });

        const percentage = (totalScore / maxScore) * 100;
        const interpretation = getInterpretation(questionnaireId, totalScore);

        stmt.run(uuidv4(), assessmentId, questionnaireId, totalScore, maxScore, percentage, interpretation);
      }

      stmt.finalize(callback);
    }
  );
}

// Función para obtener la interpretación de la puntuación
function getInterpretation(questionnaireId, score) {
  switch (questionnaireId) {
    case 'GAD-7':
      if (score >= 15) return 'Ansiedad severa';
      if (score >= 10) return 'Ansiedad moderada';
      if (score >= 5) return 'Ansiedad leve';
      return 'Ansiedad mínima';
    case 'PHQ-9':
      if (score >= 20) return 'Depresión severa';
      if (score >= 15) return 'Depresión moderadamente severa';
      if (score >= 10) return 'Depresión moderada';
      if (score >= 5) return 'Depresión leve';
      return 'Depresión mínima';
    case 'PSS-4':
        if (score >= 13) return 'Estrés alto';
        if (score >= 9) return 'Estrés moderado';
        return 'Estrés bajo';
    default:
      return 'Interpretación no disponible';
  }
}

// Obtener puntuaciones de una evaluación
app.get("/api/scores/:assessmentId", (req, res) => {
  const { assessmentId } = req.params;
  db.all("SELECT * FROM scores WHERE assessment_id = ?", [assessmentId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Error al obtener puntuaciones" });
    }
    res.json(rows);
  });
});

// Servir página de invitación
app.get("/invite/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servir panel de administración
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Servir página de prueba de carga de archivos
app.post("/api/test-upload", upload.single("test_file"), (req, res) => {
  console.log("Test Upload - Body:", req.body);
  console.log("Test Upload - File:", req.file);
  if (req.file) {
    res.json({ message: "Archivo de prueba subido exitosamente", filename: req.file.filename });
  } else {
    res.status(400).json({ error: "No se adjuntó ningún archivo" });
  }
});
app.get("/test_upload.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test_upload.html"));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});

