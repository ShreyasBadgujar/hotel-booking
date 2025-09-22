import React, { useEffect, useRef, useState } from 'react'
import Vapi from '@vapi-ai/web'

const VapiVoice = () => {
  const vapiRef = useRef(null)
  const [isListening, setIsListening] = useState(false)

  const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY
  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID

  useEffect(() => {
    if (!publicKey) {
      // Public key is required to initialize
      return
    }
    if (!vapiRef.current) {
      try {
        vapiRef.current = new Vapi(publicKey)
      } catch (err) {
        console.error('Failed to init Vapi', err)
      }
    }
    return () => {
      try {
        vapiRef.current?.stop?.()
      } catch {}
    }
  }, [publicKey])

  const start = async () => {
    if (!vapiRef.current) return
    try {
      if (assistantId) {
        // Prefer starting with a preconfigured Assistant from Vapi Dashboard
        await vapiRef.current.start(assistantId)
      } else {
        // Fallback: start with a minimal default config if no assistant id
        await vapiRef.current.start({
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini'
          },
          voice: {
            provider: '11labs',
            voiceId: 'pNInz6obpgDQGcFmaJgB' // example voice; replace in dashboard for production
          },
          instructions: 'You are a friendly hotel booking assistant. Help users find rooms and answer questions about amenities, availability, and booking.'
        })
      }
      setIsListening(true)
    } catch (err) {
      console.error('Vapi start failed', err)
    }
  }

  const stop = async () => {
    if (!vapiRef.current) return
    try {
      await vapiRef.current.stop()
    } catch (err) {
      console.error('Vapi stop failed', err)
    } finally {
      setIsListening(false)
    }
  }

  if (!publicKey) {
    return null
  }

  return (
    <button
      onClick={isListening ? stop : start}
      aria-label={isListening ? 'Stop voice assistant' : 'Start voice assistant'}
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg text-white"
      style={{
        width: 56,
        height: 56,
        backgroundColor: isListening ? '#ef4444' : '#0ea5e9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <span style={{ fontSize: 22 }}>{isListening ? '■' : '🎤'}</span>
    </button>
  )
}

export default VapiVoice


