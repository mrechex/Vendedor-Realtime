
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getSalesSuggestions, generateSalesSummary } from '../services/geminiService';
import type { SalesSuggestion, SalesAnalysisResult, SalesCallSummary } from '../types';
import { Icon } from './Icon';
import Spinner from './Spinner';
import HelpModal from './HelpModal';

// Type definitions for Web Speech API to fix TypeScript errors.
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onstart: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

type ListeningStatus = 'idle' | 'listening' | 'reconnecting' | 'error';
type SuggestionIconMap = { [key: string]: string };

const suggestionIcons: SuggestionIconMap = {
  'Manejo de Objeción': 'shield',
  'Pregunta de Cierre': 'key',
  'Pregunta de Descubrimiento': 'help',
  'Aclaración': 'chat',
  'Oportunidad de Referencia': 'referral',
  'Error': 'error'
};


const SalesAssistant: React.FC = () => {
  const [status, setStatus] = useState<ListeningStatus>('idle');
  const [rawTranscript, setRawTranscript] = useState('');
  const [diarizedTranscript, setDiarizedTranscript] = useState('');
  const [suggestions, setSuggestions] = useState<SalesSuggestion[]>([]);
  const [newSuggestionCount, setNewSuggestionCount] = useState(0);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [summary, setSummary] = useState<SalesCallSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const suggestionTimeoutRef = useRef<number | null>(null);
  const intentionalStopRef = useRef(false);
  const isRateLimited = useRef(false);
  
  const fetchSuggestions = useCallback(async () => {
    if (!rawTranscript.trim() || isRateLimited.current) return;
    
    setIsFetchingSuggestions(true);
    // Don't clear the error if it's a rate limit warning, which is managed separately
    if (!isRateLimited.current) {
        setError(null);
    }

    try {
        const result = await getSalesSuggestions(rawTranscript);
        setDiarizedTranscript(result.diarizedTranscript);
        if(result.suggestions.length > 0) {
            setSuggestions(current => [...result.suggestions, ...current].slice(0, 10));
            setNewSuggestionCount(result.suggestions.length);
            setTimeout(() => setNewSuggestionCount(0), 3000);
        }
    } catch (e: any) {
        console.error("Error fetching sales suggestions:", e);
        if (e.message && e.message.includes('429')) {
            setError("Límite de peticiones alcanzado. Pausando sugerencias por 30s.");
            isRateLimited.current = true;
            setTimeout(() => {
                isRateLimited.current = false;
                if (status === 'listening' || status === 'reconnecting') {
                   setError(null);
                }
            }, 30000); // 30-second cooldown
        } else {
            setError('Error al obtener sugerencias de la IA.');
        }
    } finally {
        setIsFetchingSuggestions(false);
    }
  }, [rawTranscript, status]);
  
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';

        recognition.onstart = () => {
            setStatus('listening');
            setError(null);
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error:", event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
              setError(`Error de escucha: ${event.error}`);
            }
        };

        recognition.onend = () => {
             if (intentionalStopRef.current) {
                setStatus('idle');
                return; // Manual stop
            }
            
            // For any other non-manual stop, try to restart.
            setStatus('reconnecting');
            console.log('Sales Assistant: Recognition service ended. Attempting to restart...');
            setTimeout(() => {
                if (intentionalStopRef.current) {
                    setStatus('idle');
                    return;
                }
                if (recognitionRef.current) {
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        console.error("Could not restart recognition service:", e);
                        setStatus('error');
                        setError("No se pudo reiniciar la escucha.");
                    }
                }
            }, 1000); // 1-second cooldown
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + '. ';
                }
            }
            if (finalTranscript) {
                 setRawTranscript(prev => prev + finalTranscript);
            }
        };
        recognitionRef.current = recognition;
    } else {
        setStatus('error');
        setError("El reconocimiento de voz no es compatible.");
    }

    return () => {
        intentionalStopRef.current = true;
        if(recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
        }
    }
  }, []);
  
  useEffect(() => {
    if (status === 'listening' && rawTranscript) {
      if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = window.setTimeout(() => {
        fetchSuggestions();
      }, 5000); // Increased to 5 seconds to reduce API calls
    }
    return () => {
      if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    };
  }, [rawTranscript, status, fetchSuggestions]);

  const handleToggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (status === 'listening' || status === 'reconnecting') {
        intentionalStopRef.current = true;
        recognitionRef.current.stop();
        setStatus('idle');
    } else {
        intentionalStopRef.current = false;
        setRawTranscript('');
        setDiarizedTranscript('');
        setSuggestions([]);
        setSummary(null);
        setError(null);
        try {
            recognitionRef.current.start();
        } catch(e) {
            console.error("Error starting recognition:", e);
            setError("No se pudo iniciar la escucha.");
            setStatus('error');
        }
    }
  }, [status]);

  const handleGenerateSummary = async () => {
    if (!diarizedTranscript.trim()) return;
    setIsSummarizing(true);
    setSummary(null);
    try {
        const result = await generateSalesSummary(diarizedTranscript);
        setSummary(result);
    } catch (e: any) {
        setError(e.message || "Error al generar el resumen.");
    } finally {
        setIsSummarizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusInfo = () => {
      switch (status) {
          case 'listening': return { text: error || 'Escuchando...', color: error ? 'text-red-400 bg-red-900/50' : 'text-green-300 bg-green-900/50', iconName: error ? 'error' : 'microphone' };
          case 'reconnecting': return { text: 'Reconectando...', color: 'text-yellow-300 bg-yellow-900/50', iconName: 'restart' };
          case 'error': return { text: error || 'Error', color: 'text-red-400 bg-red-900/50', iconName: 'error' };
          default: return { text: 'Listo para escuchar', color: 'text-gray-400 bg-gray-800/50', iconName: '' };
      }
  };
  const { text: statusText, color: statusColor, iconName: statusIconName } = getStatusInfo();

  return (
    <>
      <div className="flex flex-col h-full space-y-3">
        {/* Status Bar */}
        <div className={`p-2 rounded-lg text-sm text-center flex items-center justify-center gap-2 transition-colors ${statusColor}`}>
          {statusIconName && (status === 'reconnecting' ? <Spinner size="sm" /> : <Icon name={statusIconName} className="w-4 h-4" />)}
          <span>{statusText}</span>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-2 gap-4 flex-grow min-h-0">
          <div className="flex flex-col space-y-2 min-h-0">
              <h4 className="font-bold text-gray-300">Transcripción</h4>
              <div className="flex-grow bg-gray-900/70 p-3 rounded-lg border border-gray-700 overflow-y-auto">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{diarizedTranscript || rawTranscript || "La conversación aparecerá aquí..."}</p>
              </div>
          </div>
          <div className="flex flex-col space-y-2 min-h-0">
              <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sky-300">Sugerencias IA</h4>
                  {isFetchingSuggestions && <Spinner size="sm"/>}
              </div>
              <div className="flex-grow bg-gray-900/70 p-3 rounded-lg border border-sky-400/30 overflow-y-auto space-y-3">
                {suggestions.map((s, i) => {
                    const isNew = i < newSuggestionCount;
                    const isReferral = s.type === 'Oportunidad de Referencia';
                    const glowClass = isNew ? 'suggestion-new-glow' : '';
                    const iconName = suggestionIcons[s.type] || 'chat';

                    return (
                        <div key={i} className={`p-3 rounded-lg transition-all ${glowClass} ${isReferral ? 'bg-green-900/50 border border-green-500/50' : 'bg-sky-900/50'}`}>
                          <div className="flex items-center gap-2 mb-1">
                             <Icon name={iconName} className={`w-5 h-5 ${isReferral ? 'text-green-300' : 'text-sky-300'}`}/>
                             <p className={`font-bold text-sm ${isReferral ? 'text-green-300' : 'text-sky-300'}`}>{s.type}</p>
                          </div>
                          <p className="text-gray-200 text-sm">{s.suggestion}</p>
                        </div>
                    );
                  })}
                {suggestions.length === 0 && (
                    <div className="text-center text-gray-400 text-sm pt-4">
                        {status === 'listening' ? "Analizando para darte sugerencias..." : "Inicia la escucha para recibir ayuda."}
                    </div>
                )}
              </div>
          </div>
        </div>

        {/* Summary Display */}
        {summary && (
            <div className="bg-gray-900/70 p-4 rounded-lg border border-indigo-400/30 overflow-y-auto space-y-3">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-indigo-300">Resumen de la Venta</h4>
                    <button onClick={() => copyToClipboard(JSON.stringify(summary, null, 2))} className="text-xs text-gray-400 hover:text-white flex items-center gap-1"><Icon name="copy" className="w-4 h-4" /> Copiar</button>
                </div>
                {summary.painPoints.length > 0 && <div><h5 className="font-semibold text-sm text-gray-300">Puntos de Dolor</h5><ul className="list-disc list-inside text-sm text-gray-400"> {summary.painPoints.map((item, i) => <li key={i}>{item}</li>)} </ul></div>}
                {summary.proposedSolutions.length > 0 && <div><h5 className="font-semibold text-sm text-gray-300">Soluciones Propuestas</h5><ul className="list-disc list-inside text-sm text-gray-400"> {summary.proposedSolutions.map((item, i) => <li key={i}>{item}</li>)} </ul></div>}
                {summary.nextSteps.length > 0 && <div><h5 className="font-semibold text-sm text-gray-300">Próximos Pasos</h5><ul className="list-disc list-inside text-sm text-gray-400"> {summary.nextSteps.map((item, i) => <li key={i}>{item}</li>)} </ul></div>}
                {summary.internalRecommendations.length > 0 && <div><h5 className="font-semibold text-sm text-gray-300">Recomendaciones</h5><ul className="list-disc list-inside text-sm text-gray-400"> {summary.internalRecommendations.map((item, i) => <li key={i}>{item}</li>)} </ul></div>}
            </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-800">
           <button
            onClick={handleToggleListening}
            className={`w-1/2 px-4 py-2 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
              status === 'listening' || status === 'reconnecting' ? 'bg-red-600 hover:bg-red-500' : 'bg-sky-600 hover:bg-sky-500'
            }`}
          >
            <Icon name="microphone" className="w-5 h-5" />
            {status === 'listening' || status === 'reconnecting' ? 'Detener' : 'Iniciar Escucha'}
          </button>
          <button
            onClick={handleGenerateSummary}
            disabled={isSummarizing || !diarizedTranscript || status !== 'idle'}
            className="w-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSummarizing ? <Spinner size="sm" /> : <Icon name="sparkles" className="w-5 h-5" />}
            Generar Resumen
          </button>
        </div>
      </div>
      
      {isHelpVisible && (
        <HelpModal onClose={() => setIsHelpVisible(false)}>
            <h3 className="text-xl font-bold text-sky-400 mb-4">Cómo Usar el Asistente en Modo Discreto</h3>
            <div className="space-y-4 text-gray-300">
                <div>
                    <h4 className="font-semibold text-lg text-white mb-2">1. Captura de Audio de la Llamada</h4>
                    <p className="text-sm">Para que la IA analice toda la conversación (tu voz y la del cliente), la forma más sencilla es <strong className="text-sky-400">no usar auriculares</strong>.</p>
                    <ul className="list-disc list-inside text-sm mt-2 space-y-1 bg-gray-800/50 p-3 rounded-lg">
                        <li>Inicia tu llamada en Zoom, Meet, etc.</li>
                        <li>Usa los <strong className="text-white">altavoces</strong> de tu computadora para el audio.</li>
                        <li>El micrófono capturará todo el sonido de la habitación, permitiendo a la IA escuchar a todos los participantes.</li>
                        <li className="text-xs text-gray-400 pt-1">Este asistente se ejecuta localmente y <strong className="text-white">NUNCA</strong> se une a la llamada como un participante visible.</li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold text-lg text-white mb-2">2. Evitar Visibilidad al Compartir Pantalla</h4>
                    <p className="text-sm">Para que el asistente no se vea cuando compartes tu pantalla, sigue esta regla de oro:</p>
                     <div className="mt-2 bg-red-900/30 border border-red-500/50 p-3 rounded-lg">
                        <p className="font-bold text-red-300">NUNCA uses "Compartir Pantalla Completa" o "Escritorio".</p>
                    </div>
                    <div className="mt-2 bg-green-900/30 border border-green-500/50 p-3 rounded-lg">
                        <p className="font-bold text-green-300">SIEMPRE usa la opción "Compartir Ventana" y selecciona solo la aplicación que quieres mostrar (ej. tu navegador, PowerPoint, etc.).</p>
                    </div>
                    <p className="text-sm mt-2">De esta forma, los demás solo verán la ventana que elegiste, y el asistente permanecerá oculto.</p>
                </div>
            </div>
        </HelpModal>
      )}
    </>
  );
};

export default SalesAssistant;
