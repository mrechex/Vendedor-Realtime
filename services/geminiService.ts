
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { MeetingSummary, SalesSuggestion, SalesAnalysisResult, SalesCallSummary } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: "Un resumen conciso de la reunión en 2-3 frases."
        },
        actionItems: {
            type: Type.ARRAY,
            description: "Una lista de los puntos de acción o tareas asignadas durante la reunión.",
            items: { type: Type.STRING }
        },
        keyTopics: {
            type: Type.ARRAY,
            description: "Una lista de los temas principales discutidos.",
            items: { type: Type.STRING }
        }
    },
    required: ["summary", "actionItems", "keyTopics"]
};

const salesAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        diarizedTranscript: {
            type: Type.STRING,
            description: "La transcripción completa, con cada línea prefijada por '[Vendedor]' o '[Cliente]' para identificar quién está hablando."
        },
        suggestions: {
            type: Type.ARRAY,
            description: "Una lista de sugerencias para el vendedor basadas ÚNICAMENTE en las declaraciones del cliente.",
            items: {
                type: Type.OBJECT,
                properties: {
                    type: {
                        type: Type.STRING,
                        description: "El tipo de sugerencia (ej. 'Manejo de Objeción', 'Pregunta de Cierre', 'Aclaración', 'Pregunta de Descubrimiento', 'Oportunidad de Referencia')."
                    },
                    suggestion: {
                        type: Type.STRING,
                        description: "La sugerencia o frase específica a utilizar por el vendedor. Debe ser extremadamente concisa y accionable (máximo 15 palabras)."
                    }
                },
                required: ["type", "suggestion"]
            }
        }
    },
    required: ["diarizedTranscript", "suggestions"]
};

const salesSystemInstruction = `Eres un coach de ventas experto para un representante que vende servicios de IA de alto valor: agentes de voz con IA, chatbots y automatizaciones a empresas y dueños de negocio. Tu tarea es analizar la transcripción de una llamada en tiempo real.

1.  **Contexto de Negocio:** El 'Vendedor' vende soluciones de IA. Los clientes pueden ser prospectos directos o conectores que pueden referir a otros.
2.  **Diarización:** Primero, identifica quién habla. El usuario de la aplicación es siempre el 'Vendedor'. La otra persona es el 'Cliente'. El vendedor suele hablar primero. Reescribe la transcripción completa, prefijando cada turno de conversación con '[Vendedor]' o '[Cliente]'.
3.  **Detección de Intenciones:** Analiza las declaraciones del **[Cliente]** para identificar:
    *   Objeciones y preguntas estándar (precio, funcionalidad, etc.).
    *   **Oportunidades de Referencia:** Busca activamente cuando el cliente dice que el servicio no es para él, PERO que conoce a alguien a quien le podría interesar (ej. "a mi no me sirve, pero conozco una empresa...", "le podría interesar a mi socio").
4.  **Sugerencias Estratégicas:** Proporciona sugerencias **extremadamente concisas y accionables (máximo 15 palabras)** para el '[Vendedor]'. Deben ser frases que se puedan leer de un solo vistazo.
    *   Para objeciones, da contraargumentos.
    *   Para 'Oportunidad de Referencia', proporciona frases para facilitar la conexión (ej. "¿Te parece si te envío un borrador de email para que solo lo reenvíes?").
5.  **Formato de Salida:** Responde ÚNICAMENTE con un objeto JSON que siga el esquema proporcionado. Las sugerencias deben ser muy breves.`;


