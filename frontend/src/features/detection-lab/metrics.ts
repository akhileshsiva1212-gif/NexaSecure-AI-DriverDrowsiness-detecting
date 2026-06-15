// Evaluation metrics for the Detection Lab: aggregate a batch of detection results into
// counts (unlabeled datasets) or accuracy / per-class precision-recall + a confusion matrix
// (labeled datasets, where each image's subfolder name is its ground-truth class).

export interface SampleResult {
  name: string
  predicted: string // '' = nothing detected
  confidence: number
  truth?: string // ground-truth label from the folder, if any
  thumbUrl: string
}

export interface ClassMetric {
  label: string
  support: number // ground-truth count
  predicted: number // times predicted
  tp: number
  precision: number
  recall: number
  f1: number
}

export interface LabEvaluation {
  total: number
  labeled: boolean
  // Unlabeled aggregates.
  predictedCounts: Record<string, number>
  meanConfidence: number
  detectionRate: number // fraction with a non-empty prediction
  // Labeled aggregates.
  accuracy: number
  classes: ClassMetric[]
  confusion: { labels: string[]; matrix: number[][] } | null
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

/** Loose match: predicted class vs ground-truth folder name (handles "stop" vs "Stop Sign"). */
function matches(predicted: string, truth: string): boolean {
  if (!predicted) return false
  const p = norm(predicted)
  const t = norm(truth)
  return p === t || t.includes(p) || p.includes(t)
}

export function evaluate(samples: SampleResult[]): LabEvaluation {
  const total = samples.length
  const labeled = samples.some((s) => s.truth)

  const predictedCounts: Record<string, number> = {}
  let confSum = 0
  let detected = 0
  for (const s of samples) {
    const key = s.predicted || '(none)'
    predictedCounts[key] = (predictedCounts[key] ?? 0) + 1
    if (s.predicted) {
      detected++
      confSum += s.confidence
    }
  }

  const base: LabEvaluation = {
    total,
    labeled,
    predictedCounts,
    meanConfidence: detected ? confSum / detected : 0,
    detectionRate: total ? detected / total : 0,
    accuracy: 0,
    classes: [],
    confusion: null,
  }
  if (!labeled) return base

  // Labeled evaluation.
  const labelSet = Array.from(
    new Set(samples.flatMap((s) => [s.truth, s.predicted || '(none)']).filter(Boolean) as string[]),
  ).sort()
  const index: Record<string, number> = {}
  labelSet.forEach((l, i) => (index[l] = i))
  const matrix = labelSet.map(() => labelSet.map(() => 0))

  let correct = 0
  const tp: Record<string, number> = {}
  const support: Record<string, number> = {}
  const predictedN: Record<string, number> = {}

  for (const s of samples) {
    if (!s.truth) continue
    const pred = s.predicted || '(none)'
    support[s.truth] = (support[s.truth] ?? 0) + 1
    predictedN[pred] = (predictedN[pred] ?? 0) + 1
    matrix[index[s.truth]][index[pred]]++
    if (matches(s.predicted, s.truth)) {
      correct++
      tp[s.truth] = (tp[s.truth] ?? 0) + 1
    }
  }

  const classes: ClassMetric[] = labelSet
    .filter((l) => support[l])
    .map((label) => {
      const t = tp[label] ?? 0
      const sup = support[label] ?? 0
      const pred = predictedN[label] ?? 0
      const precision = pred ? t / pred : 0
      const recall = sup ? t / sup : 0
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
      return { label, support: sup, predicted: pred, tp: t, precision, recall, f1 }
    })

  return {
    ...base,
    accuracy: total ? correct / total : 0,
    classes,
    confusion: { labels: labelSet, matrix },
  }
}
