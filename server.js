const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database(':memory:');

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
        link: `${process.env.BASE_URL || 'http://localhost:3000'}/invite/${token}` 
      });
    }
  );
});

// Validar token de invitación
app.get('/api/validate-token/:token', (req, res) => {
  const { token } = req.params;

  db.get(
    'SELECT * FROM invitations WHERE token = ? AND used = 0',
    [token],
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
app.post('/api/assessments', (req, res) => {
  const { token, patient_name, age, gender, marital_status, occupation, email, consultation_reason, medications, medical_history, allergies, traumas, diet, exercise, supplements, analytics } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token requerido' });
  }

  db.get('SELECT id FROM invitations WHERE token = ? AND used = 0', [token], (err, invitation) => {
    if (err || !invitation) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const assessmentId = uuidv4();

    db.run(
      `INSERT INTO assessments (id, invitation_id, patient_name, age, gender, marital_status, occupation, email, consultation_reason, medications, medical_history, allergies, traumas, diet, exercise, supplements, analytics)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assessmentId, invitation.id, patient_name, age, gender, marital_status, occupation, email, consultation_reason, medications, medical_history, allergies, traumas, diet, exercise, supplements, analytics],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al crear evaluación' });
        }
        res.json({ id: assessmentId });
      }
    );
  });
});

// Guardar respuestas
app.post('/api/answers', (req, res) => {
  const { assessmentId, answers } = req.body;

  if (!assessmentId || !answers) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const insertAnswers = (index = 0) => {
    if (index >= answers.length) {
      return res.json({ success: true });
    }

    const { questionnaireId, questionId, value } = answers[index];
    const answerId = uuidv4();

    db.run(
      'INSERT INTO answers (id, assessment_id, questionnaire_id, question_id, answer_value) VALUES (?, ?, ?, ?, ?)',
      [answerId, assessmentId, questionnaireId, questionId, value],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Error al guardar respuestas' });
        }
        insertAnswers(index + 1);
      }
    );
  };

  insertAnswers();
});

// Calcular puntuaciones
app.post('/api/calculate-scores', (req, res) => {
  const { assessmentId } = req.body;

  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID requerido' });
  }

  db.all(
    'SELECT questionnaire_id, answer_value FROM answers WHERE assessment_id = ? ORDER BY questionnaire_id',
    [assessmentId],
    (err, answers) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener respuestas' });
      }

      const scores = {};

      answers.forEach(answer => {
        if (!scores[answer.questionnaire_id]) {
          scores[answer.questionnaire_id] = [];
        }
        scores[answer.questionnaire_id].push(answer.answer_value);
      });

      const results = [];

      Object.entries(scores).forEach(([qId, values]) => {
        const questionnaire = questionnaires.find(q => q.id === qId);
        if (!questionnaire) return;

        let total = 0;
        values.forEach((value, index) => {
          if (questionnaire.reversed && questionnaire.reversed.includes(index)) {
            total += (questionnaire.scale.max - value + questionnaire.scale.min);
          } else {
            total += value;
          }
        });

        const maxScore = questionnaire.scale.max * questionnaire.questions.length;
        const percentage = (total / maxScore) * 100;
        const interpretation = percentage > 60 ? 'Elevado' : percentage > 40 ? 'Moderado' : 'Bajo';

        const scoreId = uuidv4();
        db.run(
          'INSERT INTO scores (id, assessment_id, questionnaire_id, total_score, max_score, percentage, interpretation) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [scoreId, assessmentId, qId, total, maxScore, percentage, interpretation]
        );

        results.push({
          questionnaireId: qId,
          totalScore: total,
          maxScore,
          percentage: percentage.toFixed(2),
          interpretation
        });
      });

      // Marcar evaluación como completada
      db.run('UPDATE assessments SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?', [assessmentId]);

      res.json(results);
    }
  );
});

// Obtener puntuaciones
app.get('/api/scores/:assessmentId', (req, res) => {
  const { assessmentId } = req.params;

  db.all(
    'SELECT * FROM scores WHERE assessment_id = ?',
    [assessmentId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener puntuaciones' });
      }
      res.json(rows);
    }
  );
});

// Obtener evaluación
app.get('/api/assessments/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM assessments WHERE id = ?', [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }
    res.json(row);
  });
});

// Generar informe
app.post('/api/generate-report', (req, res) => {
  const { assessmentId } = req.body;

  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID requerido' });
  }

  db.get('SELECT * FROM assessments WHERE id = ?', [assessmentId], (err, assessment) => {
    if (err || !assessment) {
      return res.status(404).json({ error: 'Evaluación no encontrada' });
    }

    db.all('SELECT * FROM scores WHERE assessment_id = ?', [assessmentId], (err, scores) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener puntuaciones' });
      }

      let reportContent = `
# Informe Preliminar de Evaluación Psicológica

**Paciente:** ${assessment.patient_name || 'No especificado'}
**Fecha:** ${new Date().toLocaleDateString('es-ES')}
**Edad:** ${assessment.age || 'No especificado'}
**Género:** ${assessment.gender || 'No especificado'}

## Datos Médicos y de Estilo de Vida

**Medicamentos:** ${assessment.medications || 'Ninguno'}
**Antecedentes Médicos:** ${assessment.medical_history || 'Ninguno'}
**Alergias:** ${assessment.allergies || 'Ninguna'}
**Traumas:** ${assessment.traumas || 'Ninguno'}
**Alimentación:** ${assessment.diet || 'No especificado'}
**Ejercicio:** ${assessment.exercise || 'No especificado'}
**Suplementos:** ${assessment.supplements || 'Ninguno'}

## Resultados de Cuestionarios

`;

      scores.forEach(score => {
        reportContent += `
### ${score.questionnaire_id}
- **Puntuación:** ${score.total_score}/${score.max_score}
- **Porcentaje:** ${score.percentage.toFixed(2)}%
- **Interpretación:** ${score.interpretation}

`;
      });

      const reportId = uuidv4();
      db.run(
        'INSERT INTO reports (id, assessment_id, content) VALUES (?, ?, ?)',
        [reportId, assessmentId, reportContent],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error al generar informe' });
          }
          res.json({ id: reportId, content: reportContent });
        }
      );
    });
  });
});

// Obtener informe
app.get('/api/reports/:assessmentId', (req, res) => {
  const { assessmentId } = req.params;

  db.get('SELECT * FROM reports WHERE assessment_id = ?', [assessmentId], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Informe no encontrado' });
    }
    res.json(row);
  });
});

// Actualizar recomendaciones del informe
app.put('/api/reports/:assessmentId', (req, res) => {
  const { assessmentId } = req.params;
  const { recommendations } = req.body;

  db.run(
    'UPDATE reports SET recommendations = ?, updated_at = CURRENT_TIMESTAMP WHERE assessment_id = ?',
    [recommendations, assessmentId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al actualizar informe' });
      }
      res.json({ success: true });
    }
  );
});

// Servir archivo HTML principal
app.get('/invite/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});

