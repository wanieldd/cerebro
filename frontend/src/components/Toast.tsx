import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X, Check, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const iconMap = {
    success: <Check size={14} className="text-green-500" />,
    error: <AlertTriangle size={14} className="text-warm-danger" />,
    info: <Info size={14} className="text-blue" />,
  }

  const bgMap = {
    success: 'bg-green-500/10 border-green-500/30',
    error: 'bg-warm-danger/10 border-warm-danger/30',
    info: 'bg-blue/10 border-blue/30',
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 max-w-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-warm-text animate-slide-up ${bgMap[t.type]}`}
          >
            {iconMap[t.type]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="text-warm-muted hover:text-warm-text">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
