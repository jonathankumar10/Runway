import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

export const TECH_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R',
  'React', 'Vue', 'Angular', 'Next.js', 'Svelte', 'Redux', 'HTML', 'CSS', 'Tailwind',
  'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Rails', 'Laravel', '.NET',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB', 'Elasticsearch', 'Cassandra',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux',
  'TensorFlow', 'PyTorch', 'scikit-learn', 'Pandas', 'NumPy', 'Spark', 'Hadoop', 'Tableau', 'Power BI', 'dbt',
  'GraphQL', 'REST', 'gRPC', 'Kafka', 'RabbitMQ', 'Microservices', 'WebSockets',
  'Git', 'Figma', 'Jira', 'Agile', 'Scrum', 'Looker',
]

export function extractSkills(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  return TECH_SKILLS.filter(s => lower.includes(s.toLowerCase()))
}

export async function extractPDFText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text.trim()
}

export async function extractStyleMap(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()

    const sizes = content.items
      .filter(item => item.str?.trim())
      .map(item => {
        const size = item.height > 0
          ? item.height
          : Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2)
        return Math.round(size * 10) / 10
      })
      .filter(s => s >= 4 && s <= 36)

    if (sizes.length === 0) return null

    const freq = {}
    for (const s of sizes) freq[s] = (freq[s] ?? 0) + 1
    let bodyFontSizePt = parseFloat(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
    bodyFontSizePt = Math.min(14, Math.max(8, bodyFontSizePt))

    const headingItems = sizes.filter(s => s >= bodyFontSizePt + 1.5)
    let headingFontSizePt, confident

    if (headingItems.length >= 3) {
      const sorted = [...headingItems].sort((a, b) => a - b)
      headingFontSizePt = sorted[Math.floor(sorted.length / 2)]
      headingFontSizePt = Math.min(20, Math.max(9, headingFontSizePt))
      confident = true
    } else {
      headingFontSizePt = parseFloat((bodyFontSizePt * 1.12).toFixed(1))
      confident = false
    }

    const range = Math.max(...sizes) - Math.min(...sizes)
    if (range < 1.5) confident = false

    return { bodyFontSizePt, headingFontSizePt, extractedAt: new Date().toISOString(), confident }
  } catch {
    return null
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
