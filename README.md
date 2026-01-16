# Prueba Técnica - Dashboard de Estudiante con Chat IA

## Descripción

En esta prueba técnica construirás un **dashboard para estudiantes** con un **chat integrado con IA** que usa **RAG (Retrieval-Augmented Generation)** para responder preguntas basándose en el contenido de los cursos.

El proyecto ya tiene una estructura base parcialmente implementada; tu trabajo es completar las funcionalidades faltantes.

**Tiempo estimado:** 6-8 horas

**Nivel:** Mid/Senior

---

## Prioridades

### Must Have (Crítico)

- Integración con OpenAI API (chat básico funcionando)
- Sistema RAG completo (indexar PDFs, buscar, usar contexto)
- Endpoints de estudiante (`/stats`, `/preferences`)
- Tests de los métodos implementados

### Should Have (Importante)

- Streaming de respuestas (SSE o WebSocket)
- Historial de chat con paginación
- Estados de loading/error en frontend

### Nice to Have (Si hay tiempo)

- Gráfico de actividad en Dashboard
- Efectos hover en CourseCard
- Formateo markdown en mensajes

---

## Stack Tecnológico

- **Backend:** NestJS 10.x, MongoDB/Mongoose, OpenAI API
- **Frontend:** React 18.x, TanStack Query, Styled Components
- **Monorepo:** Nx 21.x
- **Testing:** Jest, Testing Library

---

## Arquitectura RAG

El sistema RAG permite que el chat responda preguntas usando el contenido real de los cursos.

