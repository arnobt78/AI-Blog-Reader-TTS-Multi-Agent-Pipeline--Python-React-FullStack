/**
 * AI Blog Reader — main UI.
 * Tabs: paste text or blog URL. Fetches TTS providers/voices from API, sends convert request,
 * shows audio player and download. Dark mode, sample texts, character limit, estimated duration.
 */
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { 
  Volume2, Download, Loader2, Link, FileText, Mic2, 
  AlertCircle, Lightbulb, X, Moon, Sun, Clock, Type, Gauge,
  FileQuestion, Brain, Sparkles, Zap
} from 'lucide-react'

/** Matches backend TTS_PROVIDERS[provider] shape from /api/providers */
interface TTSProvider {
  name: string
  description: string
  requires_api_key: boolean
  voices: Record<string, string>
  default_voice: string
  max_chars: number
  supports_speed: boolean
  is_ai: boolean
}

interface Providers {
  [key: string]: TTSProvider
}

/** Error payload returned by backend (title, message, suggestion, status_code) */
interface APIError {
  error: boolean
  title: string
  message: string
  suggestion: string
  status_code?: number
  provider?: string
  details?: string
}

interface SampleText {
  title: string
  text: string
}

function App() {
  // Provider/voice state (populated from /api/providers)
  const [providers, setProviders] = useState<Providers>({})
  const [selectedProvider, setSelectedProvider] = useState('edge-tts')
  const [selectedVoice, setSelectedVoice] = useState('')
  // Input: URL (for extract) or raw text
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [speed, setSpeed] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<APIError | null>(null)
  const [inputMode, setInputMode] = useState<'url' | 'text'>('text')
  // Dark mode: persist in localStorage and respect system preference on first load
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
        window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })
  const [sampleTexts, setSampleTexts] = useState<SampleText[]>([])
  const [showSamples, setShowSamples] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Apply dark class to <html> and persist choice
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  // On mount: load provider config and sample texts so dropdowns and "Samples" work
  useEffect(() => {
    fetch('/api/providers')
      .then(res => res.json())
      .then(data => {
        setProviders(data)
        if (data['edge-tts']) {
          setSelectedVoice(data['edge-tts'].default_voice)
        }
      })
      .catch(err => console.error('Failed to fetch providers:', err))

    fetch('/api/sample-texts')
      .then(res => res.json())
      .then(data => setSampleTexts(data.samples || []))
      .catch(err => console.error('Failed to fetch samples:', err))
  }, [])

  // When user switches provider, reset voice to that provider’s default
  useEffect(() => {
    if (providers[selectedProvider]) {
      setSelectedVoice(providers[selectedProvider].default_voice)
    }
  }, [selectedProvider, providers])

  const clearError = () => setError(null)

  /** Parse JSON error body from API; fallback to connection error if not JSON. */
  const parseErrorResponse = async (response: Response): Promise<APIError> => {
    try {
      const data = await response.json()
      if (data.detail && typeof data.detail === 'object') {
        return data.detail as APIError
      }
      return {
        error: true,
        title: 'Error',
        message: data.detail || data.message || 'An error occurred',
        suggestion: 'Please try again.',
      }
    } catch {
      return {
        error: true,
        title: 'Connection Error',
        message: 'Could not connect to the server.',
        suggestion: 'Check your internet connection.',
      }
    }
  }

  /** POST /api/extract-text with url; puts result into text and switches to text tab. */
  const extractTextFromUrl = async () => {
    if (!url.trim()) {
      setError({
        error: true,
        title: 'No URL',
        message: 'Please enter a blog URL.',
        suggestion: 'Paste a valid URL above.',
      })
      return
    }

    setExtracting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('url', url)

      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await parseErrorResponse(response)
        setError(errorData)
        return
      }

      const data = await response.json()
      setText(data.text)
      setInputMode('text')
    } catch {
      setError({
        error: true,
        title: 'Network Error',
        message: 'Failed to connect.',
        suggestion: 'Check your connection.',
      })
    } finally {
      setExtracting(false)
    }
  }

  /** POST /api/convert with text, provider, voice, speed, optional api_key; sets audioUrl from blob. */
  const handleConvert = async () => {
    if (!text.trim()) {
      setError({
        error: true,
        title: 'No Text',
        message: 'Please enter text to convert.',
        suggestion: 'Paste text or extract from URL.',
      })
      return
    }

    setLoading(true)
    setError(null)
    setAudioUrl(null)

    try {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('provider', selectedProvider)
      formData.append('voice', selectedVoice)
      formData.append('speed', String(speed))
      if (apiKey) {
        formData.append('api_key', apiKey)
      }

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await parseErrorResponse(response)
        setError(errorData)
        return
      }

      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      setAudioUrl(audioUrl)
    } catch {
      setError({
        error: true,
        title: 'Connection Failed',
        message: 'Could not reach the server.',
        suggestion: 'Check your connection.',
      })
    } finally {
      setLoading(false)
    }
  }

  /** Trigger download of the current audio blob as MP3. */
  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a')
      a.href = audioUrl
      a.download = `ai_audio_${Date.now()}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const loadSampleText = (sample: SampleText) => {
    setText(sample.text)
    setShowSamples(false)
    setInputMode('text')
  }

  // Derived values for character limit warning and estimated duration (~150 wpm, adjusted by speed)
  const currentProvider = providers[selectedProvider]
  const maxChars = currentProvider?.max_chars || 10000
  const charCount = text.length
  const isOverLimit = charCount > maxChars
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const estimatedDuration = Math.ceil((wordCount / 150) * (1 / speed))
  const estimatedMinutes = Math.floor(estimatedDuration / 60)
  const estimatedSeconds = estimatedDuration % 60

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 px-4 transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                AI Blog Reader
              </h1>
              <p className="text-muted-foreground text-sm">
                Convert text to speech with AI voices
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-full"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-violet-500" />
              AI Text-to-Speech
            </CardTitle>
            <CardDescription>
              Use AI models from OpenAI, ElevenLabs, or Replicate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Input Mode Tabs */}
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'url' | 'text')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Paste Text
                </TabsTrigger>
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Blog URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Blog URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://example.com/blog-post"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={extractTextFromUrl} 
                      disabled={extracting}
                      variant="secondary"
                    >
                      {extracting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Extract'
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="text">Text Content</Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowSamples(!showSamples)}
                      className="text-xs h-7"
                    >
                      <FileQuestion className="w-3 h-3 mr-1" />
                      {showSamples ? 'Hide' : 'Samples'}
                    </Button>
                  </div>
                  
                  {showSamples && (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                      {sampleTexts.map((sample, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => loadSampleText(sample)}
                          className="text-xs"
                        >
                          {sample.title}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  <Textarea
                    id="text"
                    placeholder="Paste your text here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className={`min-h-[180px] resize-y ${isOverLimit ? 'border-red-500' : ''}`}
                  />
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className={isOverLimit ? 'text-red-500 font-medium' : ''}>
                        <Type className="w-3 h-3 inline mr-1" />
                        {charCount.toLocaleString()} / {maxChars.toLocaleString()}
                      </span>
                      <span>
                        <FileText className="w-3 h-3 inline mr-1" />
                        {wordCount} words
                      </span>
                    </div>
                    <span>
                      <Clock className="w-3 h-3 inline mr-1" />
                      ~{estimatedMinutes}:{estimatedSeconds.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Provider Selection */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider">AI Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(providers).map(([key, provider]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {provider.is_ai ? (
                            <Brain className="w-4 h-4 text-violet-500" />
                          ) : (
                            <Zap className="w-4 h-4 text-yellow-500" />
                          )}
                          {provider.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentProvider && (
                  <p className="text-xs text-muted-foreground">
                    {currentProvider.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice">Voice</Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger id="voice">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentProvider && Object.entries(currentProvider.voices).map(([key, name]) => (
                      <SelectItem key={key} value={key}>
                        {name as string}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Speed Control */}
            {currentProvider?.supports_speed && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    Speed
                  </Label>
                  <span className="text-sm font-medium px-2 py-1 bg-muted rounded">
                    {speed.toFixed(1)}x
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-10">Slow</span>
                  <Slider
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={speed}
                    onValueChange={setSpeed}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">Fast</span>
                </div>
              </div>
            )}

            {/* API Key */}
            {currentProvider?.requires_api_key && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  API Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder={`Enter your ${currentProvider.name} API key`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {selectedProvider === 'openai' && 'Get key from platform.openai.com'}
                  {selectedProvider === 'elevenlabs' && 'Get key from elevenlabs.io (free tier available)'}
                  {selectedProvider === 'replicate' && 'Get token from replicate.com'}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="relative rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 p-4">
                <button onClick={clearError} className="absolute top-3 right-3 text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-3 pr-6">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-red-800 dark:text-red-200">
                      {error.title}
                      {error.status_code && <span className="text-xs ml-2 opacity-70">({error.status_code})</span>}
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>
                    {error.suggestion && (
                      <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        {error.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Convert Button */}
            <Button
              onClick={handleConvert}
              disabled={loading || !text.trim() || isOverLimit}
              className="w-full h-12 text-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Audio
                </>
              )}
            </Button>

            {/* Audio Player */}
            {audioUrl && (
              <div className="space-y-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2 text-green-800 dark:text-green-200">
                    <Volume2 className="w-4 h-4" />
                    Audio Ready!
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="border-green-300 text-green-700">
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                </div>
                <audio ref={audioRef} controls src={audioUrl} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provider Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-500" />
                Edge TTS
                <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-1.5 py-0.5 rounded">FREE</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Microsoft neural TTS. Fast & reliable.
              </p>
            </CardContent>
          </Card>
          <Card className="border-pink-200 dark:border-pink-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-500" />
                ElevenLabs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Industry-leading AI voices. Free tier.
              </p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 dark:border-yellow-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="w-4 h-4 text-yellow-500" />
                Hugging Face
                <span className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 px-1.5 py-0.5 rounded">LIMITED</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Free but unreliable. May fail often.
              </p>
            </CardContent>
          </Card>
          <Card className="border-violet-200 dark:border-violet-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-500" />
                OpenAI TTS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Premium AI voices. Requires API key.
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Powered by Edge TTS • ElevenLabs • Hugging Face • OpenAI
        </p>
      </div>
    </div>
  )
}

export default App
