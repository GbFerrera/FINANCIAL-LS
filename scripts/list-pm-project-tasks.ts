import { config } from 'dotenv'
import { pmApi, pmSession } from './lib/pm-api-client'

config({ path: '.env.local' })
config()

const projectId = process.argv[2]
if (!projectId) {
  console.error('Usage: npx tsx scripts/list-pm-project-tasks.ts <projectId>')
  process.exit(1)
}

async function main() {
  const { base, cookies } = await pmSession()
  const res = await pmApi(base, cookies, `/api/projects/${projectId}/tasks`)
  if (!res.ok) {
    console.error(await res.text())
    process.exit(1)
  }
  console.log(JSON.stringify(await res.json()))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
