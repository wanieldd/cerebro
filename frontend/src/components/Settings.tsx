import { useState, useEffect } from 'react'
import { ArrowLeft, Check, X, Eye, Sliders, MessageSquare, Cpu, Database, User, LogOut, KeyRound, Plus, Trash2, BookTemplate } from 'lucide-react'
import { validateApiKey, getModels, getSessionToken, clearSessionToken, signout, changePassword as apiChangePassword, getAuthStatus, getPromptPresets, createPromptPreset, deletePromptPreset } from '../api/client'
import ModelSelector from './ModelSelector'

interface SettingsProps {
  onBack: () => void
}

const KEYS = {
  API_KEY: 'hermes_ui_api_key',
  MODEL: 'hermes_ui_model',
  IMAGE_MODEL: 'cerebro_image_model',
  FONT_SIZE: 'cerebro_font_size',
  COMPACT: 'cerebro_compact',
  AUTO_TITLE: 'cerebro_auto_title',
  AUTO_MEMORY: 'cerebro_auto_memory',
  SYSTEM_PROMPT: 'cerebro_system_prompt',
}

interface ModelOption {
  id: string
  name: string
  pricing: Record<string, number>
  context_length: number
}

const FONT_SIZES = [
  { value: 'sm', label: 'Small', desc: '14px' },
  { value: 'md', label: 'Medium', desc: '16px' },
  { value: 'lg', label: 'Large', desc: '18px' },
]

// ── Shared sub-components ──

