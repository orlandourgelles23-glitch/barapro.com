'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Send, X, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy el Asistente BARAPRO v10.1. Puedo ayudarte con:\n\n• Interpretación de indicadores financieros (VAN, TIR, TIRM...)\n• Metodología PDL Cuba y Resolución 1/2022\n• Guía para llenar los módulos de datos\n• Análisis de resultados financieros\n• Cálculos y verificación de datos\n\n¿En qué puedo ayudarte?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const sessionIdRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate session ID on mount
  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          message,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Lo siento, ocurrió un error: ${data.error || 'Error desconocido'}. Por favor, intenta de nuevo.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'No se pudo conectar con el asistente. Verifica tu conexión e intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading]);

  const clearConversation = useCallback(async () => {
    try {
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch(`/api/ai-assistant?sessionId=${sessionIdRef.current}`, {
        method: 'DELETE',
        headers,
      });
    } catch {
      // Ignore cleanup errors
    }
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'Conversación reiniciada. ¿En qué puedo ayudarte?',
        timestamp: new Date(),
      },
    ]);
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 gradient-primary text-white rounded-full p-4 shadow-card-lg hover:shadow-card-xl hover:scale-105 active:scale-95 transition-all duration-200 focus-ring-primary cursor-pointer"
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente BARAPRO'}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-h-[70vh] flex flex-col glass-card rounded-2xl shadow-card-xl border border-border/30 animate-fade-scale overflow-hidden">
          {/* Header */}
          <div className="gradient-primary px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/15 backdrop-blur-sm">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-fin-sm font-semibold text-white">Asistente BARAPRO</h3>
                <p className="text-[10px] text-white/60">v10.1 · Resolución 1/2022</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                aria-label="Limpiar conversación"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                aria-label="Cerrar panel"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 min-h-0">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-scale-in`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground shadow-card-sm rounded-br-sm'
                      : 'glass shadow-card-sm rounded-bl-sm border border-border/30'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="p-0.5 rounded-md bg-primary/10">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-[10px] font-medium text-primary">BARAPRO</span>
                    </div>
                  )}
                  <div className="text-fin-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                  <div className={`text-[9px] mt-1.5 ${msg.role === 'user' ? 'text-primary-foreground/50' : 'text-muted-foreground/60'}`}>
                    {msg.timestamp.toLocaleTimeString('es-CU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start animate-scale-in">
                <div className="glass rounded-2xl rounded-bl-sm shadow-card-sm border border-border/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="p-0.5 rounded-md bg-primary/10">
                      <Bot className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-fin-xs text-muted-foreground">Pensando...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border/30 bg-background/80 dark:bg-card/80 backdrop-blur-sm px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                disabled={isLoading}
                className="flex-1 h-9 bg-muted/40 dark:bg-muted/30 border border-border/50 rounded-xl px-3 text-fin-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all duration-200 disabled:opacity-50"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !inputValue.trim()}
                size="icon"
                className="h-9 w-9 gradient-primary text-white border-0 hover:opacity-90 rounded-xl shadow-card-sm shrink-0 transition-opacity"
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground/50 mt-1.5 text-center">
              Asistente IA · Presiona Enter para enviar
            </p>
          </div>
        </div>
      )}
    </>
  );
}