```text
┌─────────────────────────────────────────────────────────────────┐
│                         FLUJO RAG                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. INDEXACIÓN (una vez por curso)                              │
│     ┌──────────┐    ┌──────────────┐    ┌───────────────────┐   │
│     │   PDF    │───>│ Extraer texto│───>│ Dividir en chunks │   │
│     └──────────┘    └──────────────┘    └─────────┬─────────┘   │
│                                                   │             │
│                                                   v             │
│                                         ┌─────────────────┐     │
│                                         │ Crear embeddings│     │
│                                         │ (OpenAI API)    │     │
│                                         └────────┬────────┘     │
│                                                  │              │
│                                                  v              │
│                                         ┌─────────────────┐     │
│                                         │ Guardar en MongoDB│   │
│                                         │ (KnowledgeChunk) │    │
│                                         └─────────────────┘     │
│                                                                 │
│  2. CONSULTA (cada mensaje del chat)                            │
│     ┌──────────────┐    ┌─────────────────┐    ┌────────────┐   │
│     │ Pregunta del │───>│ Crear embedding │───>│  Buscar    │   │
│     │   usuario    │    │  de la pregunta │    │  similares │   │
│     └──────────────┘    └─────────────────┘    └─────┬──────┘   │
│                                                      │          │
│                                                      v          │
│     ┌──────────────┐    ┌─────────────────┐    ┌────────────┐   │
│     │  Respuesta   │<───│ Llamar a OpenAI │<───│  Contexto  │   │
│     │   al usuario │    │   con contexto  │    │ relevante  │   │
│     └──────────────┘    └─────────────────┘    └────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Archivos clave para RAG:**

- `knowledge.service.ts` → Crear embeddings, indexar, buscar
- `knowledge.controller.ts` → Endpoints `/index` y `/search`
- `ai.service.ts` → `generateResponseWithRAG()` usa el contexto encontrado
- `chat.service.ts` → Orquesta: busca contexto → llama a AI con contexto

> **Tip:** Para usar `KnowledgeService` en `ChatService`, deberás importar `KnowledgeModule` en `chat.module.ts`.

### Implementación de Búsqueda Semántica

**IMPORTANTE:** La búsqueda semántica se implementa **en memoria**, NO usando MongoDB Atlas Vector Search. El flujo es:

1. **Crear embedding de la query** → Llamar a OpenAI Embeddings API
2. **Cargar chunks de MongoDB** → `find()` normal, filtrar por `courseId` si aplica
3. **Calcular similitud** → Usar el helper `cosineSimilarity()` ya implementado
4. **Ordenar y retornar top-K** → Los chunks más similares

```typescript
// Pseudocódigo del flujo en searchSimilar()
async searchSimilar(query: string, options?) {
  // 1. Crear embedding de la pregunta
  const queryEmbedding = await this.createEmbedding(query);

  // 2. Cargar chunks de la BD (filtrar por courseId si se especifica)
  const chunks = await this.knowledgeChunkModel.find(filtros);

  // 3. Calcular similitud con cada chunk
  const scored = chunks.map(chunk => ({
    ...chunk,
    score: this.cosineSimilarity(queryEmbedding, chunk.embedding)
  }));

  // 4. Ordenar por score y retornar top-K
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

El helper `cosineSimilarity(vecA, vecB)` ya está implementado en `knowledge.service.ts`.

---

## Requisitos Previos

- Node.js 18+
- MongoDB (local o Atlas)
- Cuenta de OpenAI con API Key (Proporcionada en el momento de la prueba)

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales (MongoDB, OpenAI)

# 3. Ejecutar seeds para datos de prueba
npm run seed

# 4. Iniciar backend
npm run start:api

# 5. En otra terminal, iniciar frontend
npm run start:web
```

## Estructura del Proyecto

```code
candidate-test/
├── apps/
│   ├── api/                  # Backend NestJS
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── student/  # 70% implementado
│   │       │   ├── chat/     # 50% implementado
│   │       │   ├── ai/       # 30% implementado
│   │       │   └── knowledge/ # 20% implementado (RAG)
│   │       └── seeds/
│   └── web/                  # Frontend React
│       └── src/
│           ├── components/   # Componentes parciales
│           ├── pages/        # Dashboard y Chat
│           ├── hooks/
│           └── services/
├── data/
│   └── courses/              # PDFs de contenido para RAG
├── libs/
│   └── shared/               # Tipos compartidos
└── docs/
    ├── RUBRICA.md            # Criterios de evaluación
    └── figma-reference.md    # Referencia de diseño
```

## Tu Tarea

### Backend (NestJS)

1. **Modulo Student** ([`apps/api/src/modules/student/`](apps/api/src/modules/student/)):
   - [ ] `GET /api/students/:id/stats` - Estadisticas detalladas
     - Archivo: [`student.controller.ts`](apps/api/src/modules/student/student.controller.ts)
     - Archivo: [`student.service.ts`](apps/api/src/modules/student/student.service.ts)
   - [ ] `PATCH /api/students/:id/preferences` - Actualizar preferencias
     - Archivo: [`student.controller.ts`](apps/api/src/modules/student/student.controller.ts)
     - Archivo: [`student.service.ts`](apps/api/src/modules/student/student.service.ts)

2. **Modulo Chat** ([`apps/api/src/modules/chat/`](apps/api/src/modules/chat/)):
   - [ ] `GET /api/chat/history/:studentId` - Historial con paginacion
     - Archivo: [`chat.controller.ts`](apps/api/src/modules/chat/chat.controller.ts)
     - Archivo: [`chat.service.ts`](apps/api/src/modules/chat/chat.service.ts)
   - [ ] `DELETE /api/chat/history/:studentId/:conversationId` - Eliminar historial
     - Archivo: [`chat.controller.ts`](apps/api/src/modules/chat/chat.controller.ts)
     - Archivo: [`chat.service.ts`](apps/api/src/modules/chat/chat.service.ts)
   - [ ] Integrar RAG en `sendMessage`: buscar contexto → llamar a `generateResponseWithRAG`
     - Archivo: [`chat.service.ts`](apps/api/src/modules/chat/chat.service.ts)

3. **Modulo AI** ([`apps/api/src/modules/ai/`](apps/api/src/modules/ai/)):
   - [ ] Integracion real con OpenAI API
     - Archivo: [`ai.service.ts`](apps/api/src/modules/ai/ai.service.ts)
   - [ ] Sistema de contexto personalizado por estudiante
     - Archivo: [`ai.service.ts`](apps/api/src/modules/ai/ai.service.ts)

> **Nota sobre Streaming:** El streaming de respuestas (SSE/WebSocket) está clasificado como "Should Have". Si implementas streaming, hazlo en `ai.service.ts` (`generateStreamResponse`) y exponlo desde `chat.controller.ts`.

1. **Modulo Knowledge (RAG)** ([`apps/api/src/modules/knowledge/`](apps/api/src/modules/knowledge/)):
   - [ ] Implementar creacion de embeddings con OpenAI
     - Archivo: [`knowledge.service.ts`](apps/api/src/modules/knowledge/knowledge.service.ts)
   - [ ] Implementar indexacion de contenido de cursos
     - Archivo: [`knowledge.service.ts`](apps/api/src/modules/knowledge/knowledge.service.ts)
   - [ ] Implementar busqueda semantica (similitud coseno)
     - Archivo: [`knowledge.service.ts`](apps/api/src/modules/knowledge/knowledge.service.ts)
   - [ ] Completar endpoints de indexacion y busqueda
     - Archivo: [`knowledge.controller.ts`](apps/api/src/modules/knowledge/knowledge.controller.ts)
   - [ ] Integrar RAG en el flujo del chat (usar contexto en respuestas)
     - Archivo: [`ai.service.ts`](apps/api/src/modules/ai/ai.service.ts)

2. **Debugging:**

   - [ ] Hay un bug intencional en el codigo. Encuentralo y documenta la solucion en `DECISIONS.md`

### Frontend (React)

> **Nota:** El frontend es secundario en esta prueba. Enfócate primero en el backend y RAG.

1. **Dashboard** ([`apps/web/src/pages/Dashboard.tsx`](apps/web/src/pages/Dashboard.tsx)):
   - [ ] Estados de loading con skeleton y error con retry
   - [ ] *(Nice to have)* Implementar `ActivityChart` con chart.js o recharts

2. **Componentes** ([`apps/web/src/components/`](apps/web/src/components/)):
   - [ ] Completar [`ChatInput.tsx`](apps/web/src/components/ChatInput.tsx) con auto-resize y contador de caracteres
   - [ ] *(Nice to have)* [`CourseCard.tsx`](apps/web/src/components/CourseCard.tsx): añadir efectos hover (la navegación es placeholder, no hay página de detalle)
   - [ ] *(Nice to have)* [`ChatMessage.tsx`](apps/web/src/components/ChatMessage.tsx): formateo markdown

3. **Hook useChat** ([`apps/web/src/hooks/useChat.ts`](apps/web/src/hooks/useChat.ts)):
   - [ ] Completar `loadHistory` para cargar historial desde el backend
   - [ ] *(Should have)* `sendWithStreaming` si implementaste streaming en backend

4. **Servicio API** ([`apps/web/src/services/api.ts`](apps/web/src/services/api.ts)):
   - [ ] Completar métodos comentados cuando implementes los endpoints del backend

### Tests

Archivos con `it.todo()` que debes implementar:

**Backend:**

- [`apps/api/src/modules/student/student.controller.spec.ts`](apps/api/src/modules/student/student.controller.spec.ts)
- [`apps/api/src/modules/student/dto/update-preferences.dto.spec.ts`](apps/api/src/modules/student/dto/update-preferences.dto.spec.ts)
- [`apps/api/src/modules/chat/chat.service.spec.ts`](apps/api/src/modules/chat/chat.service.spec.ts)
- [`apps/api/src/modules/ai/ai.service.spec.ts`](apps/api/src/modules/ai/ai.service.spec.ts)
- [`apps/api/src/modules/knowledge/knowledge.service.spec.ts`](apps/api/src/modules/knowledge/knowledge.service.spec.ts)

**Frontend:**

- [`apps/web/src/pages/Dashboard.spec.tsx`](apps/web/src/pages/Dashboard.spec.tsx)
- [`apps/web/src/pages/Chat.spec.tsx`](apps/web/src/pages/Chat.spec.tsx)
- [`apps/web/src/components/StatsCard.spec.tsx`](apps/web/src/components/StatsCard.spec.tsx)

## Comandos Útiles

```bash
# Desarrollo
npm run start:api          # API en http://localhost:3333
npm run start:web          # Web en http://localhost:5173

# Testing
npm run test:api           # Tests del backend
npm run test:web           # Tests del frontend
npm test                   # Todos los tests

# Otros
npm run seed               # Regenerar datos de prueba
npm run lint               # Verificar código
```

## APIs Externas

### OpenAI

- Usa `gpt-5-mini` o `gpt-4` para las respuestas
- Usa `text-embedding-3-small` o `text-embedding-3-large` para los embeddings
- Documenta si decides usar otro modelo y por qué

## Entregables

1. **Código:** Push a este repositorio o envía un ZIP
2. **DECISIONS.md:** Documenta tus decisiones técnicas
3. **Demo:** Prepara una breve demostración de las funcionalidades

## Evaluación

Revisa `docs/RUBRICA.md` para ver los criterios de evaluación detallados.

## Datos de Prueba

Después de ejecutar `npm run seed`:

- **Student ID:** `507f1f77bcf86cd799439011`
- **Email:** `maria@test.com`

### PDFs para RAG

En la carpeta `data/courses/` encontrarás 5 PDFs con contenido educativo real:

|Archivo|Curso|Contenido|
|---|---|---|
|`javascript-fundamentals.pdf`|Introducción a JavaScript|Variables, funciones, arrays, objetos, async/await|
|`react-hooks.pdf`|React desde Cero|Hooks, estado, useEffect, useContext, optimización|
|`nodejs-express.pdf`|Node.js y Express|Módulos, Express, middleware, rutas, errores|
|`mongodb-fundamentals.pdf`|MongoDB Esencial|CRUD, queries, aggregation, índices, Mongoose|
|`typescript-profesional.pdf`|TypeScript Profesional|Tipos, interfaces, genéricos, utility types|

**Para extraer texto de los PDFs**, puedes usar la librería `pdf-parse`:

```bash
npm install pdf-parse
```

```typescript
import pdf from 'pdf-parse';
import * as fs from 'fs';

const dataBuffer = fs.readFileSync('data/courses/javascript-fundamentals.pdf');
const data = await pdf(dataBuffer);
console.log(data.text); // Texto extraído
```

Una vez extraído el texto, usa el endpoint `POST /api/knowledge/index` para indexarlo.

## Orden Recomendado de Implementación

1. **Configura el entorno** - `.env` con MongoDB y OpenAI API Key
2. **Implementa OpenAI básico** - `ai.service.ts` → `generateResponse()`
3. **Implementa RAG**:
   - `knowledge.service.ts` → `createEmbedding()`
   - `knowledge.service.ts` → `indexCourseContent()`
   - `knowledge.service.ts` → `searchSimilar()`
   - `knowledge.controller.ts` → endpoints
4. **Integra RAG en el chat** - `chat.service.ts` → modificar `sendMessage()` para usar `generateResponseWithRAG()`
5. **Endpoints de estudiante** - `student.service.ts` → `getDetailedStats()`, `updatePreferences()`
6. **Historial de chat** - `chat.service.ts` → `getHistory()`, `deleteHistory()`
7. **Tests** - Implementa los `it.todo()`
8. **Frontend** - Loading states, `loadHistory` en useChat
9. *(Si hay tiempo)* **Streaming** - SSE/WebSocket

## Consejos

- Lee todo el código existente antes de empezar
- Los comentarios `// TODO:` indican dónde debes trabajar
- Prioriza funcionalidad sobre perfección
- Documenta las decisiones importantes
- Si algo no está claro, haz suposiciones razonables y documéntalas
- **El bug intencional está en `chat.service.ts`** - búscalo en el método `startNewConversation`

## ¿Preguntas?

Si tienes dudas sobre los requisitos, documéntalas en `DECISIONS.md` junto con las suposiciones que hayas hecho.

---

Good luck!
