import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-auth';

// Store conversations in memory (per session)
const conversations = new Map<string, any[]>();
const sessionTimestamps = new Map<string, number>();
let zaiInstance: any = null;

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_PER_SESSION = 50;
const MAX_SESSIONS = 100;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

const SYSTEM_PROMPT = `Eres el asistente de IA de BARAPRO v10.1, una aplicación profesional de evaluación financiera de proyectos cubanos siguiendo la metodología PDL y Resolución 1/2022.

Tu rol es ayudar a los usuarios con:
1. Interpretación de indicadores financieros (VAN, TIR, TIRM, PR, B/C, VAE, etc.)
2. Explicación de la metodología PDL Cuba y Resolución 1/2022
3. Guía sobre cómo llenar correctamente los módulos de datos
4. Análisis de resultados financieros y recomendaciones
5. Cálculos financieros y verificación de datos
6. Explicación de amortización (sistema francés y alemán)
7. Interpretación del Estado de Rendimiento Financiero (ERF)
8. Análisis de flujo de caja y balance general
9. Recomendaciones para mejorar la viabilidad del proyecto

Responde SIEMPRE en español. Sé profesional pero accesible. Usa terminología financiera cubana correcta.
Cuando menciones indicadores, explica su significado práctico.
Si el usuario pregunta sobre datos específicos del proyecto, indícale que puede consultar los módulos correspondientes.`;

export async function POST(request: NextRequest) {
  try {
    // Require authentication for AI assistant
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
    }

    const { sessionId, message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'El mensaje es obligatorio' }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'El mensaje excede el límite de 4000 caracteres' }, { status: 400 });
    }

    // Enforce max sessions: evict oldest if limit exceeded
    if (conversations.size >= MAX_SESSIONS && !conversations.has(sessionId)) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [key, ts] of sessionTimestamps) {
        if (ts < oldestTime) {
          oldestTime = ts;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        conversations.delete(oldestKey);
        sessionTimestamps.delete(oldestKey);
      }
    }

    const zai = await getZAI();

    // Get or create conversation
    let history = conversations.get(sessionId) || [
      { role: 'assistant', content: SYSTEM_PROMPT }
    ];

    // Add user message
    history.push({ role: 'user', content: message });

    // Keep last MAX_HISTORY_PER_SESSION messages (trim old ones but keep system prompt)
    if (history.length > MAX_HISTORY_PER_SESSION) {
      history = [history[0], ...history.slice(-(MAX_HISTORY_PER_SESSION - 1))];
    }

    const completion = await zai.chat.completions.create({
      messages: history,
      thinking: { type: 'disabled' }
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';

    // Save AI response to history
    history.push({ role: 'assistant', content: aiResponse });
    conversations.set(sessionId, history);
    sessionTimestamps.set(sessionId, Date.now());

    return NextResponse.json({
      success: true,
      response: aiResponse,
      messageCount: history.length - 1
    });
  } catch (error: any) {
    console.error('AI Assistant error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servicio'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require authentication for clearing conversations
    const currentUser = await getAuthUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      conversations.delete(sessionId);
      sessionTimestamps.delete(sessionId);
    }
    return NextResponse.json({ success: true, message: 'Conversación limpiada' });
  } catch (error: any) {
    console.error('AI Assistant DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Error al limpiar la conversación' }, { status: 500 });
  }
}
