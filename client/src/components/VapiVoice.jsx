import React, { useEffect, useRef, useState } from 'react'
import Vapi from '@vapi-ai/web'
import { getVapiToken } from '../api/ai'

const VapiVoice = () => {
  const vapiRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [messages, setMessages] = useState([]) // { role: 'user'|'assistant', text: string }
  const [filter, setFilter] = useState('all') // 'all' | 'assistant' | 'user'

  const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY
  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        // Prefer server-minted token for security
        const res = await getVapiToken().catch(() => null)
        const initKeyOrToken = res?.token || publicKey
        if (!initKeyOrToken || cancelled) return
        if (!vapiRef.current) {
          vapiRef.current = new Vapi(initKeyOrToken)
        }
      } catch (err) {
        console.error('Failed to init Vapi', err)
      }
    }
    init()
    return () => {
      cancelled = true
      try {
        vapiRef.current?.stop?.()
      } catch {}
    }
  }, [publicKey])

  useEffect(() => {
    const v = vapiRef.current
    if (!v) return
    const onMessage = (evt) => {
      try {
        if (!evt) return
        if (evt.type === 'transcript') {
          const role = evt.role || (evt.speaker === 'user' ? 'user' : 'assistant')
          const text = evt.transcript || evt.text || ''
          if (text) setMessages((prev) => [...prev, { role, text }])
        }
        if (evt.type === 'partial-transcript') {
          const text = evt.transcript || ''
          if (text) setMessages((prev) => [...prev, { role: 'assistant', text }])
        }
      } catch {}
    }
    v.on?.('message', onMessage)
    return () => {
      try { v.off?.('message', onMessage) } catch {}
    }
  }, [vapiRef.current])

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
          clientMessages: ['transcript'],
          instructions: 'You are a hotel booking assistant for OUR platform. ONLY answer using data available from our backend APIs. If a hotel or room is not returned by our APIs, say it is unavailable. Do not mention or recommend hotels not in our database. Be concise and helpful.'
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

  const visibleMessages = messages.filter((m) => {
    if (filter === 'all') return true
    return m.role === filter
  })

  return (
    <>
      {messages.length > 0 && (
        <div
          className="fixed bottom-24 right-6 z-40"
          style={{
            width: 340,
            maxHeight: 280,
            backgroundColor: 'white',
            borderRadius: 12,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            padding: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, color: '#111827' }}>Transcript</div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '6px 8px',
                fontSize: 13
              }}
            >
              <option value="all">All</option>
              <option value="assistant">Assistant</option>
              <option value="user">You</option>
            </select>
          </div>
          <div style={{ overflowY: 'auto' }}>
            {visibleMessages.map((m, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase' }}>{m.role === 'user' ? 'You' : 'Assistant'}</div>
                <div style={{ fontSize: 14, color: '#111827' }}>{m.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </>
  )
}

export default VapiVoice


