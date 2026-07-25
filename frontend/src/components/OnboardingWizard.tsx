import { useState, useEffect } from 'react'
import { Check, Eye, EyeOff, ArrowRight, Sparkles, MessageSquare, Settings as SettingsIcon, Key, Cpu } from 'lucide-react'
import { signup, setSessionToken, getModels } from '../api/client'
import ModelSelector, { ModelOption } from './ModelSelector'

interface OnboardingWizardProps {
  onComplete: () => void
  onSwitchToSignin?: () => void
}

const TOTAL_STEPS = 5

export default function OnboardingWizard({ onComplete, onSwitchToSignin }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('hermes_ui_api_key') || '')
  const [model, setModel] = useState(() => localStorage.getItem('hermes_ui_model') || 'openrouter/openai/gpt-4o-mini')
  const [imageModel, setImageModel] = useState(() => localStorage.getItem('cerebro_image_model') || '')
  const [manualModel, setManualModel] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchModels = async (key: string) => {
    setModelsLoading(true)
    try { setModels(await getModels(key)) }
    catch { setModels([]) }
    finally { setModelsLoading(false) }
  }

  // If user entered an API key on step 1, fetch models when they reach step 2
  useEffect(() => {
    if (step === 2 && apiKey) {
      fetchModels(apiKey)
    }
  }, [step])

  const handleCreateAccount = async () => {
    setError('')
    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const result = await signup(username.trim(), displayName.trim() || username.trim(), password)
      setSessionToken(result.session_token)
      setStep(1)
    } catch (e: any) {
      setError(e.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveApiKey = () => {
    if (apiKey) {
      localStorage.setItem('hermes_ui_api_key', apiKey)
    }
    setStep(2)
  }

  const handleSkipApiKey = () => {
    setStep(2)
  }

  const handleSelectModel = (id: string) => {
    setModel(id)
    localStorage.setItem('hermes_ui_model', id)
  }

  const handleSelectImageModel = (id: string) => {
    setImageModel(id)
    localStorage.setItem('cerebro_image_model', id)
  }

  const handleSaveModel = () => {
    setStep(3)
  }

  const handleSaveImageModel = () => {
    setStep(4)
  }

  const handleFinish = () => {
    onComplete()
  }

  return (
    <div className="min-h-screen bg-warm-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s
                  ? 'bg-mustard text-black'
                  : step > s
                    ? 'bg-mustard/30 text-mustard'
                    : 'bg-warm-surface text-warm-muted border border-warm-border'
              }`}>
                {step > s ? <Check size={14} /> : s + 1}
              </div>
              {s < TOTAL_STEPS - 1 && <div className={`w-10 h-0.5 ${step > s ? 'bg-mustard' : 'bg-warm-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step 0: Create Account */}
        {step === 0 && (
          <div className="bg-warm-surface border border-warm-border rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-mustard/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={28} className="text-mustard" />
              </div>
              <h1 className="text-2xl font-bold text-warm-text" style={{ fontFamily: 'var(--font-serif)' }}>
                Welcome to Cerebro
              </h1>
              <p className="text-sm text-warm-muted mt-2">
                Create your account to get started. Your data stays on your machine.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-warm-muted uppercase tracking-wider mb-1.5 block">Username</label>
                <input
                  type="text" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-username"
                  className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard"
                />
              </div>
              <div>
                <label className="text-xs text-warm-muted uppercase tracking-wider mb-1.5 block">Display Name (optional)</label>
                <input
                  type="text" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard"
                />
              </div>
              <div>
                <label className="text-xs text-warm-muted uppercase tracking-wider mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 pr-10 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-muted hover:text-warm-text"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-warm-muted uppercase tracking-wider mb-1.5 block">Confirm Password</label>
                <input
                  type="password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard"
                />
              </div>

              {error && (
                <div className="bg-warm-danger/10 border border-warm-danger/30 rounded-lg px-4 py-2 text-sm text-warm-danger">
                  {error}
                </div>
              )}

              <button
                onClick={handleCreateAccount}
                disabled={loading}
                className="w-full py-2.5 bg-mustard text-black rounded-lg hover:opacity-90 transition-all font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Creating account...' : 'Create Account'}
                {!loading && <ArrowRight size={16} />}
              </button>

              <p className="text-center text-xs text-warm-muted pt-3">
                Already have an account?{' '}
                <button onClick={onSwitchToSignin} className="text-mustard hover:text-mustard-light underline">
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Step 1: API Key */}
        {step === 1 && (
          <div className="bg-warm-surface border border-warm-border rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-mustard/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Key size={28} className="text-mustard" />
              </div>
              <h1 className="text-2xl font-bold text-warm-text" style={{ fontFamily: 'var(--font-serif)' }}>
                Your API Key
              </h1>
              <p className="text-sm text-warm-muted mt-2">
                Add your OpenRouter API key to start chatting. You can also do this later in Settings.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-warm-muted uppercase tracking-wider mb-1.5 block">OpenRouter API Key</label>
                <input
                  type="password" value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveApiKey}
                  className="flex-1 py-2.5 bg-mustard text-black rounded-lg hover:opacity-90 transition-all font-medium text-sm"
                >
                  Save & Continue
                </button>
                <button
                  onClick={handleSkipApiKey}
                  className="py-2.5 px-4 text-warm-muted hover:text-warm-text transition-colors text-sm"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Default Model */}
        {step === 2 && (
          <div className="bg-warm-surface border border-warm-border rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-mustard/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Cpu size={28} className="text-mustard" />
              </div>
              <h1 className="text-2xl font-bold text-warm-text" style={{ fontFamily: 'var(--font-serif)' }}>
                Choose Your Model
              </h1>
              <p className="text-sm text-warm-muted mt-2">
                Pick a default model for your conversations. You can change it anytime in Settings.
              </p>
            </div>

            <div className="space-y-3 mb-4">
              {apiKey ? (
                <>
                  {modelsLoading ? (
                    <div className="text-warm-muted text-sm py-8 text-center">Loading models...</div>
                  ) : (
                    <ModelSelector
                      models={models}
                      model={model}
                      onModelSelect={handleSelectModel}
                      onToggleManual={() => setManualModel(!manualModel)}
                      manual={manualModel}
                    />
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-warm-muted text-center py-2">
                    No API key set — type your model ID manually
                  </p>
                  <input
                    type="text" value={model}
                    onChange={(e) => handleSelectModel(e.target.value)}
                    placeholder="openrouter/anthropic/claude-sonnet-4"
                    className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSaveModel}
              className="w-full py-2.5 bg-mustard text-black rounded-lg hover:opacity-90 transition-all font-medium text-sm flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step 3: Image Model */}
        {step === 3 && (
          <div className="bg-warm-surface border border-warm-border rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-mustard/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Cpu size={28} className="text-mustard" />
              </div>
              <h1 className="text-2xl font-bold text-warm-text" style={{ fontFamily: 'var(--font-serif)' }}>
                Image Model
              </h1>
              <p className="text-sm text-warm-muted mt-2">
                Optionally pick a model for reading/understanding images. Leave blank to use your text model.
              </p>
            </div>

            <div className="space-y-3 mb-4">
              {apiKey ? (
                <>
                  {modelsLoading ? (
                    <div className="text-warm-muted text-sm py-8 text-center">Loading models...</div>
                  ) : (
                    <ModelSelector
                      models={models}
                      model={imageModel}
                      onModelSelect={handleSelectImageModel}
                      onToggleManual={() => setManualModel(!manualModel)}
                      manual={manualModel}
                    />
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-warm-muted text-center py-2">Type a model ID (or leave blank)</p>
                  <input
                    type="text" value={imageModel}
                    onChange={(e) => handleSelectImageModel(e.target.value)}
                    placeholder="openrouter/black-forest-labs/flux-1.1-pro"
                    className="w-full bg-warm-bg border border-warm-border rounded-lg px-4 py-2.5 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-mustard"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveImageModel}
                className="flex-1 py-2.5 bg-mustard text-black rounded-lg hover:opacity-90 transition-all font-medium text-sm"
              >
                Continue
              </button>
              <button
                onClick={handleSaveImageModel}
                className="py-2.5 px-4 text-warm-muted hover:text-warm-text transition-colors text-sm"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Welcome */}
        {step === 4 && (
          <div className="bg-warm-surface border border-warm-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-warm-text" style={{ fontFamily: 'var(--font-serif)' }}>
              You're all set!
            </h1>
            <p className="text-sm text-warm-muted mt-2 mb-8">
              Here's what you can do with Cerebro:
            </p>

            <div className="space-y-3 text-left mb-8">
              <div className="flex items-start gap-3 bg-warm-bg rounded-xl p-3">
                <MessageSquare size={18} className="text-mustard shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-warm-text font-medium">Chat with AI</div>
                  <div className="text-xs text-warm-muted">Streaming responses with markdown, tools, and memory</div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-warm-bg rounded-xl p-3">
                <Cpu size={18} className="text-mustard shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-warm-text font-medium">Default model: {model}</div>
                  <div className="text-xs text-warm-muted">Change anytime in Settings</div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-warm-bg rounded-xl p-3">
                <SettingsIcon size={18} className="text-mustard shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-warm-text font-medium">Customizable</div>
                  <div className="text-xs text-warm-muted">Pick your model, adjust appearance, set custom instructions</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-2.5 bg-mustard text-black rounded-lg hover:opacity-90 transition-all font-medium text-sm flex items-center justify-center gap-2"
            >
              Start chatting
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
