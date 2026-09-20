import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Volume2,
  VolumeX,
  Loader2,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { LocationInfo, CurrentWeather, PersonaType } from '../types';

interface MausamAiChatProps {
  location: LocationInfo;
  weather: CurrentWeather;
  persona: PersonaType;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const MausamAiChat: React.FC<MausamAiChatProps> = ({
  location,
  weather,
  persona,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Namaste! I am Mausam AI, your Indian meteorological assistant. Currently in ${location.name}, it is ${weather.temperature}°C with ${weather.conditionText.toLowerCase()}. How can I assist your day?`,
      timestamp: 'Now',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    `Will it rain in ${location.name} today?`,
    'Is it safe to spray crops today?',
    'What is the best time for outdoor jogging?',
    'Any highway fog or ghat road warnings?',
    'What clothing should I wear today?',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/weather-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          location: `${location.name}, ${location.state}, India`,
          weatherData: weather,
          persona,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.text || 'Weather analysis complete.',
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const fallbackMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: `In ${location.name}, current temperature is ${weather.temperature}°C with ${weather.conditionText.toLowerCase()}, humidity at ${weather.humidity}%, and wind at ${weather.windSpeed} km/h. Conditions remain stable for outdoor activities.`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpeak = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingId(msgId);
    }
  };

  return (
    <section className="w-full max-w-2xl mx-auto px-4 my-2">
      <div className="bg-white/85 backdrop-blur-md rounded-3xl p-4 border border-black/[0.05] shadow-xs flex flex-col h-[480px] max-h-[75vh]">
        {/* Chat Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                Mausam AI Weather Assistant
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Gemini Meteorological Intelligence
              </p>
            </div>
          </div>

          <button
            id="chat-clear-btn"
            onClick={() =>
              setMessages([
                {
                  id: 'init-2',
                  sender: 'assistant',
                  text: `Conversation reset. Current weather in ${location.name} is ${weather.temperature}°C, ${weather.conditionText}. Ask me anything!`,
                  timestamp: 'Now',
                },
              ])
            }
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors touch-manipulation active:scale-95 shrink-0"
            title="Clear chat"
            aria-label="Clear chat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 text-xs overscroll-contain">
          {messages.map((msg) => {
            const isBot = msg.sender === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isBot ? 'items-start' : 'items-end justify-end'}`}
              >
                {isBot && (
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3 leading-relaxed relative group ${
                    isBot
                      ? 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-sm'
                      : 'bg-slate-900 text-white rounded-tr-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  <div
                    className={`flex items-center justify-between gap-2 mt-1.5 text-[10px] ${
                      isBot ? 'text-slate-400' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>

                    {isBot && (
                      <button
                        onClick={() => toggleSpeak(msg.id, msg.text)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-200/60 active:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors touch-manipulation"
                        title={speakingId === msg.id ? 'Stop listening' : 'Listen with voice'}
                        aria-label="Voice audio"
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {!isBot && (
                  <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 mb-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 items-start">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-slate-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                <span>Mausam AI is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts pills */}
        <div className="py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0 border-t border-slate-100 overscroll-x-contain touch-pan-x">
          {suggestedPrompts.slice(0, 4).map((prompt, i) => (
            <button
              key={i}
              id={`chat-prompt-${i}`}
              onClick={() => handleSend(prompt)}
              className="text-[11px] font-medium px-3 py-1.5 min-h-[36px] rounded-full bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 whitespace-nowrap shrink-0 transition-colors touch-manipulation active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Query Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="pt-2 flex items-center gap-2 shrink-0"
        >
          <input
            id="chat-input-query"
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask anything about weather, rain, crops..."
            className="flex-1 text-xs px-3.5 py-2.5 min-h-[44px] rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            id="chat-submit-btn"
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:opacity-40 transition-all active:scale-95 shrink-0 touch-manipulation"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </section>
  );
};
