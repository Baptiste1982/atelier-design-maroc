import { useState, useRef } from 'react'
import { uploadPhoto } from '../lib/service'

function compressImage(file, maxSize = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' })),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export default function PhotoCapture({ articleId, currentWorker, onUploaded, phase = 'production' }) {
  const [uploading, setUploading] = useState(false)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const handleFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file)
        await uploadPhoto(articleId, compressed, phase, currentWorker?.id)
      }
      onUploaded?.()
    } catch (err) {
      console.error('Upload error:', err)
    }
    setUploading(false)
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  return (
    <div className="flex gap-2">
      {/* Camera button */}
      <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted cursor-pointer hover:border-primary hover:text-primary transition-colors active:scale-[0.98]
        ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
        <span>📷</span>
        <span>{uploading ? 'Envoi...' : 'Camera'}</span>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </label>

      {/* Gallery button */}
      <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted cursor-pointer hover:border-primary hover:text-primary transition-colors active:scale-[0.98]
        ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
        <span>🖼️</span>
        <span>Galerie</span>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </label>
    </div>
  )
}
