# Decisiones Técnicas

> Documenta aquí las decisiones importantes que tomes durante el desarrollo.
> Esta documentación es parte de la evaluación.

## Información del Candidato

- **Nombre:** Javier Párraga Muñoz
- **Fecha:** 26/02/2026
- **Tiempo dedicado:** ~8

---

## Decisiones de Arquitectura

### 1. API de de chat de OpenAI

**Contexto:** OpenAI expone dos APIs distintas para feneración de texto, Completions API y Responses API

**Opciones consideradas:**
1. Completions API
2. Responses API

**Decisión:** Usar Responses API para nuestro chat por las siguientes razones:
- Es la versión moderna y recomendada por OpenAI para generación de texto.
- Simplicidad en el streaming.
- Capacidad de uso de tool calling (aunque de momento no lo necesitemos).

**Consecuencias:** Hacemos uso de una API más simple y moderna.

---

### 2. Streaming de respuestas (POST + SSE-formatted response)

**Contexto:** El chat necesita mostrar la respuesta de la IA token a token para dar feedback inmediato al usuario, en lugar de esperar a que se genere el texto completo.

**Opciones consideradas:**

| 1. **WebSocket (Gateway NestJS)**
| 2. **SSE con `@Sse()` de NestJS**
| 3. **POST con respuesta SSE-formatted**

**Decisión:** Opción 3. Es más simple y rápida de implementar que WebSocket y permite usarse con un POST.

**Consecuencias:**
- Compatible con la infraestructura existente (Vite proxy, HTTP).
- Si OpenAI no está configurado, el fallback simula streaming con el placeholder, manteniendo la misma UX.

---

## Bug Encontrado

### Ubicación
- **Archivo:** `apps/api/src/modules/chat/chat.service.ts`
- **Método:** `startNewConversation`

### Descripción del Bug
Al iniciar una nueva conversación, el código obtenía la referencia del historial cacheado de la conversación anterior y lo vaciaba con `history.length = 0`. Esto mutaba el array original almacenado en `conversationCache`, destruyendo el historial de la conversación previa.

### Causa Raíz
```typescript
// Código original
const cachedHistory = this.conversationCache.get(prevId);
history = cachedHistory || [];
history.length = 0; // Vacía el array cacheado de la conversación anterior al tener la misma referencia.
```
`history` apunta al mismo array que `conversationCache.get(prevId)`. Al hacer `history.length = 0` se vacían ambas referencias, destuyendo el caché.

### Solución Propuesta
```typescript
const history: MessageHistory[] = [];
```

He optado por un approach donde se pueda seleccionar la conversación activa en front, por tanto no necesito meter la conversación anterior al historial de la nueva y puedo inicializarlo a un array vacío.

### Cómo lo descubriste
Al escribir el test `should not affect history of previous conversations` se veía como `startNewConversation` manipulaba directamente la referencia del caché.

---

## Suposiciones Realizadas

1. **Hace falta un campo nuevo de stats/dashboard para presentar el ActivityChart:** No veo data suficiente en el objeto actual para mostrar al usuario su actividad semanal. He pensado en mostrar la actividad por categoría, pero prefiero mostrar lo que me piden añadiendo un campo nuevo `weeklyActivity` calculado con la pipe de mongo.
2. **Entiendo que aunque se guardan las conversaciones por separado, la idea es que solo veas una y se vayan sumando usando el historial:** No veo ninguna forma de cambiar de conversación en la UI y al iniciar una nueva en el código original se añade el historial de la conversación anterior al nuevo historial. He optado por implementar un selector de conversaciones similar al de ChatGPT, lo único que dejo sin implementar es la forma de cambiar el título, ya que las nuevas conversaciones siempre se quedan con `Nueva conversación` de título.
3. **Veo que en los tests de web se usa Jest, pero está configurado Vitest:** No sé si es un error o no he visto algo, pero he usado Vitest y los tests pasan correctamente. Como apunte, me gusta más Vitest porque es bastante más rápido.

---

## Mejoras Futuras

Si tuviera más tiempo, implementaría:

1. Detalles de cursos, lista de cursos y chat de un curso concreto.
2. Estadísticas más detalladas.
3. Manejo más exhaustivo de los errores.
4. Rate limiting por estudiante + endpoint privados de chat.
5. Cambio de nombre automático en las conversaciones.
6. Hacer que las reacciones se guarden en base de datos en los mensajes y no sean simplemente visuales.

---

## Dificultades Encontradas

### Extraer texto de PDFs e indexarlo
- **Problema:** No sé dónde se espera que se realice la implementación de extraer el texto de los pdfs e indexarlos llamando al endpoint.
- **Solución:** He creado un script extract-pdf-text en la carpeta de scripts usando pdf-parse, pero las llamadas a indexar las he hecho yo aparte. Quizá no he visto algo o eso es lo que se esperaba. 
- **Tiempo invertido:** 15 minutos

### Emojis
- **Problema:** Conseguir que los emojis funcionaran tanto con un botón como al escribir ":" y fuera una UX cómoda. Entiendo que no se pedía tanto pero creo que ha quedado bien.
- **Tiempo invertido:** 20 minutos

---

## Notas Adicionales

Como no tengo tiempo para mostrar todas las funcionalidades, dejo aquí listadas aquellas que van más allá de las funcionalidades básicas:
## Chat
- Emoji selector con botón y al escribir : + cualquier caracter. El selector detecta las teclas para cambiar de emojis o cerrar con Esc.
- Contador de caracteres en el input + cambio de color cuando te acercas al límite.
- Formateo en markdown de la respuesta con ReactMarkdown y coloreado en los bloques de código.
- Lista de conversaciones para poder cambiar de una a otra y eliminarla.
- Botones de exportar conversación y borrar historial en la esquina derecha.
- Guardado de la conversación en local storage y usándolo como caché.
- Poder reenviar el anterior mensaje del history usando las flechas.
- Reacciones a las respuestas del asistente (solo visual, no hace nada por detrás).

## Dashboard
- Añadida la stat de racha de estudio.
- Añadido ActivityChart con la actuvidad semanal del estudiante usando recharts. Es data real añadiendo un campo nuevo `weeklyActivity` a las stats.
- Hover en las CourseCard y botones personalizados por estado.
- Loaders con Skeletons y estado de error con refetch.