function Section({ id, icon: Icon, title, expanded, onToggle, children }: {
  id: string; icon: any; title: string; expanded: boolean; onToggle: (id: string) => void; children: React.ReactNode
}) {
  return (
    <div className="bg-warm-surface border border-warm-border rounded-xl overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-warm-elevated/50 transition-colors"
      >
        <Icon size={18} className="text-blue shrink-0" />
        <span className="text-sm font-medium text-warm-text flex-1">{title}</span>
        <span className={`text-warm-muted text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {expanded && <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>}
    </div>
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-warm-text">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-blue' : 'bg-warm-border'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-warm-muted mb-2 uppercase tracking-wider">{label}</div>
      {children}
    </div>
  )
}

export default function Settings({ onBack }: SettingsProps) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [imageModel, setImageModel] = useState('')
  const [testResult, setTestResult] = useState<'pending' | 'valid' | 'invalid' | null>(null)
  const [testing, setTesting] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [manualModelText, setManualModelText] = useState(false)
  const [manualModelImage, setManualModelImage] = useState(false)
  const [fontSize, setFontSize] = useState('md')
  const [compact, setCompact] = useState(false)
  const [autoTitle, setAutoTitle] = useState(true)
  const [autoMemory, setAutoMemory] = useState(true)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  // Auth state
  const [user, setUser] = useState<{ username: string; display_name: string } | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  // Prompt presets
  const [promptPresets, setPromptPresets] = useState<{ id: string; name: string; content: string }[]>([])
  const [presetName, setPresetName] = useState('')

  useEffect(() => {
    const savedKey = localStorage.getItem(KEYS.API_KEY) || ''
    setApiKey(savedKey)
    setModel(savedKey ? (localStorage.getItem(KEYS.MODEL) || 'openrouter/openai/gpt-4o-mini') : 'openrouter/openai/gpt-4o-mini')
    setImageModel(localStorage.getItem(KEYS.IMAGE_MODEL) || '')
    setFontSize(localStorage.getItem(KEYS.FONT_SIZE) || 'md')
    setCompact(localStorage.getItem(KEYS.COMPACT) === 'true')
    setAutoTitle(localStorage.getItem(KEYS.AUTO_TITLE) !== 'false')
    setAutoMemory(localStorage.getItem(KEYS.AUTO_MEMORY) !== 'false')
    setSystemPrompt(localStorage.getItem(KEYS.SYSTEM_PROMPT) || '')
    if (savedKey) fetchModels(savedKey)
    // Load user info
    getAuthStatus().then((s) => {
      if (s.user) setUser({ username: s.user.username, display_name: s.user.display_name })
    }).catch(() => {})
    // Load prompt presets
    getPromptPresets().then(setPromptPresets).catch(() => {})
  }, [])

  // Save API key immediately (localStorage is sync, no debounce needed)
  useEffect(() => {
    if (apiKey) save(KEYS.API_KEY, apiKey)
    else localStorage.removeItem(KEYS.API_KEY)
  }, [apiKey])

  // Debounce system prompt save only
  useEffect(() => {
    const timer = setTimeout(() => {
      save(KEYS.SYSTEM_PROMPT, systemPrompt)
    }, 300)
    return () => clearTimeout(timer)
  }, [systemPrompt])

  const fetchModels = async (key: string) => {
    setModelsLoading(true)
    try { setModels(await getModels(key)) }
    catch { setModels([]) }
    finally { setModelsLoading(false) }
  }

  const save = (key: string, value: string) => localStorage.setItem(key, value)

  const keyExists = !!localStorage.getItem(KEYS.API_KEY)

  const section = (id: string) => ({
    expanded: expandedSection === id,
    onToggle: () => setExpandedSection(expandedSection === id ? null : id),
  })

  const handleModelSelect = (id: string) => {
    setModel(id)
    save(KEYS.MODEL, id)
  }

  const handleImageModelSelect = (id: string) => {
    setImageModel(id)
    save(KEYS.IMAGE_MODEL, id)
  }

  const handleTestKey = async () => {
    if (!apiKey) return
    setTesting(true)
    try {
      const result = await validateApiKey(apiKey)
      setTestResult(result.valid ? 'valid' : 'invalid')
      if (result.valid) fetchModels(apiKey)
    } catch { setTestResult('invalid') }
    finally { setTesting(false) }
  }

  const handleSignOut = async () => {
    await signout().catch(() => {})
    clearSessionToken()
    window.location.reload()
  }

  const handleChangePassword = async () => {
    setPwError('')
    setPwSuccess(false)
    if (!currentPassword || !newPassword) {
      setPwError('Fill in both fields')
      return
    }
    if (newPassword.length < 4) {
      setPwError('New password must be at least 4 characters')
      return
    }
    setChangingPw(true)
    try {
      await apiChangePassword(currentPassword, newPassword)
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password')
    } finally {
      setChangingPw(false)
    }
  }

  const handleSavePreset = async () => {
    if (!presetName.trim() || !systemPrompt.trim()) return
    try {
      const preset = await createPromptPreset(presetName.trim(), systemPrompt)
      setPromptPresets((prev) => [...prev, preset])
      setPresetName('')
    } catch (e: any) {
      console.error('Failed to save preset:', e)
    }
  }

  const handleLoadPreset = (content: string) => {
    setSystemPrompt(content)
  }

  const handleDeletePreset = async (id: string) => {
    try {
      await deletePromptPreset(id)
      setPromptPresets((prev) => prev.filter((p) => p.id !== id))
    } catch (e: any) {
      console.error('Failed to delete preset:', e)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto py-6 px-4 space-y-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 px-1">
          <button onClick={onBack} className="text-warm-muted hover:text-warm-text transition-colors p-1 -ml-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-warm-text" style={{ fontFamily: 'var(--font-serif)' }}>Settings</h1>
            <p className="text-xs text-warm-muted">Personalize your Cerebro experience</p>
          </div>
        </div>

        {/* API Connection */}
        <Section id="api" icon={Cpu} title="API Connection" {...section('api')}>
          <OptionGroup label="OpenRouter API Key">
            <div className="flex items-center justify-between mb-2">
              <span className={`flex items-center gap-1.5 text-xs ${keyExists ? 'text-green-500' : 'text-blue'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${keyExists ? 'bg-green-500' : 'bg-blue'}`} />
                {keyExists ? 'Connected' : 'Not set'}
              </span>
            </div>
            <input
              type="password" value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); if (e.target.value) fetchModels(e.target.value); else setModels([]) }}
              placeholder="sk-or-..."
              className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue mb-2"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestKey} disabled={testing || !apiKey}
                className="px-3 py-1.5 bg-blue text-black rounded-lg hover:opacity-90 transition-all text-sm disabled:opacity-50 font-medium"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult === 'valid' && <Check size={16} className="text-green-500" />}
              {testResult === 'invalid' && <X size={16} className="text-warm-danger" />}
            </div>
          </OptionGroup>
        </Section>

        {/* Model */}
        <Section id="model" icon={MessageSquare} title="Default Model" {...section('model')}>
          <OptionGroup label="Model">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setManualModelText(!manualModelText)} className="text-xs text-blue hover:text-blue-light transition-colors">
                {manualModelText ? 'Browse models' : 'Type model ID'}
              </button>
            </div>

            {modelsLoading ? (
              <div className="text-warm-muted text-sm py-4 text-center">Loading models...</div>
            ) : (
              <ModelSelector
                models={models} model={model}
                onModelSelect={handleModelSelect}
                onToggleManual={() => setManualModelText(!manualModelText)}
                manual={manualModelText}
              />
            )}

            <div className="text-[10px] text-warm-muted/60 pt-1">
              Current: <code className="text-warm-muted">{model}</code>
            </div>
          </OptionGroup>
        </Section>

        {/* Image Model */}
        <Section id="image-model" icon={Cpu} title="Image Model" {...section('image-model')}>
          <OptionGroup label="Vision Model (optional)">
            <p className="text-xs text-warm-muted mb-2">
              Model used for reading/understanding images. Leave blank to use the default text model.
            </p>
            <ModelSelector
              models={models} model={imageModel}
              onModelSelect={handleImageModelSelect}
              onToggleManual={() => setManualModelImage(!manualModelImage)}
              manual={manualModelImage}
            />
            <div className="text-[10px] text-warm-muted/60 pt-1">
              Current: <code className="text-warm-muted">{imageModel || '(using text model)'}</code>
            </div>
          </OptionGroup>
        </Section>

        {/* Appearance */}
        <Section id="appearance" icon={Eye} title="Appearance" {...section('appearance')}>
          <OptionGroup label="Font Size">
            <div className="flex gap-2">
              {FONT_SIZES.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFontSize(opt.value); save(KEYS.FONT_SIZE, opt.value) }}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                    fontSize === opt.value
                      ? 'bg-blue/15 text-blue border border-blue/25'
                      : 'bg-warm-bg text-warm-muted border border-warm-border hover:border-warm-muted'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </OptionGroup>

          <OptionGroup label="Chat Display">
            <div className="flex gap-2">
              {['Comfortable', 'Compact'].map((label) => {
                const val = label === 'Compact'
                return (
                  <button
                    key={label}
                    onClick={() => { setCompact(val); save(KEYS.COMPACT, String(val)) }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                      compact === val
                        ? 'bg-blue/15 text-blue border border-blue/25'
                        : 'bg-warm-bg text-warm-muted border border-warm-border hover:border-warm-muted'
                    }`}
                  >
                    <div className="font-medium">{label}</div>
                    <div className="text-[10px] opacity-70">{val ? 'Tighter layout' : 'More spacing'}</div>
                  </button>
                )
              })}
            </div>
          </OptionGroup>
        </Section>

        {/* Chat Behavior */}
        <Section id="behavior" icon={Sliders} title="Chat Behavior" {...section('behavior')}>
          <Toggle value={autoTitle} onChange={(v) => { setAutoTitle(v); save(KEYS.AUTO_TITLE, String(v)) }} label="Auto-title conversations" />
          <div className="text-[10px] text-warm-muted/60 -mt-3">First message becomes the conversation title</div>
          <Toggle value={autoMemory} onChange={(v) => { setAutoMemory(v); save(KEYS.AUTO_MEMORY, String(v)) }} label="Auto-memory" />
          <div className="text-[10px] text-warm-muted/60 -mt-3">AI saves facts about you across conversations</div>
        </Section>

        {/* Custom Instructions */}
        <Section id="prompt" icon={User} title="Custom Instructions" {...section('prompt')}>
          <OptionGroup label="System Prompt Override">
            <textarea
              value={systemPrompt}
              onChange={(e) => { setSystemPrompt(e.target.value) }}
              placeholder="Add custom instructions for the AI..."
              rows={5}
              className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text placeholder-warm-muted resize-none focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <p className="text-[10px] text-warm-muted/60">These instructions are added to the system prompt for every conversation.</p>
          </OptionGroup>

          {/* Prompt Presets */}
          <OptionGroup label="Saved Presets">
            <div className="space-y-2">
              {promptPresets.length === 0 ? (
                <p className="text-xs text-warm-muted">No presets saved yet.</p>
              ) : (
                promptPresets.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 bg-warm-bg rounded-lg px-3 py-2">
                    <BookTemplate size={14} className="text-blue shrink-0" />
                    <button
                      onClick={() => handleLoadPreset(p.content)}
                      className="flex-1 text-left text-xs text-warm-text hover:text-blue truncate transition-colors"
                      title={`Load: ${p.name}`}
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() => handleDeletePreset(p.id)}
                      className="text-warm-muted hover:text-warm-danger transition-colors shrink-0"
                      title="Delete preset"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSavePreset() } }}
                  placeholder="Preset name..."
                  className="flex-1 bg-warm-bg border border-warm-border rounded-lg px-3 py-1.5 text-xs text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim() || !systemPrompt.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue text-black rounded-lg hover:opacity-90 transition-all text-xs font-medium disabled:opacity-50"
                >
                  <Plus size={12} />
                  Save
                </button>
              </div>
            </div>
          </OptionGroup>
        </Section>

        {/* Account */}
        <Section id="account" icon={User} title="Account" {...section('account')}>
          <OptionGroup label="Profile">
            <div className="bg-warm-bg rounded-lg p-3 space-y-1">
              <div className="text-sm text-warm-text">{user?.display_name || user?.username || 'Loading...'}</div>
              <div className="text-xs text-warm-muted">@{user?.username || ''}</div>
            </div>
          </OptionGroup>
          <OptionGroup label="Change Password">
            <div className="space-y-2">
              <input
                type="password" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
              />
              <input
                type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (4+ chars)"
                className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-sm text-warm-text placeholder-warm-muted focus:outline-none focus:ring-2 focus:ring-blue"
              />
              {pwError && <div className="text-xs text-warm-danger">{pwError}</div>}
              {pwSuccess && <div className="text-xs text-green-500">Password updated!</div>}
              <button
                onClick={handleChangePassword} disabled={changingPw}
                className="px-3 py-1.5 bg-warm-elevated text-warm-text rounded-lg hover:bg-warm-border transition-colors text-xs font-medium disabled:opacity-50"
              >
                {changingPw ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </OptionGroup>
          <div className="pt-2">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-warm-danger hover:bg-warm-danger/10 rounded-lg transition-colors w-full"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </Section>

        {/* Data */}
        <Section id="data" icon={Database} title="Data" {...section('data')}>
          <OptionGroup label="Memories">
            <p className="text-xs text-warm-muted mb-2">
              {autoMemory ? 'Auto-memory is enabled. The AI saves and recalls facts across conversations.' : 'Auto-memory is disabled.'}
            </p>
            <button onClick={() => { localStorage.removeItem(KEYS.API_KEY); setApiKey('') }} className="text-xs text-warm-muted hover:text-warm-danger transition-colors">
              Clear saved API key
            </button>
          </OptionGroup>
        </Section>

        <div className="h-8" />
      </div>
    </div>
  )
}