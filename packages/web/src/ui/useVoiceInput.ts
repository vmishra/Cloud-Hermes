import { useCallback, useRef, useState } from 'react';

/**
 * Voice input via the browser's Web Speech API. Cloud Hermes is built for
 * operators who would rather describe a change than type it; this turns a held
 * dictation into text the composer can send. It degrades quietly — `supported`
 * is false where the API is absent, and the mic affordance simply does not
 * appear.
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(onTranscript: (text: string) => void): {
  supported: boolean;
  listening: boolean;
  toggle: () => void;
} {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getRecognitionCtor();
    if (Recognition === null) return;

    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? '';
      }
      if (transcript.trim() !== '') onTranscript(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, onTranscript]);

  return { supported: getRecognitionCtor() !== null, listening, toggle };
}
