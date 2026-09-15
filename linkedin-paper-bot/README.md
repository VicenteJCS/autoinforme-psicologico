# LinkedIn paper bot

Automatización independiente para detectar nuevas publicaciones científicas de Vicente Javier Clemente-Suárez y programar una publicación en el perfil de LinkedIn conectado a Buffer.

## Flujo

1. Consulta Crossref cada día usando el ORCID `0000-0002-2397-2801`.
2. La primera ejecución registra el histórico y no publica artículos antiguos.
3. Si aparece un DOI nuevo asociado al ORCID, prepara un texto en español.
4. Si existe `GEMINI_API_KEY`, usa Gemini para redactar el texto a partir de metadatos y abstract con instrucciones estrictas de no inventar resultados.
5. Si no existe `GEMINI_API_KEY`, usa una plantilla conservadora basada solo en datos verificables.
6. Programa el post en el canal de LinkedIn de Buffer.
7. Registra el DOI para evitar duplicados.

## Secretos de GitHub Actions

En `Settings > Secrets and variables > Actions > New repository secret`:

- `BUFFER_API_KEY` — obligatorio para publicar en Buffer.
- `BUFFER_CHANNEL_ID` — opcional si solo hay un canal LinkedIn; recomendable para fijar de forma inequívoca el perfil correcto.
- `GEMINI_API_KEY` — opcional; mejora mucho la redacción. Si se omite, el bot sigue funcionando con la plantilla conservadora.

No se deben escribir claves API directamente en archivos del repositorio.

## Ejecución

El workflow `.github/workflows/linkedin-paper-bot.yml` se ejecuta diariamente y también puede lanzarse manualmente desde la pestaña Actions de GitHub.

## Seguridad editorial

El texto generado se limita a título, revista, autores, DOI y abstract recuperado. Las instrucciones de generación prohíben inventar resultados, magnitudes, muestras, mecanismos o causalidad. Si Crossref no ofrece abstract, el texto se reduce a información bibliográfica verificable.
