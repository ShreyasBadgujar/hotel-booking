import React, { useEffect, useRef, useState } from 'react'
import Vapi from '@vapi-ai/web'
import { getVapiToken } from '../api/ai'
import { Mic, MicOff, Bot, User, Filter, PhoneOff, VolumeX, Volume2 } from 'lucide-react'

const VapiVoice = () => {
  const vapiRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [messages, setMessages] = useState([]) // { role: 'user'|'assistant', text: string, timestamp: number }
  const [filter, setFilter] = useState('all') // 'all' | 'assistant' | 'user'
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  

  const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY
  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID

  const attachListeners = (instance) => {
    if (!instance) return
    const onMessage = (evt) => {
      try {
        if (!evt) return
        if (evt.type === 'transcript') {
          const role = evt.role || (evt.speaker === 'user' ? 'user' : 'assistant')
          const text = evt.transcript || evt.text || ''
          if (text) setMessages((prev) => [...prev, { role, text, timestamp: Date.now() }])
        }
        if (evt.type === 'partial-transcript') {
          const text = evt.transcript || ''
          if (text) setMessages((prev) => [...prev, { role: 'assistant', text, timestamp: Date.now() }])
        }
      } catch {}
    }
    instance.on?.('message', onMessage)
    // store remover on the instance for cleanup when cutting
    instance.__onMessage = onMessage
  }

  const createOrGetInstance = async () => {
    if (vapiRef.current) return vapiRef.current
    // Prefer server token, fallback to public key
    const res = await getVapiToken().catch(() => null)
    const initKeyOrToken = res?.token || publicKey
    if (!initKeyOrToken) return null
    const instance = new Vapi(initKeyOrToken)
    attachListeners(instance)
    vapiRef.current = instance
    return instance
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        // Prefer server-minted token for security
        if (cancelled) return
        await createOrGetInstance()
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

  // no-op: listeners are attached on instance creation

  const start = async () => {
    const instance = await createOrGetInstance()
    if (!instance) return
    setIsConnecting(true)
    try {
      if (assistantId) {
        // Prefer starting with a preconfigured Assistant from Vapi Dashboard
        await instance.start(assistantId)
      } else {
        // Fallback: start with a minimal default config if no assistant id
        await instance.start({
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
    } finally {
      setIsConnecting(false)
    }
  }

  const stop = async () => {
    if (!vapiRef.current) return
    setIsConnecting(true)
    try {
      const stopPromise = vapiRef.current.stop?.()
      const timeout = new Promise((resolve) => setTimeout(resolve, 1500))
      await Promise.race([stopPromise, timeout])
    } catch (err) {
      console.error('Vapi stop failed', err)
    } finally {
      setIsListening(false)
      setIsConnecting(false)
      try { vapiRef.current = null } catch {}
    }
  }

  const cut = async () => {
    // Hard end the session and reset
    try {
      setIsConnecting(true)
      const stopPromise = vapiRef.current?.stop?.()
      const timeout = new Promise((resolve) => setTimeout(resolve, 1000))
      await Promise.race([stopPromise, timeout])
    } catch {}
    setIsListening(false)
    setIsConnecting(false)
    setIsMuted(false)
    setMessages([])
    setFilter('all')
    try {
      if (vapiRef.current?.__onMessage) {
        vapiRef.current.off?.('message', vapiRef.current.__onMessage)
      }
      vapiRef.current = null
    } catch {}
  }

  const toggleMute = async () => {
    if (!vapiRef.current || !isListening) return
    
    try {
      const newMuteState = !isMuted
      await vapiRef.current.setMuted(newMuteState)
      setIsMuted(newMuteState)
    } catch (err) {
      console.error('Failed to toggle mute', err)
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
    <div className="fixed bottom-0 right-0 z-50 p-4">
      {messages.length > 0 && (
        <div className="mb-4 w-80 max-h-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-semibold">AI Assistant</span>
                {isListening && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-200">Live</span>
                    </div>
                    {isMuted && (
                      <div className="flex items-center gap-1">
                        <VolumeX className="w-3 h-3 text-orange-300" />
                        <span className="text-xs text-orange-200">Muted</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-white/20 border border-white/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="all" className="text-gray-800">All</option>
                  <option value="assistant" className="text-gray-800">Assistant</option>
                  <option value="user" className="text-gray-800">You</option>
                </select>
              </div>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {visibleMessages.map((m, idx) => (
              <div key={`${m.timestamp || idx}-${idx}`} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                }`}>
                  {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-xs rounded-2xl px-4 py-2 ${
                  m.role === 'user' ? 'bg-blue-500 text-white ml-auto' : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                }`}>
                  <div className="text-sm leading-relaxed">{m.text}</div>
                </div>
              </div>
            ))}
            {visibleMessages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Bot className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No messages yet</p>
              </div>
            )}
          </div>
          
        </div>
      )}

      <div className="relative flex items-center gap-3">
        <button
          onClick={isListening ? stop : start}
          disabled={isConnecting}
          aria-label={isListening ? 'Stop voice assistant' : 'Start voice assistant'}
          className={`w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isConnecting ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : isListening ? (
            <MicOff className="w-7 h-7 text-white" />
          ) : (
            <Mic className="w-7 h-7 text-white" />
          )}
        </button>

        {(isListening || isConnecting) && (
          <>
            <button
              onClick={toggleMute}
              disabled={isConnecting}
              className={`w-10 h-10 rounded-full shadow flex items-center justify-center transition-all duration-300 ${
                isMuted 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-gray-600 hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={cut}
              className="w-10 h-10 rounded-full shadow flex items-center justify-center bg-red-600 text-white hover:bg-red-700"
              aria-label="End call"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </>
        )}

        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
          <Bot className="w-3 h-3 text-white" />
        </div>
      </div>

      {isListening && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded-full text-xs whitespace-nowrap animate-in fade-in slide-in-from-bottom-1">
          Listening...
        </div>
      )}
    </div>
  )
}

export default VapiVoice


