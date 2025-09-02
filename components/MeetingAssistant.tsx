
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { summarizeTranscript } from '../services/geminiService';
import type { MeetingSummary } from '../types';
import { Icon } from './Icon';
import Spinner from './Spinner';

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

type RecordingStatus = 'idle' | 'listening' | 'reconnecting' | 'error';

const MeetingAssistant: React.FC = () => {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const intentionalStopRef = useRef(false);

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
            // Don't set status to 'error' for transient errors, as it will prevent reconnection.
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
              setError(`Error de escucha: ${event.error}`);
            }
        };

        recognition.onend = () => {
             if (intentionalStopRef.current) {
                setStatus('idle');
                return; // Manual stop, do nothing else.
            }
            
            // For any other reason (network error, no-speech, etc.), try to restart.
            setStatus('reconnecting');
            console.log('Recognition service ended. Attempting to restart...');
            setTimeout(() => {
                // Check if a stop was triggered in the meantime
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
                        setError("No se pudo reiniciar el reconocimiento.");
                    }
                }
            }, 1000); // 1-second cooldown before restarting
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                }
            }
             setTranscript(prev => prev + finalTranscript);
        };

        recognitionRef.current = recognition;
    } else {
        setStatus('error');
        setError("El reconocimiento de voz no es compatible con este navegador.");
    }

    return () => {
        intentionalStopRef.current = true;
        if(recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.stop();
        }
    }
  }, []);

  const handleToggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (status === 'listening' || status === 'reconnecting') {
        intentionalStopRef.current = true;
        recognitionRef.current.stop();
        setStatus('idle');
    } else {
        intentionalStopRef.current = false;
        setTranscript('');
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

  const handleSummarize = async () => {
    if (!transcript) return;
    setIsSummarizing(true);
    setError(null);
    try {
      const result = await summarizeTranscript(transcript);
      setSummary(result);
    } catch (e: any) {
      setError(e.message || 'Ocurrió un error desconocido.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  const getStatusInfo = () => {
      switch (status) {
          case 'listening': return { text: 'Escuchando...', color: 'text-green-300 bg-green-900/50', icon: <Icon name="microphone" className="w-4 h-4" /> };
          case 'reconnecting': return { text: 'Reconectando...', color: 'text-yellow-300 bg-yellow-900/50', icon: <Spinner size="sm" /> };
          case 'error': return { text: error || 'Error', color: 'text-red-400 bg-red-900/50', icon: <Icon name="error" className="w-4 h-4"/> };
          default: return { text: 'Listo', color: 'text-gray-400 bg-gray-800/50', icon: null };
      }
  };

  const { text: statusText, color: statusColor, icon: statusIcon } = getStatusInfo();

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Status Bar */}
      <div className={`p-2 rounded-lg text-sm text-center flex items-center justify-center gap-2 transition-colors ${statusColor}`}>
        {statusIcon}
        <span>{statusText}</span>
      </div>

      {/* Content Area */}
      <div className="flex-grow bg-gray-900/70 p-3 rounded-lg border border-gray-700 overflow-y-auto min-h-[100px]">
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{transcript || "La transcripción en vivo aparecerá aquí..."}</p>
      </div>

      {summary && (
        <div className="flex-grow bg-gray-900/70 p-4 rounded-lg border border-sky-400/30 overflow-y-auto space-y-4 min-h-[150px]">
          <div>
            <h4 className="font-bold text-sky-300 mb-1">Resumen</h4>
            <p className="text-sm text-gray-300">{summary.summary}</p>
          </div>
          <div>
            <h4 className="font-bold text-sky-300 mb-1">Puntos de Acción</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              {summary.actionItems.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sky-300 mb-1">Temas Clave</h4>
            <div className="flex flex-wrap gap-2">
              {summary.keyTopics.map((topic, i) => <span key={i} className="bg-sky-900/80 text-sky-300 text-xs font-semibold px-2.5 py-1 rounded-full">{topic}</span>)}
            </div>
          </div>
           <button 
                onClick={() => copyToClipboard(JSON.stringify(summary, null, 2))}
                className="mt-4 text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
                <Icon name="copy" className="w-4 h-4" /> Copiar JSON
            </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggleRecording}
          className={`w-1/2 px-4 py-2 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
            status === 'listening' || status === 'reconnecting' ? 'bg-red-600 hover:bg-red-500' : 'bg-sky-600 hover:bg-sky-500'
          }`}
        >
          <Icon name="microphone" className="w-5 h-5" />
          {status === 'listening' || status === 'reconnecting' ? 'Detener' : 'Iniciar'}
        </button>
        <button
          onClick={handleSummarize}
          disabled={isSummarizing || !transcript || status !== 'idle'}
          className="w-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSummarizing ? <Spinner size="sm" /> : <Icon name="sparkles" className="w-5 h-5" />}
          Resumir
        </button>
      </div>
    </div>
  );
};

export default MeetingAssistant;
