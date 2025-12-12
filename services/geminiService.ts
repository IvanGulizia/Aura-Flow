import { GoogleGenAI, Type } from "@google/genai";
import { SimulationParams } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SIMULATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING },
    strokeWidth: { type: Type.NUMBER },
    opacity: { type: Type.NUMBER },
    color: { type: Type.STRING },
    blendMode: { 
      type: Type.STRING,
      description: "One of: source-over, lighter, multiply, screen, overlay, difference, exclusion"
    },
    elasticity: { type: Type.NUMBER },
    friction: { type: Type.NUMBER },
    gravityX: { type: Type.NUMBER },
    gravityY: { type: Type.NUMBER },
    wiggleAmplitude: { type: Type.NUMBER },
    wiggleFrequency: { type: Type.NUMBER },
    waveSpeed: { type: Type.NUMBER },
    audioSensitivity: { type: Type.NUMBER },
    mouseRepulsion: { type: Type.NUMBER },
    mouseAttraction: { type: Type.NUMBER },
  },
};

export const generatePhysicsTheme = async (prompt: string): Promise<Partial<SimulationParams> & { description: string }> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a creative coding simulation configuration based on this mood/concept: "${prompt}". 
      Think about how physics (gravity, elasticity, wiggle) represent emotions.
      High wiggle = chaotic/energetic. Low friction = slippery/dreamy.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: SIMULATION_SCHEMA,
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini generation failed", error);
    // Fallback or re-throw
    return {
      description: "Fallback: Gentle Breeze",
      elasticity: 0.1,
      friction: 0.95,
      wiggleAmplitude: 10,
      wiggleFrequency: 0.1,
      waveSpeed: 0.01,
      gravityX: 0,
      gravityY: 0.1
    };
  }
};