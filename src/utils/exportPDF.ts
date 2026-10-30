import { formatVnd } from './budget'
import type { Answers, Plan, Weather } from '../types'
import type { jsPDF } from 'jspdf'

const FONT_FILES = {
  normal: `${import.meta.env.BASE_URL}fonts/arial.ttf`,
  bold: `${import.meta.env.BASE_URL}fonts/arialbd.ttf`,
  italic: `${import.meta.env.BASE_URL}fonts/ariali.ttf`,
}

const fontCache: Record<string, string> = {}

async function loadFontBase64(path: string): Promise<string> {
  if (fontCache[path]) return fontCache[path]
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Cannot load PDF font: ${path}`)
  const buffer = await response.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)))
  }
  const base64 = btoa(binary)
  fontCache[path] = base64
  return base64
}

async function ensurePdfFont(doc: jsPDF & { __sapaPdfFontReady?: boolean }) {
  if (doc.__sapaPdfFontReady) return
  const [normal, bold, italic] = await Promise.all([
    loadFontBase64(FONT_FILES.normal),
    loadFontBase64(FONT_FILES.bold),
    loadFontBase64(FONT_FILES.italic),
  ])
  doc.addFileToVFS('Arial.ttf', normal)
  doc.addFileToVFS('Arial-Bold.ttf', bold)
  doc.addFileToVFS('Arial-Italic.ttf', italic)
  doc.addFont('Arial.ttf', 'Arial', 'normal')
  doc.addFont('Arial-Bold.ttf', 'Arial', 'bold')
  doc.addFont('Arial-Italic.ttf', 'Arial', 'italic')
  doc.__sapaPdfFontReady = true
}

export async function exportPDF(result: Plan, answers: Answers, wx: Weather | null, shareUrl = '') {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  await ensurePdfFont(doc)
  const W=210, H=297, M=20, CW=170

  const sf = (size: number, weight = 'normal', color: [number, number, number] = [26,25,22]) => {
    doc.setFontSize(size); doc.setFont('Arial', weight); doc.setTextColor(...color)
  }
  const hLine = (y: number) => { doc.setDrawColor(200,194,184); doc.setLineWidth(0.3); doc.line(M, y, W-M, y) }

  const budgetLabel = formatVnd(answers.budget, 'VI') + ((answers.people || 1) > 1 ? ` · ${answers.people} người` : '')
  const wxStr = wx ? `${wx.temp}°C` : 'Sa Pa'
  const modeLabel = result.mode === 'local' ? 'Người địa phương' : 'Du khách'
  const now = new Date()
  const dateStr = now.toLocaleDateString('vi-VN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  let y = 0
  doc.setFillColor(26,25,22); doc.rect(0,0,W,34,'F')
  sf(18,'bold',[244,239,230]); doc.text('SapaSense', M, 14)
  sf(8,'normal',[160,150,140])
  doc.text('Lộ trình du lịch cá nhân hóa', M, 21)
  doc.text(dateStr, W-M, 21, { align:'right' })
  y = 44

  if (result.narrative) {
    const nLines = doc.splitTextToSize(result.narrative, CW-10)
    const nH = nLines.length*5+10
    doc.setFillColor(248,243,235); doc.setDrawColor(184,92,42); doc.setLineWidth(0.6)
    doc.rect(M-0.5, y-4, CW+1, nH, 'F'); doc.line(M, y-4, M, y-4+nH)
    sf(10,'italic',[130,120,108]); doc.text(nLines, M+5, y+2)
    y += nH + 6
  }

  let tx = M
  ;[budgetLabel, wxStr, modeLabel].forEach(tag => {
    const tw = doc.getStringUnitWidth(tag)*8.5*0.352+8
    if (tx+tw > W-M) { tx=M; y+=8 }
    doc.setFillColor(240,235,226); doc.setDrawColor(200,194,184); doc.setLineWidth(0.3)
    doc.rect(tx, y, tw, 6.5, 'FD')
    sf(7,'normal',[100,94,88]); doc.text(tag, tx+4, y+4.8)
    tx += tw+4
  })
  y += 11; hLine(y); y += 8

  sf(13,'bold',[26,25,22]); doc.text('Lộ trình chi tiết', M, y); y += 10

  const COLORS = ['#B85C2A','#3D5C35','#A8861E','#5A4A8A','#2A7BA8','#A83D5A','#3DA87B','#A8703D']
  ;(result.stops || []).forEach((stop, i) => {
    const descLines = doc.splitTextToSize(stop.desc, CW-16)
    const tipLines  = stop.tip ? doc.splitTextToSize('Mẹo: ' + stop.tip, CW-16) : []
    const blockH = 7 + descLines.length*4.8 + (tipLines.length ? tipLines.length*4.4 + 1.5 : 0) + (stop.badges?.length ? 8:0) + 8
    if (y+blockH > H-M-8) {
      doc.addPage()
      doc.setFillColor(26,25,22); doc.rect(0,0,W,12,'F')
      sf(6.5,'normal',[150,140,130]); doc.text('SapaSense · Lộ trình', M, 8)
      y = 20
    }
    const hex = COLORS[i % COLORS.length]
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16)
    doc.setFillColor(r,g,b); doc.circle(M+5, y+4, 5,'F')
    sf(8,'bold',[255,255,255]); doc.text(String(i+1), M+5, y+5.6, { align:'center' })
    sf(11,'bold',[26,25,22]); doc.text(stop.name, M+13, y+3)
    sf(8,'normal',[184,92,42]); doc.text(stop.time, M+13, y+8.5)
    sf(9,'normal',[100,94,88]); doc.text(descLines, M+13, y+14)
    let extra = 0
    if (tipLines.length) {
      sf(8,'italic',[120,114,108]); doc.text(tipLines, M+13, y+14+descLines.length*4.8+1)
      extra = tipLines.length*4.4 + 1.5
    }
    if (stop.badges?.length) {
      const by = y+14+descLines.length*4.8+extra; let bx = M+13
      stop.badges.forEach(badge => {
        const bw = doc.getStringUnitWidth(badge)*7*0.352+6
        doc.setFillColor(240,235,226); doc.setDrawColor(200,194,184); doc.setLineWidth(0.25)
        doc.rect(bx, by-3, bw, 5.5,'FD'); sf(6.5,'normal',[120,114,108]); doc.text(badge, bx+3, by+1.2)
        bx += bw+3
      })
    }
    y += blockH
    if (i < (result.stops?.length||0)-1) {
      doc.setDrawColor(200,194,184); doc.setLineWidth(0.3); (doc as any).setLineDash([2,2])
      doc.line(M+5, y, M+5, y+5); (doc as any).setLineDash([]); y += 5
    }
  })

  // clickable route + shareable plan, so the printed/PDF copy is still usable on the street
  const pts = (result.stops || []).map(st => `${st.lat},${st.lng}`)
  if (pts.length) {
    if (y > H-M-36) { doc.addPage(); y = 20 }
    y += 6; hLine(y); y += 8
    const route = `https://www.google.com/maps/dir/?api=1&destination=${pts[pts.length-1]}&travelmode=walking` +
      (pts.length > 1 ? `&origin=${pts[0]}` : '') + (pts.length > 2 ? `&waypoints=${pts.slice(1, -1).join('%7C')}` : '')
    sf(9,'bold',[26,25,22]); doc.text('Mở lộ trình trên Google Maps:', M, y); y += 5.5
    sf(8,'normal',[42,123,168]); doc.textWithLink('Bấm vào đây để mở bản đồ chỉ đường', M, y, { url: route }); y += 7
    if (shareUrl) {
      sf(9,'bold',[26,25,22]); doc.text('Xem và chỉnh lại lộ trình này:', M, y); y += 5.5
      sf(8,'normal',[42,123,168]); doc.textWithLink('Mở lộ trình trên SapaSense', M, y, { url: shareUrl })
    }
  }

  const total = doc.getNumberOfPages()
  for (let p=1; p<=total; p++) {
    doc.setPage(p)
    doc.setFillColor(26,25,22); doc.rect(0,H-10,W,10,'F')
    sf(6.5,'normal',[130,120,110])
    doc.text('SapaSense · Hệ thống gợi ý lộ trình du lịch', M, H-4)
    doc.text(`${p} / ${total}`, W-M, H-4, { align:'right' })
  }

  doc.save(`sapasense-${now.toISOString().slice(0,10)}.pdf`)
}
