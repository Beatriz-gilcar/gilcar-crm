'use client'

import { useEffect, useRef, useState } from 'react'

export function SignaturePad({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const drawingRef = useRef(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    fillWhite()
  }, [])

  function fillWhite() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    setHasSignature(true)
    if (inputRef.current && canvasRef.current) {
      inputRef.current.value = canvasRef.current.toDataURL('image/png')
    }
  }

  function clear() {
    fillWhite()
    setHasSignature(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} type="hidden" name={name} />
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        className="w-full touch-none rounded-2xl border border-[var(--border)]"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex items-center justify-between">
        <span className="text-[.7rem] normal-case text-[var(--text-muted)]">
          {hasSignature ? 'Assinatura capturada' : 'Assine no quadro acima'}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-[.72rem] font-bold text-[var(--text-muted)] hover:text-white"
        >
          Limpar
        </button>
      </div>
    </div>
  )
}
