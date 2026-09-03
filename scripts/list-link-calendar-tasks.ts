import { config } from 'dotenv'
import { pmApi, pmSession } from './lib/pm-api-client'

config({ path: '.env.local' })
config()

const PROJECT_ID = 'cmnhenfhr002tp4202x1aw096'

async function main() {
  const { base, cookies } = await pmSession()
  const res = await pmApi(base, cookies, `/api/projects/${PROJECT_ID}/tasks`)
  if (!res.ok) {
    console.error(await res.text())
    process.exit(1)
  }
  const tasks = await res.json()
  console.log(JSON.stringify(tasks, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
