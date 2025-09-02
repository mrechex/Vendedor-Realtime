
import React, { useState, useRef, useCallback } from 'react';
import { analyzeContentAndAnswer, analyzeImageAndAnswer } from '../services/geminiService';
import { Icon } from './Icon';
import Spinner from './Spinner';

type ContextType = 'text' | 'image' | null;

const ScreenAssistant: React.FC = () => {
  const [context, setContext] = useState<string>('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [contextType, setContextType] = useState<ContextType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImageBase64(base64String);
        setImageMimeType(file.type);
        setContextType('image');
        setContext(''); // Clear text context
        setAnswer('');
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleAskQuestion = useCallback(async () => {
    if (!question || !contextType) return;
    
    setIsLoading(true);
    setError(null);
    setAnswer('');
    
    try {
      let result = '';
      if (contextType === 'text' && context) {
        result = await analyzeContentAndAnswer(context, question);
      } else if (contextType === 'image' && imageBase64 && imageMimeType) {
        result = await analyzeImageAndAnswer(imageBase64, imageMimeType, question);
      }
      setAnswer(result);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [question, context, imageBase64, imageMimeType, contextType]);

  const handlePaste = async () => {
    try {
        const text = await navigator.clipboard.readText();
        setContext(text);
        setContextType('text');
        setImageBase64(null); // Clear image context
        setAnswer('');
    } catch (err) {
        setError("No se pudo pegar el texto del portapapeles.");
        console.error('Failed to read clipboard contents: ', err);
    }
  };

  const renderContextInput = () => {
    if (contextType === 'image' && imageBase64) {
      return (
        <div className="relative p-2 border border-dashed border-gray-600 rounded-lg">
          <img src={`data:${imageMimeType};base64,${imageBase64}`} alt="Context" className="max-h-40 rounded-md mx-auto" />
        </div>
      );
    }
    return (
      <textarea
        value={context}
        onChange={(e) => {
          setContext(e.target.value);
          setContextType('text');
          setImageBase64(null);
        }}
        placeholder="Pega texto aquí o sube una imagen..."
        className="w-full h-32 p-2 bg-gray-900/70 border border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none text-sm"
      />
    );
  };
  
  return (
    <div className="flex flex-col h-full space-y-3">
      <h3 className="text-lg font-semibold text-sky-400">Asistente de Pantalla</h3>
      
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-400">Contexto</label>
        <div className="flex gap-2">
            <button onClick={handlePaste} className="flex-1 text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Pegar Texto</button>
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Subir Imagen</button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </div>
        {renderContextInput()}
      </div>

      <div className="space-y-2">
         <label htmlFor="question" className="text-sm font-medium text-gray-400">Tu Pregunta</label>
         <input
          id="question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="¿Qué quieres saber sobre el contexto?"
          className="w-full p-2 bg-gray-900/70 border border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
        />
      </div>

      <button
        onClick={handleAskQuestion}
        disabled={isLoading || !question || (!context && !imageBase64)}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? <Spinner size="sm" /> : <Icon name="sparkles" className="w-5 h-5" />}
        Preguntar
      </button>

      {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-lg text-sm">{error}</div>}
      
      {answer && (
         <div className="flex-grow bg-gray-900/70 p-4 rounded-lg border border-sky-400/30 overflow-y-auto space-y-2">
            <h4 className="font-bold text-sky-300">Respuesta</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{answer}</p>
         </div>
      )}
    </div>
  );
};

export default ScreenAssistant;
