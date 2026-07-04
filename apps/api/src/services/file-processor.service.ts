import type { PrismaClient } from '@go-ai/database'
import { logger } from '../lib/logger'

export async function processFile(prisma: PrismaClient, fileId: string): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: fileId } })
  if (!file) return

  await prisma.file.update({ where: { id: fileId }, data: { status: 'processing' } })

  try {
    let extractedText: string | null = null

    if (file.mimeType === 'application/pdf') {
      extractedText = await extractPdf(file.storageKey)
    } else if (
      file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimeType === 'application/msword'
    ) {
      extractedText = await extractDocx(file.storageKey)
    } else if (file.mimeType === 'text/plain' || file.mimeType === 'text/markdown') {
      extractedText = await readTextFile(file.storageKey)
    } else if (file.mimeType === 'text/csv') {
      extractedText = await extractCsv(file.storageKey)
    } else if (
      file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimeType === 'application/vnd.ms-excel'
    ) {
      extractedText = await extractExcel(file.storageKey)
    } else if (file.mimeType.startsWith('image/')) {
      extractedText = await performOcr(file.storageKey)
    }

    // Truncate to 100k chars for safety
    if (extractedText && extractedText.length > 100_000) {
      extractedText = extractedText.slice(0, 100_000) + '\n\n[Content truncated due to size limit]'
    }

    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'complete',
        extractedText,
      },
    })
  } catch (err) {
    logger.error({ err, fileId }, 'File processing failed')
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'error', metadata: { error: (err as Error).message } },
    })
  }
}

async function extractPdf(storageKey: string): Promise<string> {
  const fs = await import('fs')
  const pdfParse = (await import('pdf-parse')).default
  const buffer = fs.readFileSync(storageKey)
  const data = await pdfParse(buffer)
  return data.text
}

async function extractDocx(storageKey: string): Promise<string> {
  const fs = await import('fs')
  const mammoth = await import('mammoth')
  const buffer = fs.readFileSync(storageKey)
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

async function readTextFile(storageKey: string): Promise<string> {
  const fs = await import('fs')
  return fs.readFileSync(storageKey, 'utf-8')
}

async function extractCsv(storageKey: string): Promise<string> {
  const { parse } = await import('csv-parse/sync')
  const fs = await import('fs')
  const content = fs.readFileSync(storageKey, 'utf-8')
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[]

  if (records.length === 0) return ''

  const headers = Object.keys(records[0])
  const rows = records.slice(0, 500) // limit to 500 rows

  return [
    headers.join(' | '),
    headers.map(() => '---').join(' | '),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? '')).join(' | ')),
  ].join('\n')
}

async function extractExcel(storageKey: string): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.readFile(storageKey)
  const results: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    results.push(`## Sheet: ${sheetName}\n${csv}`)
  }

  return results.join('\n\n')
}

async function performOcr(storageKey: string): Promise<string> {
  try {
    const Tesseract = await import('tesseract.js')
    const result = await Tesseract.recognize(storageKey, 'eng', {
      logger: () => {},
    })
    return result.data.text
  } catch {
    return ''
  }
}
