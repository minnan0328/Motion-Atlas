const REPO = 'minnan0328/motion-atlas'

// onSuccess 於部署上線後執行，在對應 commit 建立 tag
export const onSuccess = async ({ utils }) => {
  const { CONTEXT, BRANCH, COMMIT_REF, GH_TAG_TOKEN } = process.env

  // 只在 deploy-prod 的正式部署打 tag
  if (CONTEXT !== 'production' || BRANCH !== 'deploy-prod') return
  if (!GH_TAG_TOKEN) return utils.build.failPlugin('缺少 GH_TAG_TOKEN')

  // 以台灣時間產生 tag 名稱，例如 prod-20261013-1530
  const t = new Date(Date.now() + 8 * 3600e3).toISOString()
  const tag = `prod-${t.slice(0, 10).replace(/-/g, '')}-${t.slice(11, 16).replace(':', '')}`

  const res = await fetch(`https://api.github.com/repos/${REPO}/git/refs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GH_TAG_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: COMMIT_REF }),
  })

  if (!res.ok) {
    return utils.build.failPlugin(`建立 tag 失敗：${res.status} ${await res.text()}`)
  }
  console.log(`已建立 tag ${tag} → ${COMMIT_REF}`)
}
