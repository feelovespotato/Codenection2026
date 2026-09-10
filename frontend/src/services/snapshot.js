export async function createSnapshotFile(data) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080; canvas.height = 720
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#fff9ec'; ctx.fillRect(0, 0, 1080, 720)
  ctx.strokeStyle = '#644520'; ctx.lineWidth = 12; ctx.strokeRect(24, 24, 1032, 672)
  ctx.fillStyle = '#392c32'; ctx.textAlign = 'center'
  ctx.font = 'bold 40px monospace'; ctx.fillText('MY MOODIFY', 540, 130)
  ctx.font = 'bold 160px monospace'; ctx.fillText(`${data.capacity.capacityScore}%`, 540, 340)
  ctx.font = '32px sans-serif'; ctx.fillText('Daily capacity used', 540, 410)
  ctx.fillStyle = '#dfccaa'; ctx.fillRect(160, 460, 760, 26)
  ctx.fillStyle = '#709567'; ctx.fillRect(160, 460, 760 * Math.min(100, Math.max(0, data.capacity.capacityScore)) / 100, 26)
  ctx.fillStyle = '#392c32'; ctx.font = '24px sans-serif'
  ctx.fillText(data.date, 540, 560)
  ctx.fillText(data.zone, 540, 606, 940)
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'))
  return new File([blob], `moodify-capacity-${data.date}.png`, { type: 'image/png' })
}

export function downloadSnapshot(file) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = file.name
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
