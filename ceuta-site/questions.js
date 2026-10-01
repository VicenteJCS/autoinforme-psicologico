window.CEUTA_QUESTIONS = {
  sections: [
    {
      id:"profile", kicker:"01 · PERFIL", title:"Perfil personal y militar",
      intro:"Variables necesarias para caracterizar la muestra y analizar diferencias por unidad, empleo y experiencia.",
      questions:[
        {id:"age_group",type:"select",label:"Edad",required:true,options:["18–24","25–34","35–44","45–54","55 o más","Prefiero no responder"]},
        {id:"sex",type:"select",label:"Sexo",required:true,options:["Hombre","Mujer","Otro / prefiero no responder"]},
        {id:"army",type:"select",label:"Ejército / organización de pertenencia",required:true,options:["Ejército de Tierra","Armada","Ejército del Aire y del Espacio","Unidad Militar de Emergencias","Cuerpos Comunes","Otro"]},
        {id:"unit",type:"text",label:"Unidad de destino",required:true,hint:"Indique la unidad, evitando datos de sección, pelotón, turno u otros detalles que permitan identificarle."},
        {id:"rank",type:"select",label:"Empleo",required:true,options:["Soldado / Marinero","Cabo","Cabo 1º","Cabo Mayor","Sargento","Sargento 1º","Brigada","Subteniente","Suboficial Mayor","Alférez","Teniente","Capitán","Comandante","Teniente Coronel","Coronel","General / empleo superior","Otro / prefiero no responder"]},
        {id:"years_service",type:"select",label:"Años de servicio",required:true,options:["<2","2–5","6–10","11–15","16–20",">20"]},
        {id:"role",type:"select",label:"Función principal durante la situación actual",required:true,options:["Mando / coordinación","Patrulla / presencia","Seguridad / control","Apoyo logístico","Sanidad","Transmisiones / sistemas","Conducción / transporte","Administración","Otra"]},
        {id:"prior_deployments",type:"select",label:"Experiencia previa en despliegues u operaciones",required:true,options:["Ninguna","1","2–3","4–5",">5"]},
        {id:"similar_exp",type:"radio",label:"¿Había participado antes en situaciones de características similares?",required:true,options:["Sí","No"]},
        {id:"ceuta_resident",type:"radio",label:"¿Reside habitualmente en Ceuta?",required:true,options:["Sí","No"]},
        {id:"family_ceuta",type:"radio",label:"¿Su pareja o familia conviviente reside actualmente en Ceuta?",required:true,options:["Sí","No","No procede"]}
      ]
    },
    {
      id:"exposure", kicker:"02 · EXPOSICIÓN", title:"Carga de servicio y exposición a la crisis",
      intro:"Estas preguntas permiten distinguir cantidad de actividad, intensidad y características de la exposición.",
      questions:[
        {id:"days_crisis",type:"number",label:"Días aproximadamente implicado en el dispositivo o afectado por la situación actual",required:true,min:0,max:365},
        {id:"hours_week",type:"number",label:"Horas de servicio aproximadas durante los últimos 7 días",required:true,min:0,max:168},
        {id:"night_services",type:"select",label:"Servicios nocturnos durante los últimos 7 días",required:true,options:["0","1","2","3","4","5 o más"]},
        {id:"patrols",type:"select",label:"Número aproximado de patrullas / servicios directamente vinculados a la situación",required:true,options:["0","1–2","3–5","6–10","11–20",">20"]},
        {id:"interventions",type:"select",label:"Número aproximado de intervenciones directas",required:true,options:["0","1","2–3","4–5","6–10",">10"]},
        {id:"incidents",type:"select",label:"Número aproximado de incidencias relevantes",required:true,options:["0","1","2–3","4–5","6–10",">10"]},
        {id:"verbal_conflict",type:"select",label:"Confrontaciones verbales",required:true,options:["Ninguna","1","2–3","4–5",">5"]},
        {id:"physical_conflict",type:"select",label:"Confrontaciones físicas",required:true,options:["Ninguna","1","2–3","4–5",">5"]},
        {id:"vulnerable_contact",type:"select",label:"Contacto con personas vulnerables o situaciones emocionalmente exigentes",required:true,options:["Ninguno","Bajo","Moderado","Alto","Muy alto"]},
        {id:"exposure_intensity",type:"slider",label:"Intensidad global de la exposición",required:true,min:0,max:10,step:1},
        {id:"max_incident_intensity",type:"slider",label:"Intensidad de la situación más exigente vivida",required:true,min:0,max:10,step:1},
        {id:"threat",type:"slider",label:"Amenaza percibida para usted o sus compañeros",required:true,min:0,max:10,step:1},
        {id:"unpredictability",type:"slider",label:"Imprevisibilidad de las situaciones",required:true,min:0,max:10,step:1},
        {id:"mental_demand",type:"slider",label:"Exigencia mental",required:true,min:0,max:10,step:1},
        {id:"physical_demand",type:"slider",label:"Exigencia física",required:true,min:0,max:10,step:1},
        {id:"emotional_demand",type:"slider",label:"Carga emocional",required:true,min:0,max:10,step:1},
        {id:"control_situation",type:"slider",label:"Sensación de control sobre la situación",required:true,min:0,max:10,step:1}
      ]
    },
    {
      id:"psych", kicker:"03 · ESTADO PSICOLÓGICO", title:"Estrés, ansiedad y estado emocional",
      intro:"Escala DASS-21. Indique en qué medida cada afirmación se ha aplicado a usted durante la última semana.",
      questions:[
        {id:"dass",type:"matrix",required:true,scale:["0 · No me sucedió","1 · Algo / parte del tiempo","2 · Bastante / buena parte del tiempo","3 · Mucho / la mayor parte del tiempo"],items:[
          ["dass1","Me costó mucho relajarme"],["dass2","Me di cuenta de que tenía la boca seca"],["dass3","No podía sentir ningún sentimiento positivo"],["dass4","Se me hizo difícil respirar sin haber realizado esfuerzo físico"],["dass5","Se me hizo difícil tomar la iniciativa para hacer cosas"],["dass6","Reaccioné exageradamente en ciertas situaciones"],["dass7","Tuve temblores, por ejemplo en las manos"],["dass8","Sentí que tenía muchos nervios"],["dass9","Estuve preocupado por situaciones en las que podía entrar en pánico y hacer el ridículo"],["dass10","Sentí que no tenía nada por lo que ilusionarme"],["dass11","Me sentí agitado"],["dass12","Se me hizo difícil relajarme"],["dass13","Me sentí triste y deprimido"],["dass14","No toleré nada que no me permitiera continuar con lo que estaba haciendo"],["dass15","Sentí que estaba cercano a sentir pánico"],["dass16","No me pude entusiasmar por nada"],["dass17","Sentí que valía muy poco como persona"],["dass18","Sentí que estaba muy irritable"],["dass19","Sentí la actividad de mi corazón sin haber hecho esfuerzo físico"],["dass20","Tuve miedo sin razón"],["dass21","Sentí que la vida no tenía ningún sentido"]
        ]},
        {id:"crisis_stress",type:"slider",label:"Estrés que le genera específicamente la crisis actual",required:true,min:0,max:10,step:1},
        {id:"mental_fatigue",type:"slider",label:"Fatiga mental actual",required:true,min:0,max:10,step:1},
        {id:"physical_fatigue",type:"slider",label:"Fatiga física actual",required:true,min:0,max:10,step:1},
        {id:"concentration_self",type:"slider",label:"Capacidad de concentración percibida en este momento",required:true,min:0,max:10,step:1}
      ]
    },
    {
      id:"burnout", kicker:"04 · BURNOUT", title:"Agotamiento personal y relacionado con el trabajo",
      intro:"Copenhagen Burnout Inventory, dimensiones personal y laboral. Responda pensando en su situación actual.",
      questions:[
        {id:"cbi",type:"matrix",required:true,scale:["0 · Nunca","25 · Solo alguna vez","50 · Algunas veces","75 · Muchas veces","100 · Siempre"],items:[
          ["cbi_p1","¿Con qué frecuencia se siente cansado?"],["cbi_p2","¿Con qué frecuencia está agotado físicamente?"],["cbi_p3","¿Con qué frecuencia está agotado emocionalmente?"],["cbi_p4","¿Con qué frecuencia piensa: «no puedo más»?"],["cbi_p5","¿Con qué frecuencia se siente desgastado?"],["cbi_p6","¿Con qué frecuencia se siente débil y susceptible de enfermar?"],["cbi_w1","¿Está agotado al final de la jornada de trabajo?"],["cbi_w2","¿Está exhausto por la mañana al pensar que tiene que afrontar otro día de trabajo?"],["cbi_w3","¿Siente que cada hora de trabajo es agotadora?"],["cbi_w4","¿Tiene suficiente energía para la familia y los amigos durante el tiempo de ocio?"],["cbi_w5","¿Es su trabajo emocionalmente agotador?"],["cbi_w6","¿Le frustra su trabajo?"],["cbi_w7","¿Se siente quemado por su trabajo?"]
        ]}
      ]
    },
    {
      id:"sleep", kicker:"05 · SUEÑO Y RECUPERACIÓN", title:"Sueño, somnolencia y recuperación",
      intro:"Se evalúan cantidad y calidad de sueño, interrupciones, recuperación y somnolencia en el momento de realizar las pruebas.",
      questions:[
        {id:"sleep_24h",type:"number",label:"Horas totales de sueño en las últimas 24 horas",required:true,min:0,max:16,step:0.25},
        {id:"sleep_7d",type:"number",label:"Horas medias de sueño por noche durante los últimos 7 días",required:true,min:0,max:16,step:0.25},
        {id:"sleep_before",type:"number",label:"Horas habituales de sueño por noche antes de la crisis actual",required:true,min:0,max:16,step:0.25},
        {id:"sleep_latency",type:"select",label:"Tiempo habitual para conciliar el sueño",required:true,options:["<15 min","15–30 min","31–60 min",">60 min"]},
        {id:"awakenings",type:"select",label:"Número habitual de despertares nocturnos",required:true,options:["0","1","2","3","4 o más"]},
        {id:"nights_under5",type:"select",label:"Noches con menos de 5 horas de sueño en los últimos 7 días",required:true,options:["0","1","2","3","4","5","6","7"]},
        {id:"sleep_quality",type:"slider",label:"Calidad global del sueño actual",required:true,min:0,max:10,step:1},
        {id:"restorative_sleep",type:"slider",label:"Sensación de descanso al despertar",required:true,min:0,max:10,step:1},
        {id:"sleep_impact_crisis",type:"slider",label:"Impacto negativo de la crisis sobre su sueño",required:true,min:0,max:10,step:1},
        {id:"kss",type:"select",label:"Somnolencia en este momento",required:true,options:["1 · Extremadamente alerta","2 · Muy alerta","3 · Alerta","4 · Más bien alerta","5 · Ni alerta ni somnoliento","6 · Algunos signos de somnolencia","7 · Somnoliento, sin esfuerzo para mantenerse despierto","8 · Somnoliento, con cierto esfuerzo para mantenerse despierto","9 · Extremadamente somnoliento, luchando contra el sueño"]}
      ]
    },
    {
      id:"life", kicker:"06 · IMPACTO", title:"Impacto sobre la vida personal, familiar y percepción de seguridad",
      intro:"Se estudia cómo la situación actual se relaciona con la vida cotidiana y qué factores pueden modular ese impacto.",
      questions:[
        {id:"partner",type:"radio",label:"¿Tiene pareja estable?",required:true,options:["Sí","No","Prefiero no responder"]},
        {id:"children",type:"radio",label:"¿Tiene hijos?",required:true,options:["Sí","No","Prefiero no responder"]},
        {id:"days_since_family",type:"select",label:"Tiempo desde la última vez que vio presencialmente a su familia conviviente / pareja",required:true,options:["Hoy / ayer","2–3 días","4–7 días","8–14 días",">14 días","No procede"]},
        {id:"permits_days",type:"number",label:"Días de permiso o descanso completo disfrutados desde el inicio de la situación actual",required:true,min:0,max:365},
        {id:"family_support",type:"slider",label:"Apoyo familiar percibido",required:true,min:0,max:10,step:1},
        {id:"recovery_opportunity",type:"slider",label:"Posibilidad real de recuperación entre servicios",required:true,min:0,max:10,step:1},
        {id:"insecurity_before",type:"slider",label:"Percepción de inseguridad personal en Ceuta antes de la crisis",required:true,min:0,max:10,step:1},
        {id:"insecurity_now",type:"slider",label:"Percepción de inseguridad personal en Ceuta actualmente",required:true,min:0,max:10,step:1},
        {id:"impact_family",type:"slider",label:"Impacto global sobre la vida familiar",required:true,min:-5,max:5,step:1},
        {id:"impact_social",type:"slider",label:"Impacto global sobre la vida social",required:true,min:-5,max:5,step:1},
        {id:"impact_worklife",type:"slider",label:"Impacto global sobre su vida cotidiana",required:true,min:-5,max:5,step:1},
        {id:"impact_global",type:"slider",label:"Valoración global del impacto de la crisis en su vida",required:true,min:-5,max:5,step:1,hint:"Valores negativos indican un impacto desfavorable, 0 neutro y valores positivos un impacto favorable."}
      ]
    },
    {
      id:"readiness", kicker:"07 · PREPARACIÓN OPERATIVA", title:"Instrucción, preparación y capacidad operativa percibida",
      intro:"Este bloque analiza si las exigencias actuales han interferido con la instrucción específica y con la percepción de preparación para el cometido militar.",
      questions:[
        {id:"training_frequency_change",type:"select",label:"En comparación con antes de la crisis, su frecuencia de instrucción específica de combate es actualmente",required:true,options:["Mucho menor","Algo menor","Similar","Algo mayor","Mucho mayor"]},
        {id:"training_cancelled",type:"select",label:"Sesiones de instrucción canceladas o sustituidas por necesidades derivadas de la situación",required:true,options:["Ninguna","1–2","3–5","6–10",">10","No procede"]},
        {id:"training_interference",type:"slider",label:"Interferencia de la crisis con su instrucción específica",required:true,min:0,max:10,step:1},
        {id:"physical_readiness",type:"slider",label:"Preparación física actual",required:true,min:0,max:10,step:1},
        {id:"technical_readiness",type:"slider",label:"Preparación técnica actual",required:true,min:0,max:10,step:1},
        {id:"tactical_readiness",type:"slider",label:"Preparación táctica actual",required:true,min:0,max:10,step:1},
        {id:"attention_readiness",type:"slider",label:"Capacidad percibida para mantener la atención durante el servicio",required:true,min:0,max:10,step:1},
        {id:"decision_readiness",type:"slider",label:"Capacidad percibida para tomar decisiones rápidas y correctas",required:true,min:0,max:10,step:1},
        {id:"stress_tolerance",type:"slider",label:"Tolerancia percibida al estrés durante el servicio",required:true,min:0,max:10,step:1},
        {id:"combat_readiness",type:"slider",label:"Percepción global de capacidad actual para ejecutar su cometido de combate",required:true,min:0,max:10,step:1},
        {id:"readiness_change",type:"select",label:"Comparada con el periodo anterior a la crisis, considera que su preparación operativa actual es",required:true,options:["Mucho peor","Algo peor","Similar","Algo mejor","Mucho mejor"]}
      ]
    },
    {
      id:"organization", kicker:"08 · ORGANIZACIÓN", title:"Carga de trabajo, mando y apoyo",
      intro:"Se evalúan carga percibida, claridad organizativa, confianza y apoyo durante la situación actual.",
      questions:[
        {id:"nasa",type:"tlx",required:true,items:[
          ["tlx_mental","Demanda mental"],["tlx_physical","Demanda física"],["tlx_temporal","Demanda temporal"],["tlx_performance","Insatisfacción con el rendimiento propio"],["tlx_effort","Esfuerzo requerido"],["tlx_frustration","Frustración / tensión"]
        ]},
        {id:"trust_direct",type:"slider",label:"Confianza en su mando directo",required:true,min:0,max:10,step:1},
        {id:"support_command",type:"slider",label:"Apoyo percibido por parte de sus mandos",required:true,min:0,max:10,step:1},
        {id:"orders_clarity",type:"slider",label:"Claridad de las órdenes e instrucciones recibidas",required:true,min:0,max:10,step:1},
        {id:"resources",type:"slider",label:"Adecuación de los medios disponibles para cumplir la misión",required:true,min:0,max:10,step:1},
        {id:"institution_support",type:"slider",label:"Percepción de respaldo de su institución",required:true,min:0,max:10,step:1},
        {id:"political_management",type:"slider",label:"Confianza en la gestión política de la crisis",required:false,min:0,max:10,step:1,hint:"Pregunta opcional. Puede dejarla sin responder."}
      ]
    },
    {
      id:"pretest", kicker:"09 · CONTEXTO DE LAS PRUEBAS", title:"Condiciones actuales antes de las tareas cognitivas",
      intro:"Estas variables son necesarias para interpretar adecuadamente los tiempos de reacción y la atención.",
      questions:[
        {id:"wake_time",type:"text",label:"Hora aproximada a la que se despertó hoy",required:true,hint:"Ejemplo: 06:30"},
        {id:"hours_awake",type:"number",label:"Horas que lleva despierto aproximadamente",required:true,min:0,max:30,step:0.25},
        {id:"on_duty",type:"radio",label:"¿Está actualmente de servicio?",required:true,options:["Sí","No"]},
        {id:"hours_shift",type:"number",label:"Horas transcurridas desde el inicio del turno actual (0 si no está de servicio)",required:true,min:0,max:30,step:0.25},
        {id:"caffeine_4h",type:"select",label:"Cafeína consumida en las últimas 4 horas",required:true,options:["Ninguna","1 café / equivalente","2","3","4 o más"]},
        {id:"alcohol_24h",type:"radio",label:"¿Ha consumido alcohol en las últimas 24 horas?",required:true,options:["Sí","No","Prefiero no responder"]},
        {id:"intense_exercise",type:"radio",label:"¿Ha realizado ejercicio físico intenso en las últimas 3 horas?",required:true,options:["Sí","No"]},
        {id:"attention_medication",type:"radio",label:"¿Ha tomado medicación en las últimas 12 horas que pueda afectar al sueño, alerta o atención?",required:true,options:["Sí","No","Prefiero no responder"]},
        {id:"interruptions_expected",type:"radio",label:"¿Prevé interrupciones durante los próximos 10 minutos?",required:true,options:["Sí","No"]}
      ]
    }
  ]
};