const salesSummarySchema = {
    type: Type.OBJECT,
    properties: {
        painPoints: {
            type: Type.ARRAY,
            description: "Lista de los puntos de dolor, necesidades o problemas clave expresados explícitamente por el cliente.",
            items: { type: Type.STRING }
        },
        proposedSolutions: {
            type: Type.ARRAY,
            description: "Lista de los productos o servicios específicos (ej. 'agente de voz con IA', 'chatbot') que el vendedor propuso.",
            items: { type: Type.STRING }
        },
        offeredBenefits: {
            type: Type.ARRAY,
            description: "Lista de los beneficios clave que el vendedor mencionó, conectando las soluciones a los puntos de dolor del cliente.",
            items: { type: Type.STRING }
        },
        nextSteps: {
            type: Type.ARRAY,
            description: "Lista clara de los próximos pasos acordados al final de la llamada (ej. 'Agendar demo el viernes', 'Enviar propuesta por email').",
            items: { type: Type.STRING }
        },
        internalRecommendations: {
            type: Type.ARRAY,
            description: "Recomendaciones internas para el vendedor sobre cómo prepararse para el siguiente contacto o qué estrategia seguir.",
            items: { type: Type.STRING }
        }
    },
    required: ["painPoints", "proposedSolutions", "offeredBenefits", "nextSteps", "internalRecommendations"]
};

const salesSummarySystemInstruction = `Eres un analista de ventas senior. Tu tarea es analizar la transcripción completa de una llamada de ventas y convertirla en un informe estratégico y accionable. Extrae la información clave de manera precisa y concisa, basándote únicamente en el texto proporcionado. El objetivo es preparar al vendedor para el siguiente paso con el cliente.`;


export const summarizeTranscript = async (transcript: string): Promise<MeetingSummary> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Por favor, analiza la siguiente transcripción de la reunión y proporciona un resumen, los puntos de acción y los temas clave. Transcripción: \n\n${transcript}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: summarySchema,
      }
    });

    const jsonText = response.text.trim();
    const cleanedJsonText = jsonText.replace(/^```json\s*|```\s*$/g, '');
    return JSON.parse(cleanedJsonText) as MeetingSummary;
  } catch (error) {
    console.error("Error summarizing transcript:", error);
    throw new Error("No se pudo generar el resumen. Por favor, inténtelo de nuevo.");
  }
};


export const analyzeContentAndAnswer = async (context: string, question: string): Promise<string> => {
    try {
        const prompt = `Contexto: """${context}"""\n\nBasándote únicamente en el contexto proporcionado, responde la siguiente pregunta de forma clara y concisa.\n\nPregunta: "${question}"\n\nRespuesta:`;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2,
            }
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing text:", error);
        throw new Error("No se pudo analizar el texto. Por favor, inténtelo de nuevo.");
    }
};

export const analyzeImageAndAnswer = async (base64Image: string, mimeType: string, question: string): Promise<string> => {
    try {
        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType,
            },
        };
        const textPart = {
            text: `Contexto: La imagen adjunta. \n\nBasándote únicamente en la imagen, responde la siguiente pregunta: "${question}"`,
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing image:", error);
        throw new Error("No se pudo analizar la imagen. Por favor, inténtelo de nuevo.");
    }
};

export const getSalesSuggestions = async (transcript: string): Promise<SalesAnalysisResult> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analiza la siguiente transcripción de una llamada de ventas. Transcripción:\n\n${transcript}`,
            config: {
                systemInstruction: salesSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: salesAnalysisSchema,
                thinkingConfig: { thinkingBudget: 0 },
            }
        });

        const jsonText = response.text.trim();
        const cleanedJsonText = jsonText.replace(/^```json\s*|```\s*$/g, '');
        return JSON.parse(cleanedJsonText) as SalesAnalysisResult;
    } catch (error) {
        console.error("Error in getSalesSuggestions service:", error);
        throw error; // Re-throw the error for the component to handle
    }
};

export const generateSalesSummary = async (transcript: string): Promise<SalesCallSummary> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Use standard model for higher quality analysis
            contents: `Analiza la siguiente transcripción de una llamada de ventas y extrae la información solicitada en formato JSON. Transcripción:\n\n${transcript}`,
            config: {
                systemInstruction: salesSummarySystemInstruction,
                responseMimeType: "application/json",
                responseSchema: salesSummarySchema,
            }
        });

        const jsonText = response.text.trim();
        const cleanedJsonText = jsonText.replace(/^```json\s*|```\s*$/g, '');
        return JSON.parse(cleanedJsonText) as SalesCallSummary;
    } catch (error) {
        console.error("Error generating sales summary:", error);
        throw new Error("No se pudo generar el resumen de la venta.");
    }
};
